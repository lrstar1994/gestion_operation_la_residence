import { useEffect, useState } from 'react'
import {
  Building2,
  CalendarDays,
  DoorOpen,
  History,
  Home,
  ClipboardCheck,
  Sparkles,
  Repeat,
  LogOut,
  MapPin,
  Menu,
  ListChecks,
  UserRoundCog,
  Users,
  Wrench,
  CalendarClock,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { compterMouvementsBloques } from '../api/suiviOperationnel'
import { useAuth } from '../hooks/useAuth'

export function Sidebar() {
  const { profil, estAdmin, peutAccederAuDomaine, deconnecter } = useAuth()
  const [menuOuvert, setMenuOuvert] = useState(false)
  const [bloquesAujourdhui, setBloquesAujourdhui] = useState(0)
  const location = useLocation()

  const peutVoirExecutants = estAdmin() || peutAccederAuDomaine('chambres') || peutAccederAuDomaine('salles')
  const peutVoirPlanning = true
  const peutVoirTachesPeriodiques = estAdmin() || peutAccederAuDomaine('chambres') || peutAccederAuDomaine('salles')
  const peutVoirPlanningChambres = peutAccederAuDomaine('chambres')
  const peutVoirMaintenance = peutAccederAuDomaine('maintenance')

  useEffect(() => {
    setMenuOuvert(false)
  }, [location.pathname])

  useEffect(() => {
    if (!peutVoirPlanningChambres) return

    const chargerBloques = async () => {
      try {
        setBloquesAujourdhui(await compterMouvementsBloques(formatDateInput(new Date())))
      } catch {
        setBloquesAujourdhui(0)
      }
    }

    void chargerBloques()
    const interval = window.setInterval(() => void chargerBloques(), 120000)
    return () => window.clearInterval(interval)
  }, [peutVoirPlanningChambres])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm lg:hidden">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-teal-700">La Residence</p>
          <h1 className="truncate text-base font-bold text-slate-950">Gestion hoteliere</h1>
        </div>
        <button
          type="button"
          onClick={() => setMenuOuvert((ouvert) => !ouvert)}
          className="flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
          aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOuvert}
        >
          {menuOuvert ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOuvert && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden"
          onClick={() => setMenuOuvert(false)}
          aria-label="Fermer le menu"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:min-h-screen lg:w-72 lg:translate-x-0 lg:shadow-none',
          menuOuvert ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent
          peutVoirExecutants={peutVoirExecutants}
          peutVoirPlanning={peutVoirPlanning}
          peutVoirTachesPeriodiques={peutVoirTachesPeriodiques}
          peutVoirPlanningChambres={peutVoirPlanningChambres}
          peutVoirMaintenance={peutVoirMaintenance}
          bloquesAujourdhui={bloquesAujourdhui}
          estAdmin={estAdmin()}
          nom={profil?.nom}
          email={profil?.email}
          onDeconnexion={() => void deconnecter()}
        />
      </aside>
    </>
  )
}

function SidebarContent({
  liensVisibles,
  peutVoirExecutants,
  peutVoirPlanning,
  peutVoirTachesPeriodiques,
  peutVoirPlanningChambres,
  peutVoirMaintenance,
  bloquesAujourdhui,
  estAdmin,
  nom,
  email,
  onDeconnexion,
}: {
  peutVoirExecutants: boolean
  peutVoirPlanning: boolean
  peutVoirTachesPeriodiques: boolean
  peutVoirPlanningChambres: boolean
  peutVoirMaintenance: boolean
  bloquesAujourdhui: number
  estAdmin: boolean
  nom?: string
  email?: string
  onDeconnexion: () => void
}) {
  return (
    <>
      <div className="mb-8 px-2">
        <p className="text-xs font-semibold uppercase text-teal-700">La Residence</p>
        <h1 className="mt-1 text-xl font-bold text-slate-950">Gestion hoteliere</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        <MenuLink to="/" icon={Home} label="Tableau de bord" />

        {peutVoirPlanning && <MenuLink to="/planning" icon={CalendarDays} label="Planning du personnel" />}
        {peutVoirTachesPeriodiques && <MenuLink to="/taches-periodiques" icon={Repeat} label="Taches periodiques" />}
        {peutVoirMaintenance && <MenuLink to="/interventions-maintenance" icon={Wrench} label="Interventions" />}
        {estAdmin && <MenuLink to="/historique-interventions" icon={History} label="Historique interventions" />}
        {peutVoirPlanningChambres && <MenuLink to="/planning-chambres" icon={DoorOpen} label="Planning chambres" />}
        {peutVoirPlanningChambres && <MenuLink to="/historique-planning-chambres" icon={CalendarClock} label="Historique chambres" />}
        {peutVoirPlanningChambres && <MenuLink to="/menages-chambres" icon={Sparkles} label="Menages chambres" />}
        {peutVoirPlanningChambres && <MenuLink to="/suivi-operationnel" icon={ClipboardCheck} label="Suivi operationnel" badge={bloquesAujourdhui} />}
        <MenuLink to="/lieux" icon={MapPin} label="Lieux" />
        {peutVoirExecutants && <MenuLink to="/executants" icon={UserRoundCog} label="Executants" />}
        {estAdmin && <MenuLink to="/types-mouvement" icon={ListChecks} label="Types mouvement" />}
        {estAdmin && <MenuLink to="/users" icon={Users} label="Utilisateurs" />}
      </nav>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="mb-3 px-2">
          <p className="truncate text-sm font-semibold text-slate-900">{nom}</p>
          <p className="truncate text-xs text-slate-500">{email}</p>
        </div>
        <button
          type="button"
          onClick={onDeconnexion}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Deconnexion
        </button>
      </div>
    </>
  )
}

function MenuLink({
  to,
  icon: Icon,
  label,
  badge = 0,
}: {
  to: string
  icon: LucideIcon
  label: string
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
          isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
        ].join(' ')
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      {badge > 0 && <span className="ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{badge}</span>}
    </NavLink>
  )
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}
