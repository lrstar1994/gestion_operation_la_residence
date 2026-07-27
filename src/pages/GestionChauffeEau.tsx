import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Flame, Power, RefreshCcw, Search, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  listerActionsChauffeEau,
  modifierActionChauffeEau,
  type ChauffeEauAction,
  type EtatActionChauffeEau,
  type TypeActionChauffeEau,
} from '../api/chauffeEau'

const etats: EtatActionChauffeEau[] = ['A_FAIRE', 'TERMINE', 'BLOQUE']
const types: TypeActionChauffeEau[] = ['ALLUMER', 'ETEINDRE']

export function GestionChauffeEau() {
  const [date, setDate] = useState(formatDateInput(new Date()))
  const [actions, setActions] = useState<ChauffeEauAction[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [etatFiltre, setEtatFiltre] = useState<'tous' | EtatActionChauffeEau>('tous')
  const [typeFiltre, setTypeFiltre] = useState<'tous' | TypeActionChauffeEau>('tous')

  useEffect(() => {
    void charger()
  }, [date])

  async function charger() {
    setChargement(true)
    try {
      setActions(await listerActionsChauffeEau(date))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chargement de la gestion chauffe-eau impossible.')
    } finally {
      setChargement(false)
    }
  }

  const actionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return actions.filter((action) => {
      if (etatFiltre !== 'tous' && action.etat !== etatFiltre) return false
      if (typeFiltre !== 'tous' && action.type_action !== typeFiltre) return false
      if (!terme) return true

      return [
        action.lieu?.nom,
        action.lieu?.numero,
        action.lieu?.batiment?.nom,
        libelleType(action.type_action),
        libelleEtat(action.etat),
      ].filter(Boolean).join(' ').toLowerCase().includes(terme)
    })
  }, [actions, etatFiltre, recherche, typeFiltre])

  const resume = useMemo(() => ({
    aFaire: actions.filter((action) => action.etat === 'A_FAIRE').length,
    termines: actions.filter((action) => action.etat === 'TERMINE').length,
    bloques: actions.filter((action) => action.etat === 'BLOQUE').length,
    allumer: actions.filter((action) => action.type_action === 'ALLUMER').length,
    eteindre: actions.filter((action) => action.type_action === 'ETEINDRE').length,
  }), [actions])

  async function changerEtat(action: ChauffeEauAction, etat: EtatActionChauffeEau) {
    let commentaire = action.commentaire

    if (etat === 'BLOQUE') {
      commentaire = window.prompt('Commentaire du blocage')?.trim() || null
      if (!commentaire) {
        toast.error('Le commentaire est obligatoire pour bloquer une action.')
        return
      }
    }

    if (etat !== 'BLOQUE') {
      commentaire = etat === 'TERMINE' ? action.commentaire : null
    }

    try {
      const actionMaj = await modifierActionChauffeEau(action.id, { etat, commentaire })
      setActions((liste) => liste.map((item) => item.id === action.id ? actionMaj : item))
      toast.success('Action chauffe-eau mise a jour.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Modification impossible.')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Chambres</p>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-950 sm:text-2xl">
            <Flame className="h-6 w-6 text-teal-700" />
            Gestion chauffe-eau
          </h1>
          <p className="mt-1 text-sm text-slate-500">Checklist automatique : allumer avant les arrivees, eteindre apres les departs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
          <button type="button" onClick={() => void charger()} className={secondaryButton}>
            <RefreshCcw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ResumeCarte label="A faire" valeur={resume.aFaire} tone="orange" />
        <ResumeCarte label="Termines" valeur={resume.termines} tone="green" />
        <ResumeCarte label="Bloques" valeur={resume.bloques} tone="red" />
        <ResumeCarte label="A allumer" valeur={resume.allumer} tone="slate" />
        <ResumeCarte label="A eteindre" valeur={resume.eteindre} tone="slate" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Chambre, batiment..." className={`${inputClass} pl-9`} />
            </label>
            <select value={typeFiltre} onChange={(event) => setTypeFiltre(event.target.value as 'tous' | TypeActionChauffeEau)} className={inputClass}>
              <option value="tous">Toutes actions</option>
              {types.map((type) => <option key={type} value={type}>{libelleType(type)}</option>)}
            </select>
            <select value={etatFiltre} onChange={(event) => setEtatFiltre(event.target.value as 'tous' | EtatActionChauffeEau)} className={inputClass}>
              <option value="tous">Tous etats</option>
              {etats.map((etat) => <option key={etat} value={etat}>{libelleEtat(etat)}</option>)}
            </select>
          </div>
        </div>

        {chargement && <div className="p-8 text-center text-sm text-slate-500">Chargement...</div>}

        {!chargement && actionsFiltrees.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">Aucune action chauffe-eau pour cette date.</div>
        )}

        {!chargement && actionsFiltrees.length > 0 && (
          <div className="divide-y divide-slate-200">
            {actionsFiltrees.map((action) => (
              <div key={action.id} className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_180px_160px_260px] xl:items-center">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone={action.type_action === 'ALLUMER' ? 'orange' : 'slate'}>
                      {action.type_action === 'ALLUMER' ? <Flame className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      {libelleType(action.type_action)}
                    </Badge>
                    <Badge tone={tonEtat(action.etat)}>{libelleEtat(action.etat)}</Badge>
                  </div>
                  <p className="truncate font-semibold text-slate-950">{action.lieu?.nom || 'Lieu'}</p>
                  <p className="text-xs text-slate-500">{action.lieu?.batiment?.nom || 'Sans batiment'}</p>
                  {action.type_action === 'ALLUMER' && action.planning_chambre?.date && (
                    <p className="mt-1 text-xs text-slate-500">Arrivee prevue le {formatDate(action.planning_chambre.date)}</p>
                  )}
                  {action.type_action === 'ETEINDRE' && action.planning_chambre?.date && (
                    <p className="mt-1 text-xs text-slate-500">Depart le {formatDate(action.planning_chambre.date)}</p>
                  )}
                  {action.commentaire && <p className="mt-2 text-sm text-rose-700">{action.commentaire}</p>}
                </div>

                <div className="text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Date action</span>
                  <p>{formatDate(action.date_action)}</p>
                </div>

                <div className="text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Mise a jour</span>
                  <p>{formatDateHeure(action.updated_at)}</p>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button type="button" onClick={() => void changerEtat(action, 'TERMINE')} disabled={action.etat === 'TERMINE'} className={buttonAction}>
                    <CheckCircle2 className="h-4 w-4" />
                    Termine
                  </button>
                  <button type="button" onClick={() => void changerEtat(action, 'A_FAIRE')} disabled={action.etat === 'A_FAIRE'} className={buttonAction}>
                    <XCircle className="h-4 w-4" />
                    A faire
                  </button>
                  <button type="button" onClick={() => void changerEtat(action, 'BLOQUE')} disabled={action.etat === 'BLOQUE'} className={buttonDanger}>
                    <AlertTriangle className="h-4 w-4" />
                    Bloquer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ResumeCarte({ label, valeur, tone }: { label: string; valeur: number; tone: 'red' | 'orange' | 'green' | 'slate' }) {
  const classes = {
    red: 'border-rose-200 bg-rose-50 text-rose-800',
    orange: 'border-amber-200 bg-amber-50 text-amber-800',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-200 bg-white text-slate-800',
  }

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${classes[tone]}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-2 text-2xl font-bold">{valeur}</p>
    </div>
  )
}

function Badge({ tone, children }: { tone: 'red' | 'orange' | 'green' | 'slate'; children: React.ReactNode }) {
  const classes = {
    red: 'bg-rose-50 text-rose-800 ring-rose-100',
    orange: 'bg-amber-50 text-amber-800 ring-amber-100',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>{children}</span>
}

function tonEtat(etat: EtatActionChauffeEau): 'red' | 'orange' | 'green' | 'slate' {
  if (etat === 'BLOQUE') return 'red'
  if (etat === 'TERMINE') return 'green'
  return 'orange'
}

function libelleType(type: TypeActionChauffeEau) {
  return type === 'ALLUMER' ? 'Allumer' : 'Eteindre'
}

function libelleEtat(etat: EtatActionChauffeEau) {
  return { A_FAIRE: 'A faire', TERMINE: 'Termine', BLOQUE: 'Bloque' }[etat]
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
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date))
}

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const buttonAction = 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
const buttonDanger = 'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50'
