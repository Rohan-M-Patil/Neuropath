import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import AgentActivityPanel from '../components/AgentActivityPanel'
import DAGGraph from '../components/DAGGraph'
import MarkdownContent from '../components/MarkdownContent'
import { useAppStore } from '../store/useAppStore'
import { recordContentViewed } from '../lib/api'

const STATUS_LABEL: Record<string, string> = {
  mastered: 'Mastered', available: 'Available', in_progress: 'In progress', locked: 'Locked',
}

export default function RoadmapPage() {
  const { roadmap, selectedNode, setSelectedNode } = useAppStore()
  const navigate = useNavigate()
  const [learnOpen, setLearnOpen] = useState(false)
  const learnStartRef = useRef<number | null>(null)

  // AI Proctoring: track time spent reading lesson content (content_md).
  // Starts a timer when the Learn panel opens, records elapsed time when it
  // closes, the selected node changes, or the page unmounts.
  function flushContentTimer(nodeId?: string) {
    if (learnStartRef.current && nodeId) {
      const elapsed = (Date.now() - learnStartRef.current) / 1000
      if (elapsed > 1) recordContentViewed(nodeId, elapsed).catch(() => {})
    }
    learnStartRef.current = null
  }

  useEffect(() => {
    return () => flushContentTimer(selectedNode?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectNode(n: typeof selectedNode) {
    flushContentTimer(selectedNode?.id)
    setLearnOpen(false)
    setSelectedNode(n)
  }

  function toggleLearn() {
    if (!learnOpen) {
      learnStartRef.current = Date.now()
      setLearnOpen(true)
    } else {
      flushContentTimer(selectedNode?.id)
      setLearnOpen(false)
    }
  }

  if (!roadmap) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h1 className="font-display text-3xl font-semibold mb-3">No roadmap generated</h1>
          <Link to="/topic" className="text-cortex">Generate one →</Link>
        </main>
      </div>
    )
  }

  const seqOrder = roadmap.sequential_order || []
  const nodesByKey = Object.fromEntries(roadmap.nodes.map((n) => [n.node_key, n]))

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-6">
          <p className="font-mono text-xs text-cortex uppercase tracking-[0.2em] mb-2">Sequential Concept DAG</p>
          <h1 className="font-display text-3xl font-semibold mb-1">{roadmap.title}</h1>
          <p className="text-dim text-sm">
            Concepts unlock in order — master each one to advance. Click a concept to view details.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Sequential progress rail */}
            <div className="rounded-xl border border-white/5 bg-synapse/60 p-4 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {seqOrder.map((key, i) => {
                  const n = nodesByKey[key]
                  if (!n) return null
                  const color = n.status === 'mastered' ? 'bg-mastered'
                    : n.status === 'available' || n.status === 'in_progress' ? 'bg-cortex'
                    : 'bg-dim/30'
                  return (
                    <div key={key} className="flex items-center">
                      <button
                        onClick={() => selectNode(n)}
                        className={`flex flex-col items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                          selectedNode?.node_key === key ? 'bg-white/5' : 'hover:bg-white/5'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${color}`} />
                        <span className="text-[10px] text-dim font-mono">{i + 1}</span>
                      </button>
                      {i < seqOrder.length - 1 && <span className="w-6 h-px bg-white/10" />}
                    </div>
                  )
                })}
              </div>
            </div>

            <DAGGraph
              nodes={roadmap.nodes}
              edges={roadmap.edges}
              onSelect={selectNode}
              selectedKey={selectedNode?.node_key}
            />

            <div className="flex items-center gap-4 text-xs text-dim font-mono">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-mastered inline-block" /> Mastered</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cortex inline-block" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FFC95C' }} /> In progress</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-dim/40 inline-block" /> Locked</span>
            </div>

            {selectedNode && (
              <div className="rounded-xl border border-white/5 bg-synapse/60 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-xs text-dim mb-1">
                      Step {selectedNode.sequential_position} of {seqOrder.length} · {selectedNode.node_key} · difficulty {selectedNode.difficulty}/5
                    </p>
                    <h2 className="font-display text-xl font-semibold">{selectedNode.title}</h2>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-dim capitalize whitespace-nowrap">
                    {STATUS_LABEL[selectedNode.status]}
                  </span>
                </div>
                <p className="text-sm text-dim mb-4">{selectedNode.description}</p>

                {selectedNode.mastery_score > 0 && (
                  <p className="text-xs text-mastered font-mono mb-3">
                    Last score: {Math.round(selectedNode.mastery_score * 100)}%
                  </p>
                )}

                {selectedNode.chapter_reference && (
                  <p className="text-xs text-cortex font-mono mb-4">📖 {selectedNode.chapter_reference}</p>
                )}

                {selectedNode.key_skills?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-dim uppercase tracking-wide mb-1.5">Key skills</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedNode.key_skills.map((s, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-dim">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNode.prerequisites.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-dim uppercase tracking-wide mb-1.5">Prerequisites</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedNode.prerequisites.map((p) => (
                        <span key={p} className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-dim">
                          {nodesByKey[p]?.title || p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNode.status === 'locked' ? (
                  <p className="text-xs text-dim italic mt-4">
                    Complete the previous concept to unlock this one.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-3 mt-4 flex-wrap">
                      <button
                        onClick={toggleLearn}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          learnOpen
                            ? 'bg-cortex text-void shadow-glow'
                            : 'border border-white/10 hover:bg-white/5'
                        }`}
                      >
                        {learnOpen ? 'Hide lesson' : '📖 Learn'}
                      </button>
                      <button
                        onClick={() => navigate(`/simulation/${selectedNode.node_key}`)}
                        className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
                      >
                        🧪 Simulate
                      </button>
                      <button
                        onClick={() => navigate(`/quiz/${selectedNode.node_key}`)}
                        className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium hover:bg-white/5 transition-colors"
                      >
                        📝 {selectedNode.status === 'mastered' ? 'Retake quiz' : 'Take quiz'}
                      </button>
                    </div>

                    {learnOpen && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <MarkdownContent content={selectedNode.content_md || ''} />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <AgentActivityPanel logs={roadmap.agent_logs} />
        </div>
      </main>
    </div>
  )
}
