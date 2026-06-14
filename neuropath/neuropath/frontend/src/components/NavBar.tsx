import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/mindmap', label: 'Mind Map' },
]

export default function NavBar() {
  const { pathname } = useLocation()
  const { fullName, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="border-b border-white/5 bg-synapse/60 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="font-display font-semibold text-lg tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cortex shadow-glow animate-pulse_slow" />
          Neuro<span className="text-cortex">Path</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to} to={l.to}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === l.to ? 'text-myelin bg-white/5' : 'text-dim hover:text-myelin hover:bg-white/5'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <div className="ml-3 flex items-center gap-3 pl-3 border-l border-white/5">
            {fullName && <span className="text-xs text-dim hidden sm:inline">{fullName}</span>}
            <button onClick={handleLogout} className="text-xs text-dim hover:text-ember transition-colors">
              Sign out
            </button>
          </div>
        </nav>
      </div>
    </header>
  )
}
