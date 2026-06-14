import { AgentLog } from '../lib/api'

const AGENT_COLORS: Record<string, string> = {
  KnowledgeSourceAgent: 'bg-cortex',
  CurriculumAgent: 'bg-ember',
  SimulationAgent: 'bg-mastered',
  AssessmentAgent: 'bg-yellow-400',
  MindMapAgent: 'bg-purple-400',
  FeedbackAgent: 'bg-pink-400',
}

export default function AgentActivityPanel({ logs }: { logs: AgentLog[] }) {
  return (
    <div className="rounded-xl border border-white/5 bg-synapse/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold text-myelin">Agent Activity</h3>
        <span className="text-xs text-dim font-mono">{logs.length} events</span>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {logs.length === 0 && (
          <p className="text-xs text-dim italic">No agent activity yet.</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-2.5 text-xs">
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                AGENT_COLORS[log.agent_name] || 'bg-dim'
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-myelin">{log.agent_name}</span>
                {log.duration_ms != null && (
                  <span className="font-mono text-dim flex-shrink-0">{log.duration_ms}ms</span>
                )}
              </div>
              <p className="text-dim truncate">{log.action.replaceAll('_', ' ')}</p>
              {log.output_summary && (
                <p className="text-dim/70 font-mono truncate">{log.output_summary}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
