import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { generateRoadmap } from '../lib/api'
import { useAppStore } from '../store/useAppStore'

const EXAMPLES = [
  'Teach me Reinforcement Learning',
  'Teach me Kubernetes',
  'Teach me Graph Theory',
  'Teach me Linear Algebra',
]

export default function TopicInputPage() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setRoadmap } = useAppStore()

  async function handleGenerate() {
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    try {
      const roadmap = await generateRoadmap({ mode: 'topic', topic })
      setRoadmap(roadmap)
      navigate('/roadmap')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to generate roadmap. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-2xl mx-auto px-6 py-20">
        <p className="font-mono text-xs text-cortex uppercase tracking-[0.2em] mb-3">
          Flow A — General Topic Mode
        </p>
        <h1 className="font-display text-4xl font-semibold mb-3">What do you want to learn?</h1>
        <p className="text-dim mb-8">
          The Knowledge Source Agent will detect there's no document and route
          this to the Curriculum Agent, which builds a prerequisite concept DAG.
        </p>

        <div className="relative">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="e.g. Teach me Reinforcement Learning"
            className="w-full bg-synapse border border-white/10 rounded-lg px-4 py-3.5 text-myelin placeholder:text-dim focus:outline-none focus:border-cortex transition-colors"
            autoFocus
          />
        </div>

        <div className="flex flex-wrap gap-2 mt-4 mb-8">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setTopic(ex)}
              className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-dim hover:text-myelin hover:border-white/20 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-ember mb-4">{error}</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={!topic.trim() || loading}
          className="w-full px-6 py-3.5 rounded-lg bg-cortex text-void font-medium shadow-glow hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
              Agents are building your roadmap…
            </>
          ) : (
            'Generate learning roadmap'
          )}
        </button>
      </main>
    </div>
  )
}
