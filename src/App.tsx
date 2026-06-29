import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Sidebar } from './components/Sidebar'
import { AuthProvider } from './hooks/useAuth'
import { Connexion } from './pages/Connexion'
import { GestionExecutants } from './pages/GestionExecutants'
import { GestionLieux } from './pages/GestionLieux'
import { GestionTypesMouvement } from './pages/GestionTypesMouvement'
import { GestionUtilisateurs } from './pages/GestionUtilisateurs'
import { Inscription } from './pages/Inscription'
import { InterventionsMaintenance } from './pages/InterventionsMaintenance'
import { PageDomaine } from './pages/PageDomaine'
import { PlanningChambres } from './pages/PlanningChambres'
import { PlanningHebdomadaire } from './pages/PlanningHebdomadaire'
import { SuiviOperational } from './pages/SuiviOperational'
import { TableauDeBord } from './pages/TableauDeBord'
import { TachesPeriodiques } from './pages/TachesPeriodiques'

function LayoutPrive() {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-6 pt-20 sm:px-5 lg:p-6">
        <Routes>
          <Route index element={<TableauDeBord />} />
          <Route element={<ProtectedRoute domaine="maintenance" />}>
            <Route path="maintenance" element={<PageDomaine domaine="maintenance" />} />
            <Route path="interventions-maintenance" element={<InterventionsMaintenance />} />
          </Route>
          <Route element={<ProtectedRoute domaine="chambres" />}>
            <Route path="chambres" element={<PageDomaine domaine="chambres" />} />
          </Route>
          <Route element={<ProtectedRoute domaine="salles" />}>
            <Route path="salles" element={<PageDomaine domaine="salles" />} />
          </Route>
          <Route element={<ProtectedRoute domaines={['chambres', 'salles']} />}>
            <Route path="executants" element={<GestionExecutants />} />
          </Route>
          <Route path="lieux" element={<GestionLieux />} />
          <Route path="planning" element={<PlanningHebdomadaire />} />
          <Route element={<ProtectedRoute domaines={['chambres', 'salles']} />}>
            <Route path="taches-periodiques" element={<TachesPeriodiques />} />
          </Route>
          <Route element={<ProtectedRoute domaine="chambres" />}>
            <Route path="planning-chambres" element={<PlanningChambres />} />
            <Route path="suivi-operationnel" element={<SuiviOperational />} />
          </Route>
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="users" element={<GestionUtilisateurs />} />
            <Route path="types-mouvement" element={<GestionTypesMouvement />} />
            <Route path="admin" element={<TableauDeBord />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/inscription" element={<Inscription />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<LayoutPrive />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
