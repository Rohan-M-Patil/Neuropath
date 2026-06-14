import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await login(email, password)
      setAuth(res.access_token, res.user_id, res.full_name, res.email)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display font-semibold text-lg tracking-tight flex items-center gap-2 mb-10 justify-center">
          <span className="w-2 h-2 rounded-full bg-cortex shadow-glow animate-pulse_slow" />
          Neuro<span className="text-cortex">Path</span>
        </Link>

        <h1 className="font-display text-2xl font-semibold mb-1 text-center">Welcome back</h1>
        <p className="text-dim text-sm text-center mb-8">Sign in to continue your learning path</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-synapse border border-white/10 rounded-lg px-4 py-3 text-myelin placeholder:text-dim focus:outline-none focus:border-cortex transition-colors"
          />
          <input
            type="password" required placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-synapse border border-white/10 rounded-lg px-4 py-3 text-myelin placeholder:text-dim focus:outline-none focus:border-cortex transition-colors"
          />
          {error && <p className="text-sm text-ember">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full px-6 py-3 rounded-lg bg-cortex text-void font-medium shadow-glow hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-dim mt-6">
          No account? <Link to="/signup" className="text-cortex">Create one</Link>
        </p>
      </div>
    </div>
  )
}
