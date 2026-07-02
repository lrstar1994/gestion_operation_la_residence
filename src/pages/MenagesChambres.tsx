import { useCallback, useEffect, useMemo, useState } from 'react'
import { BedDouble, History, Loader2, Plus, RefreshCcw, Search } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import { estLieuChambre, listerLieux, type Lieu } from '../api/lieux'
import {
  creerMouvementChambre,
  listerEtatsMouvement,
  listerPlanningChambre,
  listerTypesMouvement,
  type EtatMouvement,
  type PlanningChambre,
  type TypeMouvement,
} from '../api/planningChambre'
import { useAuth } from '../hooks/useAuth'

type Onglet = 'planifier' | 'historique'

type ChambreSansMouvement = {
  id: string
  chambre: Lieu
  date: string
}

export function MenagesChambres() {
  const { estAdmin, peutAccederAuDomaine } = useAuth()
  const [onglet, setOnglet] = useState<Onglet>('planifier')
  const [dateDebut, setDateDebut] = useState(formatDateInput(new Date()))
  const [dateFin, setDateFin] = useState(formatDateInput(new Date()))
  const [recherchePlanifier, setRecherchePlanifier] = useState('')
  const [rechercheHistorique, setRechercheHistorique] = useState('')
  const [batimentPlanifier, setBatimentPlanifier] = useState('tous')
  const [batimentHistorique, setBatimentHistorique] = useState('tous')
  const [chambreHistorique, setChambreHistorique] = useState('tous')
  const [executantHistorique, setExecutantHistorique] = useState('tous')
  const [etatHistorique, setEtatHistorique] = useState('tous')
  const [chambres, setChambres] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [types, setTypes] = useState<TypeMouvement[]>([])
  const [etats, setEtats] = useState<EtatMouvement[]>([])
  const [planning, setPlanning] = useState<PlanningChambre[]>([])
  const [selection, setSelection] = useState<string[]>([])
  const [idExecutant, setIdExecutant] = useState('')
  const [chargement, setChargement] = useState(true)
  const [soumission, setSoumission] = useState(false)

  const peutModifier = estAdmin() || peutAccederAuDomaine('chambres')
  const typeMenage = types.find((type) => type.nom.toUpperCase() === 'MENAGE')
  const etatAffecte = etats.find((etat) => etat.nom === 'AFFECTE') || etats[0]

  const charger = useCallback(async () => {
    if (dateFin < dateDebut) {
      toast.error('La date fin doit etre apres la date debut.')
      return
    }

    setChargement(true)
    try {
      const [lieuxResultat, executantsResultat, typesResultat, etatsResultat, planningResultat] = await Promise.all([
        listerLieux(),
        listerExecutants(),
        listerTypesMouvement(),
        listerEtatsMouvement(),
        listerPlanningChambre(dateDebut, dateFin),
      ])

      setChambres(lieuxResultat.filter((lieu) => lieu.est_actif && estLieuChambre(lieu)))
      setExecutants(executantsResultat.filter((executant) => executant.domaine?.nom.toLowerCase().includes('chambre')))
      setTypes(typesResultat)
      setEtats(etatsResultat)
      setPlanning(planningResultat)
      setSelection([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Menages chambres impossibles a charger.')
    } finally {
      setChargement(false)
    }
  }, [dateDebut, dateFin])

  useEffect(() => {
    void charger()
  }, [charger])

  const dates = useMemo(() => genererDates(dateDebut, dateFin), [dateDebut, dateFin])
  const batiments = useMemo(
    () => Array.from(new Map(chambres.filter((chambre) => chambre.batiment).map((chambre) => [chambre.batiment!.id, chambre.batiment!])).values()).sort((a, b) => a.nom.localeCompare(b.nom)),
    [chambres],
  )
  const clesAvecMouvement = useMemo(() => new Set(planning.map((mouvement) => cleChambreDate(mouvement.id_lieu, mouvement.date))), [planning])

  const chambresSansMouvement = useMemo(() => {
    const terme = recherchePlanifier.trim().toLowerCase()
    const lignes: ChambreSansMouvement[] = []

    chambres.forEach((chambre) => {
      if (batimentPlanifier !== 'tous' && chambre.id_batiment !== batimentPlanifier) return

      dates.forEach((date) => {
        if (clesAvecMouvement.has(cleChambreDate(chambre.id, date))) return

        if (terme) {
          const texte = [chambre.nom, chambre.numero, chambre.batiment?.nom].filter(Boolean).join(' ').toLowerCase()
          if (!texte.includes(terme)) return
        }

        lignes.push({ id: cleChambreDate(chambre.id, date), chambre, date })
      })
    })

    return lignes.sort((a, b) => a.date.localeCompare(b.date) || nomLieu(a.chambre).localeCompare(nomLieu(b.chambre)))
  }, [batimentPlanifier, chambres, clesAvecMouvement, dates, recherchePlanifier])

  const historique = useMemo(() => {
    const terme = rechercheHistorique.trim().toLowerCase()

    return planning
      .filter((mouvement) => mouvement.type_mouvement?.nom.toUpperCase() === 'MENAGE')
      .filter((mouvement) => chambreHistorique === 'tous' || mouvement.id_lieu === chambreHistorique)
      .filter((mouvement) => batimentHistorique === 'tous' || mouvement.lieu?.id_batiment === batimentHistorique)
      .filter((mouvement) => executantHistorique === 'tous' || mouvement.id_executant === executantHistorique)
      .filter((mouvement) => etatHistorique === 'tous' || mouvement.etat?.nom === etatHistorique)
      .filter((mouvement) => {
        if (!terme) return true
        return [mouvement.lieu?.nom, mouvement.lieu?.numero, mouvement.lieu?.batiment?.nom, mouvement.executant?.nom, mouvement.etat?.nom]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(terme)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || nomLieuPlanning(a).localeCompare(nomLieuPlanning(b)))
  }, [batimentHistorique, chambreHistorique, etatHistorique, executantHistorique, planning, rechercheHistorique])

  const historiqueParChambre = useMemo(() => {
    const map = new Map<string, { titre: string; sousTitre: string; mouvements: PlanningChambre[] }>()

    historique.forEach((mouvement) => {
      const id = mouvement.id_lieu
      const groupe = map.get(id) || {
        titre: nomLieuPlanning(mouvement),
        sousTitre: mouvement.lieu?.batiment?.nom || '-',
        mouvements: [],
      }
      groupe.mouvements.push(mouvement)
      map.set(id, groupe)
    })

    return Array.from(map.entries()).map(([id, groupe]) => ({ id, ...groupe }))
  }, [historique])

  function basculerLigne(id: string, coche: boolean) {
    setSelection((liste) => coche ? Array.from(new Set([...liste, id])) : liste.filter((item) => item !== id))
  }

  function selectionnerTout(coche: boolean) {
    setSelection(coche ? chambresSansMouvement.map((ligne) => ligne.id) : [])
  }

  async function creerMenages() {
    if (!peutModifier) {
      toast.error("Vous n'avez pas le droit de creer des menages.")
      return
    }

    if (!typeMenage) {
      toast.error('Le type MENAGE est introuvable. Executez database/menages_chambres.sql dans Supabase.')
      return
    }

    if (!etatAffecte) {
      toast.error("L'etat AFFECTE est introuvable.")
      return
    }

    if (!idExecutant) {
      toast.error('Choisissez un executant chambre.')
      return
    }

    const lignes = chambresSansMouvement.filter((ligne) => selection.includes(ligne.id))
    if (lignes.length === 0) {
      toast.error('Selectionnez au moins une chambre sans mouvement.')
      return
    }

    setSoumission(true)
    try {
      const planningActuel = await listerPlanningChambre(dateDebut, dateFin)
      const clesActuelles = new Set(planningActuel.map((mouvement) => cleChambreDate(mouvement.id_lieu, mouvement.date)))
      const lignesDisponibles = lignes.filter((ligne) => !clesActuelles.has(cleChambreDate(ligne.chambre.id, ligne.date)))

      if (lignesDisponibles.length === 0) {
        toast.warning('Les chambres selectionnees ont deja un mouvement.')
        await charger()
        return
      }

      const sauvegardes = await Promise.all(lignesDisponibles.map((ligne) =>
        creerMouvementChambre({
          id_lieu: ligne.chambre.id,
          date: ligne.date,
          id_type_mouvement: typeMenage.id,
          id_executant: idExecutant,
          id_etat: etatAffecte.id,
        }),
      ))

      toast.success(`${sauvegardes.length} menage(s) cree(s).`)
      setOnglet('historique')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Creation des menages impossible.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-700">Chambres</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Menages chambres</h1>
          <p className="mt-1 text-sm text-slate-500">Planification des menages pour les chambres sans mouvement et historique par chambre.</p>
        </div>
        <button type="button" onClick={() => void charger()} className={secondaryButton}>
          <RefreshCcw className="h-4 w-4" />
          Rafraichir
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <TabButton actif={onglet === 'planifier'} onClick={() => setOnglet('planifier')} icon={BedDouble} label="A planifier" badge={chambresSansMouvement.length} />
          <TabButton actif={onglet === 'historique'} onClick={() => setOnglet('historique')} icon={History} label="Historique" badge={historique.length} />
        </div>

        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-6">
          <Champ label="Date debut">
            <input type="date" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} className={inputClass} />
          </Champ>
          <Champ label="Date fin">
            <input type="date" value={dateFin} onChange={(event) => setDateFin(event.target.value)} className={inputClass} />
          </Champ>
          {onglet === 'planifier' ? (
            <>
              <Champ label="Batiment">
                <select value={batimentPlanifier} onChange={(event) => setBatimentPlanifier(event.target.value)} className={inputClass}>
                  <option value="tous">Tous les batiments</option>
                  {batiments.map((batiment) => <option key={batiment.id} value={batiment.id}>{batiment.nom}</option>)}
                </select>
              </Champ>
              <Champ label="Recherche">
                <Recherche value={recherchePlanifier} onChange={setRecherchePlanifier} placeholder="Chambre, numero..." />
              </Champ>
              <Champ label="Executant">
                <select value={idExecutant} onChange={(event) => setIdExecutant(event.target.value)} className={inputClass}>
                  <option value="">Choisir</option>
                  {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
                </select>
              </Champ>
              <div className="flex items-end">
                <button type="button" disabled={soumission || selection.length === 0} onClick={() => void creerMenages()} className={primaryButton}>
                  {soumission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Creer
                </button>
              </div>
            </>
          ) : (
            <>
              <Champ label="Batiment">
                <select value={batimentHistorique} onChange={(event) => setBatimentHistorique(event.target.value)} className={inputClass}>
                  <option value="tous">Tous les batiments</option>
                  {batiments.map((batiment) => <option key={batiment.id} value={batiment.id}>{batiment.nom}</option>)}
                </select>
              </Champ>
              <Champ label="Chambre">
                <select value={chambreHistorique} onChange={(event) => setChambreHistorique(event.target.value)} className={inputClass}>
                  <option value="tous">Toutes les chambres</option>
                  {chambres.map((chambre) => <option key={chambre.id} value={chambre.id}>{nomLieu(chambre)}</option>)}
                </select>
              </Champ>
              <Champ label="Executant">
                <select value={executantHistorique} onChange={(event) => setExecutantHistorique(event.target.value)} className={inputClass}>
                  <option value="tous">Tous les executants</option>
                  {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
                </select>
              </Champ>
              <Champ label="Etat">
                <select value={etatHistorique} onChange={(event) => setEtatHistorique(event.target.value)} className={inputClass}>
                  <option value="tous">Tous les etats</option>
                  {etats.map((etat) => <option key={etat.id} value={etat.nom}>{etat.nom}</option>)}
                </select>
              </Champ>
              <Champ label="Recherche">
                <Recherche value={rechercheHistorique} onChange={setRechercheHistorique} placeholder="Chambre, executant..." />
              </Champ>
            </>
          )}
        </div>

        {!typeMenage && (
          <p className="m-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Le type MENAGE n'existe pas encore dans Supabase. Executez le fichier database/menages_chambres.sql.
          </p>
        )}

        {onglet === 'planifier' ? (
          <div>
            <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Chambres sans mouvement</h2>
                <p className="text-sm text-slate-500">{chambresSansMouvement.length} ligne(s), {selection.length} selectionnee(s).</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={chambresSansMouvement.length > 0 && selection.length === chambresSansMouvement.length} onChange={(event) => selectionnerTout(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                Tout selectionner
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3"></th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Chambre</th>
                    <th className="px-4 py-3">Batiment</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chargement && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>}
                  {!chargement && chambresSansMouvement.map((ligne) => (
                    <tr key={ligne.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selection.includes(ligne.id)} onChange={(event) => basculerLigne(ligne.id, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                      </td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(ligne.date)}</td>
                      <td className="px-4 py-3 font-medium text-slate-950">{ligne.chambre.nom}</td>
                      <td className="px-4 py-3 text-slate-600">{ligne.chambre.batiment?.nom || '-'}</td>
                      <td className="px-4 py-3"><Badge tone="slate">Aucun mouvement</Badge></td>
                    </tr>
                  ))}
                  {!chargement && chambresSansMouvement.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucune chambre sans mouvement sur cette periode.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {chargement && <p className="p-8 text-center text-sm text-slate-500">Chargement...</p>}
            {!chargement && historiqueParChambre.map((groupe) => (
              <div key={groupe.id} className="p-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-950">{groupe.titre}</h2>
                    <p className="text-xs text-slate-500">{groupe.sousTitre}</p>
                  </div>
                  <span className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{groupe.mouvements.length} menage(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Executant</th>
                        <th className="px-4 py-3">Etat</th>
                        <th className="px-4 py-3">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupe.mouvements.map((mouvement) => (
                        <tr key={mouvement.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">{formatDate(mouvement.date)}</td>
                          <td className="px-4 py-3 text-slate-700">{mouvement.executant?.nom || 'Non affecte'}</td>
                          <td className="px-4 py-3"><Badge tone={couleurEtat(mouvement.etat?.nom)}>{mouvement.etat?.nom || '-'}</Badge></td>
                          <td className="px-4 py-3 text-slate-700">{mouvement.type_mouvement?.points || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {!chargement && historiqueParChambre.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucun menage dans l'historique.</p>}
          </div>
        )}
      </div>
    </section>
  )
}

function TabButton({ actif, onClick, icon: Icon, label, badge }: { actif: boolean; onClick: () => void; icon: LucideIcon; label: string; badge: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition',
        actif ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">{badge}</span>
    </button>
  )
}

function Recherche({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${inputClass} pl-9`} />
    </label>
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

function couleurEtat(etat?: string): 'red' | 'orange' | 'green' | 'slate' {
  if (etat === 'BLOQUE' || etat === 'ANNULEE') return 'red'
  if (etat === 'EN_COURS') return 'orange'
  if (etat === 'TERMINE') return 'green'
  return 'slate'
}

function genererDates(dateDebut: string, dateFin: string) {
  if (!dateDebut || !dateFin || dateFin < dateDebut) return []

  const dates: string[] = []
  const courant = new Date(`${dateDebut}T00:00:00`)
  const fin = new Date(`${dateFin}T00:00:00`)

  while (courant <= fin) {
    dates.push(formatDateInput(courant))
    courant.setDate(courant.getDate() + 1)
  }

  return dates
}

function cleChambreDate(idChambre: string, date: string) {
  return `${idChambre}-${date}`
}

function nomLieu(lieu: Lieu) {
  return `${lieu.nom}${lieu.batiment ? ` (${lieu.batiment.nom})` : ''}`
}

function nomLieuPlanning(mouvement: PlanningChambre) {
  if (!mouvement.lieu) return 'Chambre'
  return nomLieu(mouvement.lieu)
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
const primaryButton = 'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButton = 'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100'
