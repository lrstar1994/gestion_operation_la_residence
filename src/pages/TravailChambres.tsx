import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Loader2, RefreshCcw, Save, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import { estLieuChambre, listerLieux, type Lieu } from '../api/lieux'
import { listerPlanning, type PlanningExecutant } from '../api/planning'
import {
  listerEtatsMouvement,
  listerPlanningChambre,
  type EtatMouvement,
  type PlanningChambre,
} from '../api/planningChambre'
import {
  creerTacheChambre,
  listerToutesTachesChambres,
  listerTachesChambres,
  modifierTacheChambre,
  supprimerTacheChambre,
  type TacheChambre,
  type TacheChambrePayload,
  type UrgenceTacheChambre,
} from '../api/tachesChambres'

const urgences: UrgenceTacheChambre[] = ['haute', 'normale', 'basse']

export function TravailChambres() {
  const aujourdHui = formatDateInput(new Date())
  const [dateDebut, setDateDebut] = useState(aujourdHui)
  const [dateFin, setDateFin] = useState(ajouterJours(aujourdHui, 14))
  const [recherche, setRecherche] = useState('')
  const [batimentFiltre, setBatimentFiltre] = useState('tous')
  const [executantFiltre, setExecutantFiltre] = useState('tous')
  const [etatFiltre, setEtatFiltre] = useState('tous')
  const [chambres, setChambres] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [etats, setEtats] = useState<EtatMouvement[]>([])
  const [planningExecutants, setPlanningExecutants] = useState<PlanningExecutant[]>([])
  const [mouvements, setMouvements] = useState<PlanningChambre[]>([])
  const [taches, setTaches] = useState<TacheChambre[]>([])
  const [toutesTaches, setToutesTaches] = useState<TacheChambre[]>([])
  const [chargement, setChargement] = useState(true)
  const [soumission, setSoumission] = useState(false)

  const [idMouvement, setIdMouvement] = useState('')
  const [dateExecution, setDateExecution] = useState(aujourdHui)
  const [dateLimite, setDateLimite] = useState(aujourdHui)
  const [idExecutant, setIdExecutant] = useState('')
  const [urgence, setUrgence] = useState<UrgenceTacheChambre>('normale')
  const [commentaire, setCommentaire] = useState('')

  const etatAffecte = etats.find((etat) => etat.nom === 'AFFECTE') || etats[0]

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const [
        lieuxResultat,
        executantsResultat,
        etatsResultat,
        planningExecutantsResultat,
        mouvementsResultat,
        tachesResultat,
        toutesTachesResultat,
      ] = await Promise.all([
        listerLieux(),
        listerExecutants(),
        listerEtatsMouvement(),
        listerPlanning(dateDebut, dateFin),
        listerPlanningChambre(aujourdHui, ajouterJours(dateFin, 45)),
        listerTachesChambres(dateDebut, dateFin),
        listerToutesTachesChambres(),
      ])

      setChambres(lieuxResultat.filter((lieu) => lieu.est_actif && estLieuChambre(lieu)))
      setExecutants(executantsResultat.filter((executant) => executant.domaine?.nom.toLowerCase().includes('chambre')))
      setEtats(etatsResultat)
      setPlanningExecutants(planningExecutantsResultat)
      setMouvements(mouvementsResultat)
      setTaches(tachesResultat)
      setToutesTaches(toutesTachesResultat)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Travail chambres impossible a charger.')
    } finally {
      setChargement(false)
    }
  }, [aujourdHui, dateDebut, dateFin])

  useEffect(() => {
    void charger()
  }, [charger])

  const batiments = useMemo(
    () =>
      Array.from(
        new Map(
          chambres
            .filter((chambre) => chambre.batiment)
            .map((chambre) => [chambre.batiment!.id, chambre.batiment!]),
        ).values(),
      ).sort((a, b) => a.nom.localeCompare(b.nom)),
    [chambres],
  )

  const mouvementsDejaPlanifies = useMemo(
    () => new Set(toutesTaches.map((tache) => tache.id_planning_chambre).filter(Boolean)),
    [toutesTaches],
  )

  const mouvementsDisponibles = useMemo(() => {
    return mouvements
      .filter((mouvement) => !mouvementsDejaPlanifies.has(mouvement.id))
      .filter((mouvement) => mouvement.etat?.nom !== 'TERMINE')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.lieu?.nom || '').localeCompare(b.lieu?.nom || ''))
  }, [mouvements, mouvementsDejaPlanifies])

  const mouvementSelectionne = mouvementsDisponibles.find((mouvement) => mouvement.id === idMouvement)

  useEffect(() => {
    if (!mouvementSelectionne) return

    setDateLimite(mouvementSelectionne.date)
    setDateExecution(mouvementSelectionne.date < aujourdHui ? aujourdHui : mouvementSelectionne.date)
    setIdExecutant(mouvementSelectionne.id_executant || mouvementSelectionne.lieu?.batiment?.id_executant_defaut || '')
    setUrgence(urgenceDepuisMouvement(mouvementSelectionne.date, aujourdHui))
  }, [aujourdHui, mouvementSelectionne])

  const tachesFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return taches
      .filter((tache) => batimentFiltre === 'tous' || tache.lieu?.id_batiment === batimentFiltre)
      .filter((tache) => executantFiltre === 'tous' || tache.id_executant === executantFiltre)
      .filter((tache) => etatFiltre === 'tous' || tache.id_etat === etatFiltre)
      .filter((tache) => {
        if (!terme) return true
        return [
          tache.lieu?.nom,
          tache.lieu?.numero,
          tache.lieu?.batiment?.nom,
          tache.type_mouvement?.nom,
          tache.executant?.nom,
          tache.commentaire,
        ].filter(Boolean).join(' ').toLowerCase().includes(terme)
      })
      .sort((a, b) => a.date_execution.localeCompare(b.date_execution) || a.date_limite.localeCompare(b.date_limite))
  }, [batimentFiltre, etatFiltre, executantFiltre, recherche, taches])

  const tachesParDate = useMemo(() => {
    const map = new Map<string, TacheChambre[]>()
    tachesFiltrees.forEach((tache) => {
      map.set(tache.date_execution, [...(map.get(tache.date_execution) || []), tache])
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [tachesFiltrees])

  const chargesParDate = useMemo(() => {
    const map = new Map<string, { points: number; count: number }>()
    tachesFiltrees.forEach((tache) => {
      const charge = map.get(tache.date_execution) || { points: 0, count: 0 }
      charge.points += tache.points
      charge.count += 1
      map.set(tache.date_execution, charge)
    })
    return map
  }, [tachesFiltrees])

  function estExecutantEnTravail(executantId: string | null | undefined, date: string) {
    if (!executantId) return false
    return planningExecutants.some(
      (planning) =>
        planning.id_executant === executantId &&
        planning.date === date &&
        planning.type_planning?.nom.toUpperCase() === 'TRAVAIL',
    )
  }

  async function creerDepuisMouvement() {
    if (!mouvementSelectionne || !etatAffecte) {
      toast.error('Selectionne un mouvement a planifier.')
      return
    }

    if (dateExecution > dateLimite) {
      toast.error('La date execution doit etre avant ou egale a la date limite.')
      return
    }

    setSoumission(true)
    try {
      const payload: TacheChambrePayload = {
        id_planning_chambre: mouvementSelectionne.id,
        id_lieu: mouvementSelectionne.id_lieu,
        id_type_mouvement: mouvementSelectionne.id_type_mouvement,
        date_mouvement: mouvementSelectionne.date,
        date_execution: dateExecution,
        date_limite: dateLimite,
        id_executant: idExecutant || null,
        id_etat: etatAffecte.id,
        points: mouvementSelectionne.type_mouvement?.points || 0,
        urgence,
        commentaire: commentaire.trim() || null,
      }

      const tache = await creerTacheChambre(payload)
      setTaches((liste) => [...liste, tache])
      setToutesTaches((liste) => [...liste, tache])
      setIdMouvement('')
      setCommentaire('')
      toast.success('Tache chambre planifiee.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Creation impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function mettreAJourTache(id: string, payload: Partial<TacheChambrePayload>) {
    try {
      const tache = await modifierTacheChambre(id, payload)
      setTaches((liste) => liste.map((item) => item.id === id ? tache : item))
      setToutesTaches((liste) => liste.map((item) => item.id === id ? tache : item))
      toast.success('Tache mise a jour.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Modification impossible.')
    }
  }

  async function supprimer(id: string) {
    if (!window.confirm('Supprimer cette tache chambre ?')) return
    try {
      await supprimerTacheChambre(id)
      setTaches((liste) => liste.filter((tache) => tache.id !== id))
      setToutesTaches((liste) => liste.filter((tache) => tache.id !== id))
      toast.success('Tache supprimee.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Chambres</p>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-950 sm:text-2xl">
            <CalendarCheck className="h-6 w-6 text-teal-700" />
            Travail chambres
          </h1>
          <p className="mt-1 text-sm text-slate-500">Planifie le travail reel avec une date execution separee du mouvement hotelier.</p>
        </div>
        <button type="button" onClick={() => void charger()} className={secondaryButton}>
          <RefreshCcw className="h-4 w-4" />
          Rafraichir
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-950">Planifier depuis un mouvement</h2>
          <p className="mt-1 text-sm text-slate-500">Le mouvement reste dans le planning chambres, la charge sera portee par la date execution.</p>

          <div className="mt-4 space-y-3">
            <Champ label="Mouvement hotelier">
              <select value={idMouvement} onChange={(event) => setIdMouvement(event.target.value)} className={inputClass}>
                <option value="">Choisir</option>
                {mouvementsDisponibles.map((mouvement) => (
                  <option key={mouvement.id} value={mouvement.id}>
                    {formatDate(mouvement.date)} - {mouvement.lieu?.nom || 'Chambre'} - {mouvement.type_mouvement?.nom || 'Mouvement'}
                  </option>
                ))}
              </select>
            </Champ>

            {mouvementSelectionne && (
              <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{mouvementSelectionne.lieu?.nom}</p>
                <p>{mouvementSelectionne.type_mouvement?.nom} - {mouvementSelectionne.type_mouvement?.points || 0} point(s)</p>
                <p>Mouvement le {formatDate(mouvementSelectionne.date)}</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Champ label="Date execution">
                <input type="date" value={dateExecution} onChange={(event) => setDateExecution(event.target.value)} className={inputClass} />
              </Champ>
              <Champ label="Date limite">
                <input type="date" value={dateLimite} onChange={(event) => setDateLimite(event.target.value)} className={inputClass} />
              </Champ>
            </div>

            <Champ label="Executant">
              <select value={idExecutant} onChange={(event) => setIdExecutant(event.target.value)} className={inputClass}>
                <option value="">Non affecte</option>
                {executants.map((executant) => (
                  <option key={executant.id} value={executant.id}>
                    {executant.nom}{estExecutantEnTravail(executant.id, dateExecution) ? '' : ' (pas en travail)'}
                  </option>
                ))}
              </select>
            </Champ>

            <Champ label="Urgence">
              <select value={urgence} onChange={(event) => setUrgence(event.target.value as UrgenceTacheChambre)} className={inputClass}>
                {urgences.map((item) => <option key={item} value={item}>{libelleUrgence(item)}</option>)}
              </select>
            </Champ>

            <Champ label="Commentaire">
              <textarea value={commentaire} onChange={(event) => setCommentaire(event.target.value)} className={textareaClass} />
            </Champ>

            <button type="button" disabled={soumission || !idMouvement} onClick={() => void creerDepuisMouvement()} className={primaryButton}>
              {soumission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Planifier
            </button>
          </div>
        </aside>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-[130px_130px_160px_170px_150px_1fr]">
            <input type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className={inputClass} />
            <input type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} className={inputClass} />
            <select value={batimentFiltre} onChange={(event) => setBatimentFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Tous batiments</option>
              {batiments.map((batiment) => <option key={batiment.id} value={batiment.id}>{batiment.nom}</option>)}
            </select>
            <select value={executantFiltre} onChange={(event) => setExecutantFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Tous executants</option>
              {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
            </select>
            <select value={etatFiltre} onChange={(event) => setEtatFiltre(event.target.value)} className={inputClass}>
              <option value="tous">Tous etats</option>
              {etats.map((etat) => <option key={etat.id} value={etat.id}>{libelleEtat(etat.nom)}</option>)}
            </select>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher..." className={`${inputClass} pl-9`} />
            </label>
          </div>

          {chargement && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement...
            </div>
          )}

          {!chargement && tachesParDate.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">Aucune tache chambre planifiee sur cette periode.</div>
          )}

          {!chargement && tachesParDate.length > 0 && (
            <div className="divide-y divide-slate-200">
              {tachesParDate.map(([date, items]) => {
                const charge = chargesParDate.get(date)
                return (
                  <section key={date} className="p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="font-semibold text-slate-950">{formatDate(date)}</h2>
                        <p className="text-xs text-slate-500">{charge?.count || 0} tache(s), {charge?.points || 0} point(s)</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[980px] w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Chambre</th>
                            <th className="px-3 py-2">Mouvement</th>
                            <th className="px-3 py-2">Execution</th>
                            <th className="px-3 py-2">Limite</th>
                            <th className="px-3 py-2">Executant</th>
                            <th className="px-3 py-2">Etat</th>
                            <th className="px-3 py-2">Urgence</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((tache) => (
                            <tr key={tache.id} className="hover:bg-slate-50">
                              <td className="px-3 py-3">
                                <p className="font-medium text-slate-900">{tache.lieu?.nom || 'Chambre'}</p>
                                <p className="text-xs text-slate-500">{tache.lieu?.batiment?.nom || '-'}</p>
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                <p>{tache.type_mouvement?.nom || '-'}</p>
                                <p className="text-xs">{formatDate(tache.date_mouvement)} - {tache.points} pt</p>
                              </td>
                              <td className="px-3 py-3">
                                <input type="date" value={tache.date_execution} onChange={(event) => void mettreAJourTache(tache.id, { date_execution: event.target.value })} className={inputClass} />
                              </td>
                              <td className="px-3 py-3 text-slate-600">{formatDate(tache.date_limite)}</td>
                              <td className="px-3 py-3">
                                <select value={tache.id_executant || ''} onChange={(event) => void mettreAJourTache(tache.id, { id_executant: event.target.value || null })} className={inputClass}>
                                  <option value="">Non affecte</option>
                                  {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-3">
                                <select value={tache.id_etat} onChange={(event) => void mettreAJourTache(tache.id, { id_etat: event.target.value })} className={inputClass}>
                                  {etats.map((etat) => <option key={etat.id} value={etat.id}>{libelleEtat(etat.nom)}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-3"><Badge tone={couleurUrgence(tache.urgence)}>{libelleUrgence(tache.urgence)}</Badge></td>
                              <td className="px-3 py-3 text-right">
                                <button type="button" onClick={() => void supprimer(tache.id)} className={dangerButton} aria-label="Supprimer">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>
}

function Badge({ tone, children }: { tone: 'red' | 'orange' | 'green' | 'slate'; children: React.ReactNode }) {
  const classes = {
    red: 'bg-rose-50 text-rose-800 ring-rose-100',
    orange: 'bg-amber-50 text-amber-800 ring-amber-100',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>{children}</span>
}

function urgenceDepuisMouvement(dateMouvement: string, aujourdHui: string): UrgenceTacheChambre {
  const jours = differenceJours(aujourdHui, dateMouvement)
  if (jours <= 0) return 'haute'
  if (jours <= 2) return 'normale'
  return 'basse'
}

function couleurUrgence(urgence: UrgenceTacheChambre): 'red' | 'orange' | 'green' | 'slate' {
  if (urgence === 'haute') return 'red'
  if (urgence === 'normale') return 'orange'
  return 'green'
}

function libelleUrgence(urgence: UrgenceTacheChambre) {
  return { haute: 'Haute', normale: 'Normale', basse: 'Basse' }[urgence]
}

function libelleEtat(etat: string) {
  return { AFFECTE: 'A faire', EN_COURS: 'En cours', BLOQUE: 'Bloque', TERMINE: 'Termine' }[etat] || etat
}

function differenceJours(debut: string, fin: string) {
  const a = new Date(`${debut}T00:00:00`).getTime()
  const b = new Date(`${fin}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

function ajouterJours(date: string, jours: number) {
  const valeur = new Date(`${date}T00:00:00`)
  valeur.setDate(valeur.getDate() + jours)
  return formatDateInput(valeur)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const textareaClass = 'min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const primaryButton = 'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60'
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const dangerButton = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50'
