import { DailyProgressOut } from '../lib/api'

export default function ProgressChart({ data, metric }: { data: DailyProgressOut[]; metric: 'xp_earned' | 'total_time_sec' | 'avg_score' }) {
  if (data.length === 0) {
    return <p className="text-xs text-dim italic py-8 text-center">No activity recorded yet — complete a quiz to see your progress.</p>
  }

  const values = data.map((d) => d[metric])
  const max = Math.max(...values, 1)

  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => {
        const h = Math.max((d[metric] / max) * 100, 2)
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div
              className="w-full rounded-t-sm bg-cortex/70 group-hover:bg-cortex transition-colors"
              style={{ height: `${h}%` }}
            />
            <div className="absolute -top-7 hidden group-hover:flex bg-void border border-white/10 rounded px-2 py-1 text-[10px] text-myelin whitespace-nowrap z-10">
              {d.date.slice(5)}: {metric === 'avg_score' ? `${Math.round(d[metric] * 100)}%` : metric === 'total_time_sec' ? `${Math.round(d[metric] / 60)}m` : d[metric]}
            </div>
          </div>
        )
      })}
    </div>
  )
}
