import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { useAppStore } from '../store/useAppStore'
import { generateQuiz, evaluateQuiz } from '../lib/api'

interface Question {
  id: string
  question: string
  options: string[]
  correct_index: number
  concept_tag: string
  explanation?: string
}

interface Section {
  level: 'easy' | 'medium' | 'hard'
  questions: Question[]
}

const LEVEL_STYLES: Record<string, { badge: string; label: string; bar: string }> = {
  easy: { badge: 'bg-mastered/15 text-mastered', label: 'Easy', bar: 'bg-mastered' },
  medium: { badge: 'bg-cortex/15 text-cortex', label: 'Medium', bar: 'bg-cortex' },
  hard: { badge: 'bg-ember/15 text-ember', label: 'Hard', bar: 'bg-ember' },
}

const LEVEL_ORDER: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard']

export default function QuizPage() {
  const { nodeId } = useParams()
  const { roadmap, updateNodeStatus, unlockNodes } = useAppStore()
  const navigate = useNavigate()

  const node = roadmap?.nodes.find((n) => n.node_key === nodeId)
  const nextNode = roadmap?.nodes.find((n) => n.sequential_position === (node?.sequential_position || 0) + 1)

  const [quizAttemptId, setQuizAttemptId] = useState<string | null>(null)
  const [quizMeta, setQuizMeta] = useState<{ quiz_difficulty?: string; estimated_minutes?: number }>({})
  const [sections, setSections] = useState<Section[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Timing telemetry (AI proctoring)
  const quizStartRef = useRef<number>(0)
  const questionStartRef = useRef<Record<string, number>>({})
  const perQuestionTimeRef = useRef<Record<string, number>>({})

  const allQuestions = sections.flatMap((s) => s.questions.map((q) => ({ ...q, _level: s.level })))

  useEffect(() => {
    if (!node) return
    generateQuiz(node.id)
      .then((res) => {
        setQuizAttemptId(res.quiz_attempt_id)
        setSections(res.quiz_json.sections || [])
        setQuizMeta({ quiz_difficulty: res.quiz_json.quiz_difficulty, estimated_minutes: res.quiz_json.estimated_minutes })
        quizStartRef.current = Date.now()
        const firstQ = res.quiz_json.sections?.[0]?.questions?.[0]
        if (firstQ) questionStartRef.current[firstQ.id] = Date.now()
      })
      .catch((e) => setError(e?.response?.data?.detail || 'Failed to generate quiz'))
      .finally(() => setLoading(false))
  }, [node])

  function selectAnswer(qid: string, optionIdx: number) {
    const start = questionStartRef.current[qid] || Date.now()
    perQuestionTimeRef.current[qid] = (Date.now() - start) / 1000

    setAnswers((a) => ({ ...a, [qid]: optionIdx }))

    // start timer for next unanswered question
    const idx = allQuestions.findIndex((q) => q.id === qid)
    const next = allQuestions[idx + 1]
    if (next && !questionStartRef.current[next.id]) {
      questionStartRef.current[next.id] = Date.now()
    }
  }

  async function handleSubmit() {
    if (!quizAttemptId) return
    setSubmitting(true)
    const totalTime = (Date.now() - quizStartRef.current) / 1000
    try {
      const res = await evaluateQuiz(quizAttemptId, answers, totalTime, perQuestionTimeRef.current)
      setResult(res)
      if (node) {
        updateNodeStatus(node.node_key, res.passed ? 'mastered' : 'available', res.mastery_score)
        if (res.passed && res.unlocked_node_keys?.length) {
          unlockNodes(res.unlocked_node_keys)
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to evaluate quiz')
    } finally {
      setSubmitting(false)
    }
  }

  if (!roadmap || !node) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold mb-3">Concept not found</h1>
          <Link to="/roadmap" className="text-cortex">Back to roadmap →</Link>
        </main>
      </div>
    )
  }

  const failedEasy = result && !result.passed && (result.section_scores?.easy ?? 1) < 1

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/roadmap" className="text-xs text-dim hover:text-myelin">← Back to roadmap</Link>
        <p className="font-mono text-xs text-cortex uppercase tracking-[0.2em] mt-3 mb-2">
          Adaptive Assessment {quizMeta.quiz_difficulty ? `· ${quizMeta.quiz_difficulty}` : ''}
        </p>
        <h1 className="font-display text-3xl font-semibold mb-1">{node.title}</h1>
        {quizMeta.estimated_minutes && (
          <p className="text-dim text-xs mb-8">~{quizMeta.estimated_minutes} min · 6 questions across easy / medium / hard sections</p>
        )}
        {!quizMeta.estimated_minutes && <div className="mb-8" />}

        {loading && <p className="text-dim">Generating personalized tiered quiz…</p>}
        {error && <p className="text-ember">{error}</p>}

        {!loading && !result && sections.map((section) => {
          const style = LEVEL_STYLES[section.level] || LEVEL_STYLES.medium
          const answeredCount = section.questions.filter((q) => answers[q.id] !== undefined).length
          return (
            <div key={section.level} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${style.badge}`}>
                  {style.label}
                </span>
                <span className="text-xs text-dim font-mono">{answeredCount}/{section.questions.length} answered</span>
              </div>
              <div className="space-y-3">
                {section.questions.map((q, i) => (
                  <div key={q.id} className="rounded-xl border border-white/5 bg-synapse/60 p-5">
                    <p className="text-sm font-medium text-myelin mb-3">{i + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                            answers[q.id] === oi ? 'border-cortex bg-cortex/10 text-myelin' : 'border-white/5 text-dim hover:border-white/15'
                          }`}
                        >
                          <input
                            type="radio" name={q.id} checked={answers[q.id] === oi}
                            onChange={() => selectAnswer(q.id, oi)}
                            className="accent-cortex"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {!loading && !result && sections.length > 0 && (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < allQuestions.length || submitting}
            className="w-full px-6 py-3.5 rounded-lg bg-cortex text-void font-medium shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Evaluating…' : 'Submit answers'}
          </button>
        )}

        {result && (
          <div className="rounded-xl border border-white/5 bg-synapse/60 p-6">
            <div className="text-center mb-4">
              <p className={`text-4xl font-display font-semibold mb-2 ${result.passed ? 'text-mastered' : 'text-ember'}`}>
                {Math.round(result.score * 100)}%
              </p>
              <p className="text-myelin font-medium">
                {result.passed ? '🎉 Concept mastered!' : failedEasy ? 'Master the fundamentals first' : 'Not quite — review recommended'}
              </p>
              {result.passed && nextNode && (
                <p className="text-xs text-cortex mt-1">Unlocked: {nextNode.title}</p>
              )}
            </div>

            {/* 3-segment section score bar */}
            {result.section_scores && (
              <div className="flex gap-1.5 mb-5">
                {LEVEL_ORDER.map((level) => {
                  const style = LEVEL_STYLES[level]
                  const pct = Math.round((result.section_scores[level] ?? 0) * 100)
                  return (
                    <div key={level} className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wide text-dim">{style.label}</span>
                        <span className="text-[10px] font-mono text-dim">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full ${style.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {failedEasy && (
              <div className="rounded-lg border border-ember/20 bg-ember/5 px-4 py-3 mb-4">
                <p className="text-sm text-ember">
                  You missed one or more <strong>easy</strong> (fundamentals) questions. Passing requires
                  100% on the easy section — review those basics below before retrying.
                </p>
              </div>
            )}

            {/* Per-question review with explanations — easy-section misses surfaced first */}
            <div className="space-y-2 mb-4">
              {[...allQuestions]
                .sort((a, b) => {
                  const aWrong = answers[a.id] !== a.correct_index
                  const bWrong = answers[b.id] !== b.correct_index
                  const aEasyMiss = a._level === 'easy' && aWrong
                  const bEasyMiss = b._level === 'easy' && bWrong
                  if (aEasyMiss !== bEasyMiss) return aEasyMiss ? -1 : 1
                  return 0
                })
                .map((q) => {
                  const userAns = answers[q.id]
                  const correct = userAns === q.correct_index
                  const style = LEVEL_STYLES[q._level] || LEVEL_STYLES.medium
                  return (
                    <div key={q.id} className={`text-xs rounded-lg p-3 border ${correct ? 'border-mastered/20 bg-mastered/5' : 'border-ember/20 bg-ember/5'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${style.badge}`}>{style.label}</span>
                        <p className="text-myelin">{q.question}</p>
                      </div>
                      <p className={correct ? 'text-mastered' : 'text-ember'}>
                        {correct ? '✓ Correct' : `✗ Your answer: ${q.options[userAns] ?? '—'} · Correct: ${q.options[q.correct_index]}`}
                      </p>
                      {result.explanations?.[q.id] && (
                        <p className="text-dim mt-1">{result.explanations[q.id]}</p>
                      )}
                    </div>
                  )
                })}
            </div>

            {!result.passed && (
              <div className="text-left space-y-3 border-t border-white/5 pt-4">
                {result.focus_areas?.length > 0 && (
                  <div>
                    <p className="text-xs text-dim uppercase tracking-wide mb-1">Focus on next</p>
                    <div className="flex flex-wrap gap-2">
                      {result.focus_areas.map((w: string, i: number) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-ember/10 text-ember">{w}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result.remediation_text && (
                  <p className="text-sm text-dim">{result.remediation_text}</p>
                )}
                {result.difficulty_adjustment && result.difficulty_adjustment !== 'maintain' && (
                  <p className="text-xs text-cortex">
                    AI Proctoring: future quizzes will {result.difficulty_adjustment} in difficulty based on your performance.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center mt-6">
              <button onClick={() => navigate('/roadmap')} className="px-5 py-2.5 rounded-lg border border-white/10 text-myelin font-medium">
                Back to roadmap
              </button>
              {!result.passed && (
                <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-lg bg-cortex text-void font-medium shadow-glow">
                  Retry quiz
                </button>
              )}
              {result.passed && nextNode && (
                <button onClick={() => navigate(`/simulation/${nextNode.node_key}`)} className="px-5 py-2.5 rounded-lg bg-cortex text-void font-medium shadow-glow">
                  Continue to next concept →
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
