import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { useDashboardStore } from '../store/useDashboardStore'

const CORRECT_PASSWORD = 'diego2026'

export function LoginPage() {
  const { setAuthenticated } = useDashboardStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    await new Promise(r => setTimeout(r, 300))

    if (password === CORRECT_PASSWORD) {
      localStorage.setItem('control_tower_auth', 'true')
      setAuthenticated(true)
    } else {
      setError('Password errata')
      setPassword('')
    }

    setLoading(false)
  }

  return (
    <div className="w-full h-screen bg-gradient-to-br from-[#0a0a0b] via-[#1a1a2e] to-[#0a0a0b] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-[#1a1a1e]/80 backdrop-blur-xl border-2 border-zinc-700 rounded-2xl p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-electric/20 border-2 border-electric flex items-center justify-center mb-4">
              <Lock size={32} className="text-electric" />
            </div>
            <h1 className="text-3xl font-bold text-white">Control Tower</h1>
            <p className="text-base text-zinc-400 mt-2">Accesso Protetto</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Inserisci password"
                className="w-full bg-[#0a0a0b] border-2 border-zinc-700 rounded-lg px-4 py-3 text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-electric transition-colors"
                disabled={loading}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-electric hover:bg-electric/90 disabled:bg-electric/50 text-white font-semibold py-3 rounded-lg transition-colors text-base"
            >
              {loading ? 'Verifica in corso…' : 'Accedi'}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-zinc-500 mt-6">
            Applicazione riservata a Diego Avorio
          </p>
        </div>
      </motion.div>
    </div>
  )
}
