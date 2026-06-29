import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  Loader2,
  RefreshCcw,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import { listerInterventionsMaintenance, type InterventionMaintenance } from '../api/interventionsMaintenance'
import { listerLieux, type Lieu } from '../api/lieux'
import { listerHistoriqueTachesPeriodiques, listerPlanningTachesPeriodiques, type TachePeriodiqueHistorique, type TachePeriodiquePlanning } from '../api/tachesPeriodiques'
import { listerMouvementsSuivi } from '../api/suiviOperationnel'
import { useAuth } from '../hooks/useAuth'
import { calculerCharges, type ChargeExecutant, type PlanningChambre } from '../api/planningChambre'

type Activite = {
  id: string
  date: string
  action: string
  detail: string
  statut: string
}

export function TableauDeBord() {
  const { profil, estAdmin } = useAuth()
  const [mouvements, setMouvements] = useState<PlanningChambre[]>([])
  const [interventions, setInterventions] = useState<InterventionMaintenance[]>([])
  const [taches, setTaches] = useState<TachePeriodiquePlanning[]>([])
  const [historiqueTaches, setHistoriqueTaches] = useState<TachePeriodiqueHistorique[]>([])
  const [lieux, setLieux] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [chargement, setChargement] = useState(true)
  const [rafraichissement, setRafraichissement] = useState(false)

  const aujourdHui = formatDateInput(new Date())

  const charger = useCallback(async (silencieux = false) => {
    if (silencieux) setRafraichissement(true)
    else setChargement(true)

    try {
      const [mouvementsResultat, interventionsResultat, tachesResultat, historiqueTachesResultat, lieuxResultat, executantsResultat] = await Promise.all([
        listerMouvementsSuivi(aujourdHui),
        listerInterventionsMaintenance(),
        listerPlanningTachesPeriodiques(),
        listerHistoriqueTachesPeriodiques(),
        listerLieux(),
        listerExecutants(),
      ])

      setMouvements(mouvementsResultat)
      setInterventions(interventionsResultat)
      setTaches(tachesResultat)
      setHistoriqueTaches(historiqueTachesResultat)
      setLieux(lieuxResultat)
      setExecutants(executantsResultat)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tableau de bord impossible a charger.')
    } finally {
      setChargement(false)
      setRafraichissement(false)
    }
  }, [aujourdHui])

  useEffect(() => {
    void charger()
  }, [charger])

  useEffect(() => {
    const interval = window.setInterval(() => void charger(true), 30000)
    return () => window.clearInterval(interval)
  }, [charger])

  const chambres = useMemo(() => lieux.filter((lieu) => lieu.categorie?.code === 'chambre'), [lieux])
  const chambresPlanifiees = useMemo(() => new Set(mouvements.map((mouvement) => mouvement.id_lieu)), [mouvements])
  const occupation = chambres.length ? Math.round((chambresPlanifiees.size / chambres.length) * 100) : 0

  const repartitionEtats = useMemo(() => compterParEtat(mouvements), [mouvements])
  const mouvementsTermines = repartitionEtats.TERMINE || 0
  const avancement = mouvements.length ? Math.round((mouvementsTermines / mouvements.length) * 100) : 0
  const tachesEnRetard = useMemo(() => taches.filter((item) => estTacheEnRetard(item, aujourdHui)), [aujourdHui, taches])
  const tachesAvenir = useMemo(() => taches.filter((item) => estTacheAvenir(item, aujourdHui)), [aujourdHui, taches])
  const interventionsActives = useMemo(() => interventions.filter((item) => item.etat?.nom !== 'TERMINE'), [interventions])
  const interventionsUrgentes = useMemo(() => interventionsActives.filter((item) => item.priorite === 'urgente'), [interventionsActives])
  const interventionsNormales = useMemo(() => interventionsActives.filter((item) => item.priorite === 'normale'), [interventionsActives])
  const charges = useMemo(() => {
    const tachesDuJour = taches.filter((tache) => tache.date_echeance === aujourdHui)
    const historiqueDuJour = historiqueTaches.filter((tache) => tache.date_realisation === aujourdHui)
    return calculerCharges(mouvements, executants, tachesDuJour, historiqueDuJour)
  }, [aujourdHui, executants, historiqueTaches, mouvements, taches])
  const activites = useMemo(() => construireActivites(mouvements, interventions, taches), [interventions, mouvements, taches])
  const surcharges = charges.filter((charge) => charge.surcharge)

  if (!estAdmin()) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-bold">Acces reserve admin</h1>
        <p className="mt-2 text-sm">Ce tableau de bord principal est reserve aux administrateurs.</p>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Tableau de bord principal</h1>
          <p className="mt-1 text-sm text-slate-500">Bonjour {profil?.nom}. Vue globale de l'activite hotel.</p>
        </div>
        <button type="button" onClick={() => void charger(true)} className={secondaryButton}>
          {rafraichissement ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Rafraichir
        </button>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-12 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Chargement du tableau de bord...
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard to="/planning-chambres" icon={DoorOpen} label="Occupation" value={`${occupation}%`} detail={`${chambresPlanifiees.size}/${chambres.length} chambres`} tone="teal" />
            <KpiCard to="/suivi-operationnel" icon={CheckCircle2} label="Taches du jour" value={String((repartitionEtats.AFFECTE || 0) + (repartitionEtats.EN_COURS || 0) + (repartitionEtats.BLOQUE || 0))} detail="mouvements a traiter" tone="blue" />
            <KpiCard to="/interventions-maintenance" icon={Wrench} label="Interventions en cours" value={String(interventionsActives.length)} detail={`${interventionsUrgentes.length} urgentes`} tone="orange" />
            <KpiCard to="/planning-chambres" icon={ClipboardIcon} label="Planning du jour" value={String(mouvements.length)} detail={`${avancement}% termine`} tone="slate" />
            <KpiCard to="/taches-periodiques" icon={AlertTriangle} label="En retard" value={String(tachesEnRetard.length)} detail="taches periodiques" tone="red" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <Panel title="Suivi operationnel chambres" action={`${avancement}%`}>
              <div className="space-y-4">
                <ProgressBar value={avancement} tone={avancement > 80 ? 'green' : avancement > 40 ? 'orange' : 'red'} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {['AFFECTE', 'EN_COURS', 'BLOQUE', 'TERMINE'].map((etat) => (
                    <EtatCounter key={etat} etat={etat} value={repartitionEtats[etat] || 0} />
                  ))}
                </div>
                <div className="space-y-3">
                  {charges.slice(0, 6).map((charge) => <ChargeRow key={charge.executant.id} charge={charge} />)}
                  {charges.length === 0 && <Empty text="Aucune charge aujourd'hui." />}
                </div>
              </div>
            </Panel>

            <Panel title="Alertes surcharge" action={String(surcharges.length)}>
              <div className="space-y-3">
                {surcharges.length === 0 && <Empty text="Aucune surcharge detectee." />}
                {surcharges.map((charge) => (
                  <div key={charge.executant.id} className="rounded-md border border-rose-200 bg-rose-50 p-3">
                    <p className="font-semibold text-rose-900">{charge.executant.nom}</p>
                    <p className="text-sm text-rose-700">{pointsDuJour(charge)}/{charge.capaciteMax} pts. Reequilibrage conseille.</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Interventions maintenance">
              <div className="space-y-4">
                <InterventionList title="Urgentes" interventions={interventionsUrgentes} tone="red" />
                <InterventionList title="Normales" interventions={interventionsNormales} tone="orange" />
              </div>
            </Panel>

            <Panel title="Taches periodiques urgentes">
              <div className="space-y-4">
                <TacheList title="En retard" taches={tachesEnRetard.slice(0, 6)} aujourdHui={aujourdHui} />
                <TacheList title="A venir sous 7 jours" taches={tachesAvenir.slice(0, 6)} aujourdHui={aujourdHui} />
              </div>
            </Panel>
          </div>

          <Panel title="Activite recente">
            <div className="grid gap-3 lg:grid-cols-2">
              {activites.length === 0 && <Empty text="Aucune activite recente." />}
              {activites.slice(0, 8).map((activite) => (
                <div key={activite.id} className="flex gap-3 rounded-md bg-slate-50 p-3">
                  <span className="mt-0.5 text-lg">{activite.statut}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{activite.action}</p>
                    <p className="truncate text-sm text-slate-500">{activite.detail}</p>
                    <p className="text-xs text-slate-400">{formatDateHeure(activite.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Charge des executants">
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {charges.map((charge) => <ChargeCard key={charge.executant.id} charge={charge} />)}
              {charges.length === 0 && <Empty text="Aucun executant charge aujourd'hui." />}
            </div>
          </Panel>
        </>
      )}
    </section>
  )
}

function KpiCard({ to, icon: Icon, label, value, detail, tone }: { to: string; icon: React.ElementType; label: string; value: string; detail: string; tone: 'teal' | 'blue' | 'orange' | 'red' | 'slate' }) {
  const classes = {
    teal: 'bg-teal-50 text-teal-800 ring-teal-100',
    blue: 'bg-sky-50 text-sky-800 ring-sky-100',
    orange: 'bg-amber-50 text-amber-800 ring-amber-100',
    red: 'bg-rose-50 text-rose-800 ring-rose-100',
    slate: 'bg-white text-slate-800 ring-slate-200',
  }

  return (
    <Link to={to} className={`block rounded-lg p-4 shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500 ${classes[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-80">{detail}</p>
    </Link>
  )
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        {action && <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{action}</span>}
      </div>
      {children}
    </section>
  )
}

function EtatCounter({ etat, value }: { etat: string; value: number }) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-400">{libelleEtat(etat)}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>
}

function ChargeRow({ charge }: { charge: ChargeExecutant }) {
  const pointsJour = pointsDuJour(charge)

  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-sm">
        <span className="font-medium text-slate-800">{charge.executant.nom}</span>
        <span className="text-slate-500">{charge.capaciteMax === null ? `${pointsJour} pts / illimite` : `${pointsJour}/${charge.capaciteMax} pts`}</span>
      </div>
      <ProgressBar value={(charge.taux ?? 0) * 100} tone={couleurCharge(charge)} />
    </div>
  )
}

function ChargeCard({ charge }: { charge: ChargeExecutant }) {
  const pointsJour = pointsDuJour(charge)

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{charge.executant.nom}</p>
          <p className="text-sm text-slate-500">{charge.capaciteMax === null ? `${pointsJour} points - capacite illimitee` : `${pointsJour}/${charge.capaciteMax} points`}</p>
        </div>
        <Badge tone={couleurCharge(charge)}>{statutCharge(charge)}</Badge>
      </div>
      <div className="mt-3">
        <ProgressBar value={(charge.taux ?? 0) * 100} tone={couleurCharge(charge)} />
      </div>
    </div>
  )
}

function InterventionList({ title, interventions, tone }: { title: string; interventions: InterventionMaintenance[]; tone: 'red' | 'orange' }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="space-y-2">
        {interventions.length === 0 && <Empty text={`Aucune intervention ${title.toLowerCase()}.`} />}
        {interventions.slice(0, 5).map((intervention) => (
          <a key={intervention.id} href="/interventions-maintenance" className="block rounded-md border border-slate-200 p-3 hover:bg-slate-50">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-950">{intervention.titre}</p>
              <Badge tone={tone}>{libelleEtat(intervention.etat?.nom)}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">{nomLieu(intervention.lieu)} - {formatDate(intervention.date_intervention)}</p>
          </a>
        ))}
      </div>
    </div>
  )
}

function TacheList({ title, taches, aujourdHui }: { title: string; taches: TachePeriodiquePlanning[]; aujourdHui: string }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="space-y-2">
        {taches.length === 0 && <Empty text={`Aucune tache ${title.toLowerCase()}.`} />}
        {taches.map((tache) => {
          const jours = differenceJours(aujourdHui, tache.date_echeance)
          return (
            <a key={tache.id} href="/taches-periodiques" className="block rounded-md border border-slate-200 p-3 hover:bg-slate-50">
              <p className="font-semibold text-slate-950">{tache.tache?.nom}</p>
              <p className="mt-1 text-sm text-slate-500">{nomLieu(tache.lieu)} - {jours < 0 ? `${Math.abs(jours)} j de retard` : `dans ${jours} j`}</p>
            </a>
          )
        })}
      </div>
    </div>
  )
}

function ProgressBar({ value, tone }: { value: number; tone: 'green' | 'orange' | 'red' | 'slate' }) {
  const colors = { green: 'bg-emerald-500', orange: 'bg-amber-500', red: 'bg-rose-500', slate: 'bg-slate-400' }
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${colors[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
}

function Badge({ tone, children }: { tone: 'green' | 'orange' | 'red' | 'slate'; children: React.ReactNode }) {
  const classes = { green: 'bg-emerald-50 text-emerald-800 ring-emerald-100', orange: 'bg-amber-50 text-amber-800 ring-amber-100', red: 'bg-rose-50 text-rose-800 ring-rose-100', slate: 'bg-slate-100 text-slate-700 ring-slate-200' }
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>{children}</span>
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">{text}</p>
}

function ClipboardIcon({ className }: { className?: string }) {
  return <Sparkles className={className} />
}

function compterParEtat(mouvements: PlanningChambre[]) {
  return mouvements.reduce<Record<string, number>>((acc, mouvement) => {
    const etat = mouvement.etat?.nom || 'AFFECTE'
    acc[etat] = (acc[etat] || 0) + 1
    return acc
  }, {})
}

function construireActivites(mouvements: PlanningChambre[], interventions: InterventionMaintenance[], taches: TachePeriodiquePlanning[]) {
  const activites: Activite[] = []

  mouvements
    .filter((mouvement) => mouvement.etat?.nom === 'TERMINE' && mouvement.updated_at)
    .forEach((mouvement) => activites.push({
      id: `mouvement-${mouvement.id}`,
      date: mouvement.updated_at || `${mouvement.date}T00:00:00`,
      action: 'Mouvement chambre termine',
      detail: `${mouvement.type_mouvement?.nom || 'Mouvement'} - ${nomLieu(mouvement.lieu)}`,
      statut: '✅',
    }))

  interventions
    .filter((intervention) => intervention.date_fermeture)
    .forEach((intervention) => activites.push({
      id: `intervention-${intervention.id}`,
      date: intervention.date_fermeture || intervention.updated_at,
      action: 'Intervention fermee',
      detail: `${intervention.titre} - ${nomLieu(intervention.lieu)}`,
      statut: '🔧',
    }))

  taches
    .filter((tache) => tache.date_realisation)
    .forEach((tache) => activites.push({
      id: `tache-${tache.id}`,
      date: `${tache.date_realisation}T12:00:00`,
      action: 'Tache periodique realisee',
      detail: `${tache.tache?.nom || 'Tache'} - ${nomLieu(tache.lieu)}`,
      statut: '♻️',
    }))

  interventions.forEach((intervention) => {
    intervention.photos?.forEach((photo) => activites.push({
      id: `photo-${photo.id}`,
      date: photo.created_at,
      action: 'Photo ajoutee',
      detail: `${photo.type_photo} - ${intervention.titre}`,
      statut: '📷',
    }))
  })

  return activites.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
}

function estTacheEnRetard(tache: TachePeriodiquePlanning, aujourdHui: string) {
  return tache.est_actif && !tache.date_realisation && tache.date_echeance < aujourdHui
}

function estTacheAvenir(tache: TachePeriodiquePlanning, aujourdHui: string) {
  const jours = differenceJours(aujourdHui, tache.date_echeance)
  return tache.est_actif && !tache.date_realisation && jours >= 0 && jours <= 7
}

function couleurCharge(charge: ChargeExecutant): 'green' | 'orange' | 'red' | 'slate' {
  if (charge.capaciteMax === null) return 'slate'
  if (charge.surcharge) return 'red'
  if ((charge.taux || 0) >= 0.8) return 'orange'
  return 'green'
}

function statutCharge(charge: ChargeExecutant) {
  if (charge.capaciteMax === null) return 'Illimite'
  if (charge.surcharge) return 'SURCHARGE'
  if ((charge.taux || 0) >= 0.8) return 'Proche limite'
  return 'OK'
}

function pointsDuJour(charge: ChargeExecutant) {
  return charge.pointsParDate.find((item) => item.date === formatDateInput(new Date()))?.points || 0
}

function libelleEtat(etat?: string) {
  return { AFFECTE: 'Affecte', A_FAIRE: 'A faire', EN_COURS: 'En cours', BLOQUE: 'Bloque', TERMINE: 'Termine', ANNULEE: 'Annule' }[etat || 'AFFECTE'] || etat || 'Affecte'
}

function nomLieu(lieu: { nom: string; batiment?: { code: string } | null } | null | undefined) {
  if (!lieu) return '-'
  return lieu.batiment ? `${lieu.nom} (${lieu.batiment.code})` : lieu.nom
}

function differenceJours(debut: string, fin: string) {
  const a = new Date(`${debut}T00:00:00`).getTime()
  const b = new Date(`${fin}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function formatDateHeure(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}

const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
