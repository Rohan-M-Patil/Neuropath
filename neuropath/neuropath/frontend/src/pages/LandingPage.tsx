import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 h-16 flex items-center justify-between max-w-7xl mx-auto w-full">
        <span className="font-display font-semibold text-lg tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cortex shadow-glow animate-pulse_slow" />
          Neuro<span className="text-cortex">Path</span>
        </span>
        <Link
          to="/login"
          className="text-sm text-dim hover:text-myelin transition-colors"
        >
          Sign in →
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
        {/* Synaptic background graphic */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.15] pointer-events-none"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
        >
          {[...Array(8)].map((_, i) => (
            <line
              key={i}
              x1={100 + i * 130}
              y1={50}
              x2={600 + (i % 3) * 120}
              y2={750}
              stroke="#7C9CFF"
              strokeWidth="1"
              className="synapse-line"
            />
          ))}
          {[...Array(14)].map((_, i) => (
            <circle
              key={`n${i}`}
              cx={80 + (i * 83) % 1150}
              cy={60 + (i * 137) % 720}
              r={i % 3 === 0 ? 4 : 2}
              fill={i % 4 === 0 ? '#FF7A45' : '#7C9CFF'}
            />
          ))}
        </svg>

        <div className="relative z-10 max-w-3xl">
          <p className="font-mono text-xs text-cortex uppercase tracking-[0.2em] mb-4">
            Agentic &amp; Autonomous Systems
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.05] mb-6">
            Your learning,
            <br />
            <span className="text-cortex">re-routed</span> by AI agents.
          </h1>
          <p className="text-dim text-lg max-w-xl mx-auto mb-10">
            NeuroPath turns any topic — or any textbook — into a living concept
            map, complete with simulations, adaptive quizzes, and a six-agent
            crew that re-plans your path the moment you stumble.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/login"
              className="px-6 py-3 rounded-lg bg-cortex text-void font-medium shadow-glow hover:brightness-110 transition-all"
            >
              Teach me a topic
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-lg border border-white/10 text-myelin font-medium hover:bg-white/5 transition-colors"
            >
              Upload a textbook
            </Link>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-dim py-6 font-mono">
        Knowledge Source · Curriculum · Simulation · Assessment · Mind Map · Feedback
      </footer>
    </div>
  )
}
