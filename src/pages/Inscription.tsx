import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { inscrireUtilisateur } from '../api/auth'

export function Inscription() {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [soumission, setSoumission] = useState(false)
  const navigate = useNavigate()

  async function gererInscription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (nom.trim().length < 2) {
      toast.error('Le nom doit contenir au moins 2 caracteres.')
      return
    }

    if (!email.includes('@')) {
      toast.error('Veuillez renseigner un email valide.')
      return
    }

    if (motDePasse.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caracteres.')
      return
    }

    setSoumission(true)

    try {
      await inscrireUtilisateur({ nom: nom.trim(), email: email.trim(), motDePasse })
      toast.success("Compte cree, en attente de validation par l'admin.")
      navigate('/connexion')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inscription impossible.")
    } finally {
      setSoumission(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={gererInscription} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <UserPlus className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Inscription</h1>
          <p className="mt-1 text-sm text-slate-500">Votre compte sera valide par un administrateur.</p>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Nom</span>
          <input
            type="text"
            value={nom}
            onChange={(event) => setNom(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            autoComplete="name"
          />
        </label>

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
            autoComplete="new-password"
          />
        </label>

        <button
          type="submit"
          disabled={soumission}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UserPlus className="h-4 w-4" />
          {soumission ? 'Creation...' : 'Creer le compte'}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500">
          Deja un compte ?{' '}
          <Link to="/connexion" className="font-semibold text-teal-700 hover:text-teal-800">
            Connexion
          </Link>
        </p>
      </form>
    </main>
  )
}
