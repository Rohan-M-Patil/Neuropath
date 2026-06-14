import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { useAppStore } from '../store/useAppStore'
import { generateSimulation, recordSimulationViewed } from '../lib/api'
import GraphAlgorithmSim from '../components/sims/GraphAlgorithmSim'
import SortingSim from '../components/sims/SortingSim'
import MathPhysicsSim from '../components/sims/MathPhysicsSim'
import NeuralNetworkSim from '../components/sims/NeuralNetworkSim'
import DataStructuresSim from '../components/sims/DataStructuresSim'
import SystemArchitectureSim from '../components/sims/SystemArchitectureSim'
import ProbabilityStatsSim from '../components/sims/ProbabilityStatsSim'
import GenericSim from '../components/sims/GenericSim'
import ComparisonSim from '../components/sims/ComparisonSim'
import TimelineSim from '../components/sims/TimelineSim'
import StateMachineSim from '../components/sims/StateMachineSim'

export default function SimulationPage() {
  const { nodeId } = useParams()
  const { roadmap } = useAppStore()
  const [sim, setSim] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const node = roadmap?.nodes.find((n) => n.node_key === nodeId)

  useEffect(() => {
    if (!node) return
    startTimeRef.current = Date.now()

    const inline = roadmap?.simulations.find((s) => s.node_key === node.node_key)
    if (inline) {
      setSim(inline)
      setLoading(false)
    } else {
      generateSimulation(node.id)
        .then((res) => setSim({ ...res, node_key: node.node_key }))
        .catch(() => setError('Simulation data not available for this concept.'))
        .finally(() => setLoading(false))
    }

    // AI Proctoring: record time spent viewing simulation on unmount
    return () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      if (elapsed > 1) {
        recordSimulationViewed(node.id, elapsed).catch(() => {})
      }
    }
  }, [node])

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

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/roadmap" className="text-xs text-dim hover:text-myelin">← Back to roadmap</Link>
        <p className="font-mono text-xs text-cortex uppercase tracking-[0.2em] mt-3 mb-2">
          3D Interactive Simulation
        </p>
        <h1 className="font-display text-3xl font-semibold mb-1">{node.title}</h1>
        <p className="text-dim text-sm mb-2">{node.description}</p>
        {sim?.description && <p className="text-cortex text-sm mb-8">{sim.description}</p>}
        {!sim?.description && <div className="mb-8" />}

        {loading && <p className="text-dim">Loading simulation…</p>}
        {error && <p className="text-ember">{error}</p>}

        {sim?.config_json?.learning_focus && (
          <div className="rounded-lg border border-cortex/20 bg-cortex/5 px-4 py-3 mb-4">
            <p className="text-xs text-dim uppercase tracking-wide mb-1">What to look for</p>
            <p className="text-sm text-cortex">{sim.config_json.learning_focus}</p>
          </div>
        )}

        {sim && sim.template_type === 'graph_algorithms' && <GraphAlgorithmSim config={sim.config_json} />}
        {sim && sim.template_type === 'sorting' && <SortingSim config={sim.config_json} />}
        {sim && sim.template_type === 'math_physics' && <MathPhysicsSim config={sim.config_json} />}
        {sim && sim.template_type === 'neural_network' && <NeuralNetworkSim config={sim.config_json} />}
        {sim && sim.template_type === 'data_structures' && <DataStructuresSim config={sim.config_json} />}
        {sim && sim.template_type === 'system_architecture' && <SystemArchitectureSim config={sim.config_json} />}
        {sim && sim.template_type === 'probability_stats' && <ProbabilityStatsSim config={sim.config_json} />}
        {sim && sim.template_type === 'comparison_3d' && <ComparisonSim config={sim.config_json} />}
        {sim && sim.template_type === 'timeline_3d' && <TimelineSim config={sim.config_json} />}
        {sim && sim.template_type === 'state_machine_3d' && <StateMachineSim config={sim.config_json} />}
        {sim && sim.template_type === 'generic_3d' && <GenericSim config={sim.config_json} />}

        <div className="mt-8">
          <Link
            to={`/quiz/${node.node_key}`}
            className="px-5 py-2.5 rounded-lg bg-cortex text-void font-medium shadow-glow"
          >
            Take quiz on this concept →
          </Link>
        </div>
      </main>
    </div>
  )
}
