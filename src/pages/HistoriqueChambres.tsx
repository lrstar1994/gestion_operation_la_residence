import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2, RefreshCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { listerHistoriqueChambres, type ActionHistoriqueChambre, type TypeActionHistoriqueChambre } from '../api/historiqueChambres'
import type { Lieu } from '../api/lieux'

type FiltreType = 'tous' | TypeActionHistoriqueChambre

export function HistoriqueChambres() {
  const aujourdHui = formatDateInput(new Date())
  const [dateDebut, setDateDebut] = useState(ajouterJours(aujourdHui, -7))
  const [dateFin, setDateFin] = useState(aujourdHui)
  const [batimentFiltre, setBatimentFiltre] = useState('tous')
  const [chambreFiltre, setChambreFiltre] = useState('tous')
  const [typeFiltre, setTypeFiltre] = useState<FiltreType>('tous')
  const [recherche, setRecherche] = useState('')
  const [chambres, setChambres] = useState<Lieu[]>([])
  const [actions, setActions] = useState<ActionHistoriqueChambre[]>([])
  const [chargement, setChargement] = useState(true)

  const charger = useCallback(async () => {
    if (dateFin < dateDebut) {
      toast.error('La date fin doit etre apres la date debut.')
      return
    }

    setChargement(true)
    try {
      const resultat = await listerHistoriqueChambres(dateDebut, dateFin)
      setChambres(resultat.chambres)
      setActions(resultat.actions)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Historique des chambres impossible a charger.')
    } finally {
      setChargement(false)
    }
  }, [dateDebut, dateFin])

  useEffect(() => {
    void charger()
  }, [charger])

  const datesVisibles = useMemo(() => datesEntre(dateDebut, dateFin), [dateDebut, dateFin])
  const batiments = useMemo(
    () => Array.from(new Map(chambres.filter((chambre) => chambre.batiment).map((chambre) => [chambre.batiment!.id, chambre.batiment!])).values()).sort((a, b) => a.nom.localeCompare(b.nom)),
    [chambres],
  )

  const actionsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return actions.filter((action) => {
      const chambre = chambres.find((item) => item.id === action.id_lieu)
      if (!chambre) return false
      if (typeFiltre !== 'tous' && action.type !== typeFiltre) return false
      if (batimentFiltre !== 'tous' && chambre.id_batiment !== batimentFiltre) return false
      if (chambreFiltre !== 'tous' && chambre.id !== chambreFiltre) return false
      if (!terme) return true

      return [chambre.nom, chambre.numero, chambre.batiment?.nom, action.libelle, libelleType(action.type)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(terme)
    })
  }, [actions, batimentFiltre, chambreFiltre, chambres, recherche, typeFiltre])

  const actionsParCellule = useMemo(() => {
    const map = new Map<string, ActionHistoriqueChambre[]>()
    actionsFiltrees.forEach((action) => {
      const cle = `${action.id_lieu}-${action.date}`
      map.set(cle, [...(map.get(cle) || []), action])
    })
    return map
  }, [actionsFiltrees])

  const chambresAffichees = useMemo(() => {
    const idsAvecAction = new Set(actionsFiltrees.map((action) => action.id_lieu))
    const terme = recherche.trim().toLowerCase()

    return chambres
      .filter((chambre) => idsAvecAction.has(chambre.id))
      .filter((chambre) => batimentFiltre === 'tous' || chambre.id_batiment === batimentFiltre)
      .filter((chambre) => chambreFiltre === 'tous' || chambre.id === chambreFiltre)
      .filter((chambre) => {
        if (!terme) return true
        return [chambre.nom, chambre.numero, chambre.batiment?.nom].filter(Boolean).join(' ').toLowerCase().includes(terme)
      })
      .sort((a, b) => (a.batiment?.nom || '').localeCompare(b.batiment?.nom || '') || (a.numero || a.nom).localeCompare(b.numero || b.nom))
  }, [actionsFiltrees, batimentFiltre, chambreFiltre, chambres, recherche])

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Chambres</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Historique des chambres</h1>
          <p className="mt-1 text-sm text-slate-500">Toutes les actions realisees dans les chambres : menages, interventions et taches periodiques.</p>
        </div>
        <button type="button" onClick={() => void charger()} className={secondaryButton}>
          <RefreshCcw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-7">
          <Champ label="Date debut"><input type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className={inputClass} /></Champ>
          <Champ label="Date fin"><input type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} className={inputClass} /></Champ>
          <Champ label="Batiment">
            <select value={batimentFiltre} onChange={(event) => setBatimentFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Tous</option>
              {batiments.map((batiment) => <option key={batiment.id} value={batiment.id}>{batiment.nom}</option>)}
            </select>
          </Champ>
          <Champ label="Chambre">
            <select value={chambreFiltre} onChange={(event) => setChambreFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Toutes</option>
              {chambres.map((chambre) => <option key={chambre.id} value={chambre.id}>{nomLieu(chambre)}</option>)}
            </select>
          </Champ>
          <Champ label="Type d'action">
            <select value={typeFiltre} onChange={(event) => setTypeFiltre(event.target.value as FiltreType)} className={inputClass}>
              <option value="tous">Tous</option>
              <option value="menage">Menages</option>
              <option value="intervention">Maintenance</option>
              <option value="periodique">Taches periodiques</option>
            </select>
          </Champ>
          <Champ label="Recherche">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher une action..." className={`${inputClass} pl-9`} />
            </label>
          </Champ>
        </div>

        <div className="flex flex-wrap gap-4 border-b border-slate-200 px-4 py-3 text-xs font-semibold">
          <Legende type="menage" titre="Menages" detail="GM, REC, DEP" />
          <Legende type="intervention" titre="Maintenance" detail="Reparations et depannages" />
          <Legende type="periodique" titre="Taches periodiques" detail="Controles et entretiens reguliers" />
        </div>

        <div>
          {chargement && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          )}

          {!chargement && chambresAffichees.length > 0 && datesVisibles.length > 0 && (
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div
                  className="grid border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500"
                  style={{ gridTemplateColumns: `145px 105px repeat(${datesVisibles.length}, minmax(128px, 1fr))` }}
                >
                  <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50 px-3 py-3">Batiment</div>
                  <div className="sticky left-[145px] z-20 border-r border-slate-200 bg-slate-50 px-3 py-3">Chambre</div>
                  {datesVisibles.map((date) => (
                    <EnteteDate key={date} date={date} />
                  ))}
                </div>

                {chambresAffichees.map((chambre) => (
                  <div
                    key={chambre.id}
                    className="grid min-h-[78px] border-b border-slate-100 last:border-b-0"
                    style={{ gridTemplateColumns: `145px 105px repeat(${datesVisibles.length}, minmax(128px, 1fr))` }}
                  >
                    <div className="sticky left-0 z-10 flex items-center border-r border-slate-200 bg-white px-3 py-3 text-xs font-bold uppercase text-slate-700">{chambre.batiment?.nom || '-'}</div>
                    <div className="sticky left-[145px] z-10 flex items-center border-r border-slate-200 bg-white px-3 py-3 font-semibold text-slate-900">{chambre.numero || chambre.nom}</div>
                    {datesVisibles.map((date) => {
                      const actionsCellule = actionsParCellule.get(`${chambre.id}-${date}`) || []
                      return (
                        <div key={`${chambre.id}-${date}`} className="border-r border-slate-100 bg-white p-2 last:border-r-0">
                          {actionsCellule.length === 0 ? (
                            <div className="flex h-full min-h-[58px] items-center justify-center rounded-md bg-slate-50 text-xs text-slate-300">-</div>
                          ) : (
                            <div className="space-y-1.5">
                              {actionsCellule.map((action) => (
                                <ActionBadge key={action.id} action={action} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!chargement && (chambresAffichees.length === 0 || datesVisibles.length === 0) && (
            <div className="p-8 text-center text-sm text-slate-500">Aucune action trouvee sur cette periode.</div>
          )}
        </div>
      </div>
    </section>
  )
}

function Champ({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>
}

function EnteteDate({ date }: { date: string }) {
  return (
    <div className="border-r border-slate-200 px-3 py-3 text-center last:border-r-0">
      <div>{jourSemaine(date)}</div>
      <div className="mt-1 font-bold text-slate-800">{formatDateCourte(date)}</div>
    </div>
  )
}

function Legende({ type, titre, detail }: { type: TypeActionHistoriqueChambre; titre: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1 h-3 w-3 rounded-full ${couleurPoint(type)}`} />
      <div>
        <p className="text-slate-800">{titre}</p>
        <p className="font-normal text-slate-500">{detail}</p>
      </div>
    </div>
  )
}

function ActionBadge({ action }: { action: ActionHistoriqueChambre }) {
  return (
    <div className={`px-1 text-xs font-semibold leading-snug ${classeAction(action.type)}`}>
      {action.libelle}
    </div>
  )
}

function classeAction(type: TypeActionHistoriqueChambre) {
  const classes = {
    menage: 'text-pink-600',
    intervention: 'text-violet-600',
    periodique: 'text-amber-600',
  }
  return classes[type]
}

function couleurPoint(type: TypeActionHistoriqueChambre) {
  const classes = {
    menage: 'bg-pink-500',
    intervention: 'bg-violet-500',
    periodique: 'bg-amber-500',
  }
  return classes[type]
}

function nomLieu(lieu: Lieu) {
  return `${lieu.nom}${lieu.batiment ? ` (${lieu.batiment.nom})` : ''}`
}

function ajouterJours(date: string, jours: number) {
  const valeur = new Date(`${date}T00:00:00`)
  valeur.setDate(valeur.getDate() + jours)
  return formatDateInput(valeur)
}

function datesEntre(debut: string, fin: string) {
  const dates: string[] = []
  const courant = new Date(`${debut}T00:00:00`)
  const limite = new Date(`${fin}T00:00:00`)

  while (courant <= limite) {
    dates.push(formatDateInput(courant))
    courant.setDate(courant.getDate() + 1)
  }

  return dates
}

function jourSemaine(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(`${date}T00:00:00`))
}

function formatDateCourte(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(new Date(`${date}T00:00:00`))
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
