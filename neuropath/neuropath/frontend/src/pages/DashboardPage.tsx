import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import ProgressChart from '../components/ProgressChart'
import { getDashboard, getLearningPath, DashboardResponse } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'text-mastered', medium: 'text-cortex', hard: 'text-ember', adaptive: 'text-dim',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartMetric, setChartMetric] = useState<'xp_earned' | 'total_time_sec' | 'avg_score'>('xp_earned')
  const navigate = useNavigate()
  const setRoadmap = useAppStore((s) => s.setRoadmap)

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e?.response?.data?.detail || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  async function resumeCourse(learningPathId: string) {
    const roadmap = await getLearningPath(learningPathId)
    setRoadmap(roadmap)
    navigate('/roadmap')
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-7xl mx-auto px-6 py-24 text-center text-dim">Loading dashboard…</main>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-2xl mx-auto px-6 py-24 text-center">
          <p className="text-ember">{error}</p>
        </main>
      </div>
    )
  }

  const { courses, daily_progress, weekly_summary, proctoring, total_xp, streak_days } = data

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-mono text-xs text-cortex uppercase tracking-[0.2em] mb-2">Welcome back</p>
            <h1 className="font-display text-3xl font-semibold">{data.full_name}</h1>
          </div>
          <div className="flex gap-3">
            <Link to="/topic" className="px-4 py-2 rounded-lg bg-cortex text-void text-sm font-medium shadow-glow">
              + New topic
            </Link>
            <Link to="/upload" className="px-4 py-2 rounded-lg border border-white/10 text-myelin text-sm font-medium">
              + Upload book
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total XP" value={total_xp.toLocaleString()} accent="cortex" />
          <StatCard label="Streak" value={`${streak_days} day${streak_days === 1 ? '' : 's'}`} accent="ember" />
          <StatCard label="This week" value={`${weekly_summary.quizzes_passed}/${weekly_summary.quizzes_taken} passed`} accent="mastered" />
          <StatCard label="Study time (wk)" value={`${Math.round((weekly_summary.total_time_sec || 0) / 60)}m`} accent="cortex" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Progress chart */}
          <div className="lg:col-span-2 rounded-xl border border-white/5 bg-synapse/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Daily progress</h2>
              <div className="flex gap-1">
                {(['xp_earned', 'total_time_sec', 'avg_score'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMetric(m)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      chartMetric === m ? 'bg-cortex text-void' : 'text-dim hover:text-myelin'
                    }`}
                  >
                    {m === 'xp_earned' ? 'XP' : m === 'total_time_sec' ? 'Time' : 'Score'}
                  </button>
                ))}
              </div>
            </div>
            <ProgressChart data={daily_progress.slice(-21)} metric={chartMetric} />
            <p className="text-xs text-dim mt-2">Last {Math.min(daily_progress.length, 21)} active days</p>
          </div>

          {/* AI Proctoring panel */}
          <div className="rounded-xl border border-white/5 bg-synapse/60 p-6">
            <h2 className="font-display text-lg font-semibold mb-3">AI Proctoring</h2>
            {proctoring.insight && (
              <p className="text-sm text-cortex mb-4 italic">"{proctoring.insight}"</p>
            )}
            <div className="space-y-3 text-sm">
              <Row label="Correct rate" value={`${Math.round(proctoring.correct_rate * 100)}%`} />
              <Row label="Avg quiz time" value={proctoring.avg_quiz_time ? `${Math.round(proctoring.avg_quiz_time)}s/question` : '—'} />
              <Row label="Avg reading time" value={proctoring.avg_reading_speed ? `${Math.round(proctoring.avg_reading_speed)}s/concept` : '—'} />
              <Row label="Consistency" value={`${Math.round(proctoring.consistency_score * 100)}%`} />
              <Row label="Difficulty" value={
                <span className={`capitalize font-medium ${DIFFICULTY_COLOR[proctoring.preferred_difficulty] || 'text-myelin'}`}>
                  {proctoring.preferred_difficulty}
                </span>
              } />
              <Row label="Roadmap re-routes" value={String(proctoring.roadmap_adjustments)} />
            </div>

            {proctoring.strength_tags.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-dim uppercase tracking-wide mb-1.5">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {proctoring.strength_tags.slice(0, 6).map((t, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-mastered/10 text-mastered">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {proctoring.weakness_tags.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-dim uppercase tracking-wide mb-1.5">Focus areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {proctoring.weakness_tags.slice(0, 6).map((t, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-ember/10 text-ember">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Courses */}
        <div>
          <h2 className="font-display text-lg font-semibold mb-3">Your courses</h2>
          {courses.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-synapse/60 p-10 text-center">
              <p className="text-dim mb-4">No courses yet. Start your first learning path.</p>
              <div className="flex gap-3 justify-center">
                <Link to="/topic" className="px-4 py-2 rounded-lg bg-cortex text-void text-sm font-medium">Teach me a topic</Link>
                <Link to="/upload" className="px-4 py-2 rounded-lg border border-white/10 text-myelin text-sm font-medium">Upload a textbook</Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((c) => (
                <button
                  key={c.learning_path_id}
                  onClick={() => resumeCourse(c.learning_path_id)}
                  className="text-left rounded-xl border border-white/5 bg-synapse/60 p-5 hover:border-cortex/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-dim uppercase">{c.source_type}</span>
                    <span className={`text-xs capitalize ${DIFFICULTY_COLOR[c.difficulty_level] || 'text-dim'}`}>{c.difficulty_level}</span>
                  </div>
                  <p className="font-display font-semibold mb-1 line-clamp-2">{c.title}</p>
                  <p className="text-xs text-dim mb-3">{c.current_node_title ? `Next: ${c.current_node_title}` : 'Not started'}</p>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1">
                    <div className="h-full bg-cortex" style={{ width: `${c.progress_percent}%` }} />
                  </div>
                  <p className="text-xs text-dim font-mono">{c.mastered_nodes}/{c.total_nodes} mastered · {c.progress_percent}%</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const ACCENT_CLASS: Record<string, string> = {
  cortex: 'text-cortex',
  ember: 'text-ember',
  mastered: 'text-mastered',
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-synapse/60 p-4">
      <p className="text-xs text-dim mb-1">{label}</p>
      <p className={`font-display text-2xl font-semibold ${ACCENT_CLASS[accent] || 'text-myelin'}`}>{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dim">{label}</span>
      <span className="font-mono text-myelin">{value}</span>
    </div>
  )
}
