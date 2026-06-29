import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogIn } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function Connexion() {
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [soumission, setSoumission] = useState(false)
  const { connecter, session, profil, chargement } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  if (!chargement && session && profil?.statut === 1) {
    return <Navigate to="/" replace />
  }

  async function gererConnexion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !motDePasse) {
      toast.error('Veuillez renseigner votre email et votre mot de passe.')
      return
    }

    setSoumission(true)

    try {
      await connecter(email.trim(), motDePasse)
      toast.success('Connexion reussie.')
      navigate(from, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Connexion impossible.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={gererConnexion} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <LogIn className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Connexion</h1>
          <p className="mt-1 text-sm text-slate-500">Accedez a votre espace de gestion.</p>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            autoComplete="email"
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</span>
          <input
            type="password"
            value={motDePasse}
            onChange={(event) => setMotDePasse(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            autoComplete="current-password"
          />
        </label>

        <button
          type="submit"
          disabled={soumission}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {soumission ? 'Connexion...' : 'Se connecter'}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500">
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="font-semibold text-teal-700 hover:text-teal-800">
            Inscription
          </Link>
        </p>
      </form>
    </main>
  )
}
