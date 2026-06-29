import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { DomaineOperation } from '../api/auth'
import { useAuth } from '../hooks/useAuth'

type ProtectedRouteProps = {
  adminOnly?: boolean
  domaine?: DomaineOperation
  domaines?: DomaineOperation[]
}

export function ProtectedRoute({ adminOnly = false, domaine, domaines }: ProtectedRouteProps) {
  const { session, profil, chargement, estAdmin, peutAccederAuDomaine } = useAuth()
  const location = useLocation()

  if (chargement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Chargement...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/connexion" state={{ from: location }} replace />
  }

  if (!profil || profil.statut !== 1) {
    return <Navigate to="/connexion" replace />
  }

  if (adminOnly && !estAdmin()) {
    return <Navigate to="/" replace />
  }

  if (domaine && !peutAccederAuDomaine(domaine)) {
    return <Navigate to="/" replace />
  }

  if (domaines && !domaines.some((item) => peutAccederAuDomaine(item))) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
