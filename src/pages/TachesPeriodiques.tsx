import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, RefreshCcw, Save, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  creerPlanningsTachesPeriodiques,
  creerTachePeriodique,
  creerTachesPeriodiques,
  modifierPlanningTachePeriodique,
  modifierTachePeriodique,
  realiserTachePeriodique,
  reporterTachePeriodique,
  supprimerTachePeriodique,
  type LourdeurTache,
  type NatureTache,
  type PrioriteTache,
  type TachePeriodique,
  type TachePeriodiquePlanning,
  type TachePeriodiquePayload,
} from '../api/tachesPeriodiques'
import { useAuth } from '../hooks/useAuth'
import { type PropositionTache, useTachesPeriodiques } from '../hooks/useTachesPeriodiques'

type Onglet = 'referentiel' | 'suivi' | 'avenir' | 'propositions' | 'historique'

const priorites: PrioriteTache[] = ['haute', 'normale', 'basse']
const lourdeurs: LourdeurTache[] = ['leger', 'moyen', 'lourd']
const natures: NatureTache[] = ['obligatoire', 'entretien', 'opportuniste']

export function TachesPeriodiques() {
  const [onglet, setOnglet] = useState<Onglet>('suivi')
  const [recherche, setRecherche] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState('tous')
  const [prioriteFiltre, setPrioriteFiltre] = useState('tous')
  const [statutFiltre, setStatutFiltre] = useState('tous')
  const [edition, setEdition] = useState<TachePeriodique | null>(null)
  const [form, setForm] = useState<TachePeriodiquePayload>(payloadVide())
  const [idsCategoriesCreation, setIdsCategoriesCreation] = useState<string[]>([])
  const [soumission, setSoumission] = useState(false)
  const [realisation, setRealisation] = useState<TachePeriodiquePlanning | null>(null)
  const [report, setReport] = useState<TachePeriodiquePlanning | null>(null)
  const [occurrence, setOccurrence] = useState<TachePeriodique | null>(null)
  const [executantsProposition, setExecutantsProposition] = useState<Record<string, string>>({})
  const [idPlanningAAttribuer, setIdPlanningAAttribuer] = useState<string | null>(null)
  const [idsTachesSelectionnees, setIdsTachesSelectionnees] = useState<string[]>([])
  const [idExecutantAttributionLot, setIdExecutantAttributionLot] = useState('')
  const [idsTachesAvenirSelectionnees, setIdsTachesAvenirSelectionnees] = useState<string[]>([])
  const [idExecutantAttributionAvenir, setIdExecutantAttributionAvenir] = useState('')
  const { estAdmin } = useAuth()
  const {
    taches,
    planning,
    historique,
    lieux,
    executants,
    etats,
    chargement,
    classifications,
    propositions,
    charger,
  } = useTachesPeriodiques()
  const categories = useMemo(
    () => Array.from(new Map(lieux.filter((lieu) => lieu.categorie).map((lieu) => [lieu.categorie!.id, lieu.categorie!])).values()).sort((a, b) => a.nom.localeCompare(b.nom)),
    [lieux],
  )

  const tachesFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return taches.filter((tache) => {
      if (categorieFiltre !== 'tous' && tache.id_categorie_lieu !== categorieFiltre) return false
      if (prioriteFiltre !== 'tous' && tache.priorite !== prioriteFiltre) return false
      if (statutFiltre === 'actif' && !tache.est_actif) return false
      if (statutFiltre === 'inactif' && tache.est_actif) return false
      if (!terme) return true
      return [tache.nom, tache.code, tache.description, tache.categorie_lieu?.nom].filter(Boolean).join(' ').toLowerCase().includes(terme)
    })
  }, [categorieFiltre, prioriteFiltre, recherche, statutFiltre, taches])
  const aujourdHui = formatDateInput(new Date())
  const planningTrie = useMemo(() => [...planning].sort((a, b) => a.date_echeance.localeCompare(b.date_echeance)), [planning])
  const planningSuivi = useMemo(
    () => planningTrie.filter((item) => item.est_actif && !item.date_realisation && item.date_echeance <= aujourdHui),
    [aujourdHui, planningTrie],
  )
  const toutesTachesSuiviSelectionnees = planningSuivi.length > 0 && planningSuivi.every((item) => idsTachesSelectionnees.includes(item.id))
  const planningAvenir = useMemo(
    () => planningTrie.filter((item) => item.est_actif && !item.date_realisation && item.date_echeance > aujourdHui),
    [aujourdHui, planningTrie],
  )
  const toutesTachesAvenirSelectionnees = planningAvenir.length > 0 && planningAvenir.every((item) => idsTachesAvenirSelectionnees.includes(item.id))
  const propositionsAffichees = useMemo(
    () => idPlanningAAttribuer ? propositions.filter((proposition) => proposition.planning.id === idPlanningAAttribuer) : propositions,
    [idPlanningAAttribuer, propositions],
  )

  useEffect(() => {
    const idsVisibles = new Set(planningSuivi.map((item) => item.id))
    setIdsTachesSelectionnees((selection) => selection.filter((id) => idsVisibles.has(id)))
  }, [planningSuivi])

  useEffect(() => {
    const idsVisibles = new Set(planningAvenir.map((item) => item.id))
    setIdsTachesAvenirSelectionnees((selection) => selection.filter((id) => idsVisibles.has(id)))
  }, [planningAvenir])

  function demarrerEdition(tache: TachePeriodique) {
    setEdition(tache)
    setIdsCategoriesCreation([])
    setForm({
      nom: tache.nom,
      code: tache.code,
      description: tache.description,
      id_categorie_lieu: tache.id_categorie_lieu,
      frequence_jours: tache.frequence_jours,
      priorite: tache.priorite,
      niveau_lourdeur: tache.niveau_lourdeur,
      nature: tache.nature,
      points_estimes: tache.points_estimes,
      est_reportable: tache.est_reportable,
      delai_alerte_jours: tache.delai_alerte_jours,
      est_actif: tache.est_actif,
    })
  }

  function annulerEdition() {
    setEdition(null)
    setForm(payloadVide())
    setIdsCategoriesCreation([])
  }

  async function enregistrerTache(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const idsCategories = edition ? (form.id_categorie_lieu ? [form.id_categorie_lieu] : []) : idsCategoriesCreation

    if (!form.nom.trim() || idsCategories.length === 0) {
      toast.error('Le nom et la categorie de lieu sont obligatoires.')
      return
    }

    setSoumission(true)
    try {
      const payload = { ...form, nom: form.nom.trim(), code: form.code?.trim() || null }
      if (edition) await modifierTachePeriodique(edition.id, payload)
      else if (idsCategories.length === 1) await creerTachePeriodique({ ...payload, id_categorie_lieu: idsCategories[0] })
      else {
        const codeBase = payload.code
        const payloads = idsCategories.map((idCategorie) => {
          const categorie = categories.find((item) => item.id === idCategorie)
          return {
            ...payload,
            id_categorie_lieu: idCategorie,
            code: codeBase && categorie?.code ? `${codeBase}-${categorie.code}` : codeBase,
          }
        })
        await creerTachesPeriodiques(payloads)
      }
      toast.success(edition ? 'Tache modifiee.' : `${idsCategories.length} tache(s) creee(s).`)
      annulerEdition()
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setSoumission(false)
    }
  }

  function basculerCategorieCreation(idCategorie: string, coche: boolean) {
    setIdsCategoriesCreation((selection) => coche ? Array.from(new Set([...selection, idCategorie])) : selection.filter((id) => id !== idCategorie))
  }

  async function supprimerTache(tache: TachePeriodique) {
    if (!window.confirm(`Supprimer ${tache.nom} ?`)) return
    try {
      await supprimerTachePeriodique(tache.id)
      toast.success('Tache supprimee.')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    }
  }

  async function creerOccurrence(tache: TachePeriodique, idsLieux: string[], dateEcheance: string) {
    const etatAFaire = etats.find((etat) => etat.nom === 'A_FAIRE')

    if (idsLieux.length === 0) {
      toast.error('Choisissez au moins un lieu.')
      return
    }

    if (!dateEcheance) {
      toast.error('Choisissez une date echeance.')
      return
    }

    if (!etatAFaire) {
      toast.error("L'etat A faire est introuvable. Execute le script SQL des taches periodiques dans Supabase.")
      return
    }

    const idsExistants = new Set(planning.filter((item) => item.id_tache === tache.id).map((item) => item.id_lieu))
    const idsACreer = idsLieux.filter((idLieu) => !idsExistants.has(idLieu))

    if (idsACreer.length === 0) {
      toast.error('Une echeance existe deja pour tous les lieux selectionnes.')
      return
    }

    try {
      await creerPlanningsTachesPeriodiques(idsACreer.map((idLieu) => ({
        id_tache: tache.id,
        id_lieu: idLieu,
        id_executant: null,
        date_realisation: null,
        date_echeance: dateEcheance,
        date_echeance_originale: dateEcheance,
        id_etat: etatAFaire.id,
        est_reportee: false,
        motif_report: null,
        est_actif: true,
      })))
      const ignores = idsLieux.length - idsACreer.length
      toast.success(`${idsACreer.length} echeance(s) creee(s)${ignores > 0 ? `, ${ignores} deja existante(s) ignoree(s)` : ''}.`)
      setOccurrence(null)
      await charger()
    } catch (error) {
      if (estErreurDoublonSupabase(error)) {
        toast.error('Une echeance existe deja pour cette tache et ce lieu.')
        return
      }

      toast.error(error instanceof Error ? error.message : 'Creation impossible.')
    }
  }

  async function accepterProposition(proposition: PropositionTache, idExecutant?: string) {
    const etatAFaire = etats.find((etat) => etat.nom === 'A_FAIRE')

    if (!etatAFaire) {
      toast.error("L'etat A_FAIRE est introuvable.")
      return
    }

    try {
      await modifierPlanningTachePeriodique(proposition.planning.id, {
        id_executant: idExecutant || proposition.executant.id,
        id_etat: etatAFaire.id,
      })
      toast.success('Executant attribue. Les points sont maintenant comptes dans la charge.')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Validation impossible.')
    }
  }

  function basculerTacheSuivi(id: string, coche: boolean) {
    setIdsTachesSelectionnees((selection) => coche ? Array.from(new Set([...selection, id])) : selection.filter((item) => item !== id))
  }

  function selectionnerToutesTachesSuivi(coche: boolean) {
    setIdsTachesSelectionnees(coche ? planningSuivi.map((item) => item.id) : [])
  }

  function basculerTacheAvenir(id: string, coche: boolean) {
    setIdsTachesAvenirSelectionnees((selection) => coche ? Array.from(new Set([...selection, id])) : selection.filter((item) => item !== id))
  }

  function selectionnerToutesTachesAvenir(coche: boolean) {
    setIdsTachesAvenirSelectionnees(coche ? planningAvenir.map((item) => item.id) : [])
  }

  async function attribuerSelection() {
    const etatAFaire = etats.find((etat) => etat.nom === 'A_FAIRE')

    if (idsTachesSelectionnees.length === 0) {
      toast.error('Selectionnez au moins une tache.')
      return
    }

    if (!idExecutantAttributionLot) {
      toast.error('Choisissez un executant.')
      return
    }

    if (!etatAFaire) {
      toast.error("L'etat A_FAIRE est introuvable.")
      return
    }

    setSoumission(true)
    try {
      await Promise.all(idsTachesSelectionnees.map((id) => modifierPlanningTachePeriodique(id, {
        id_executant: idExecutantAttributionLot,
        id_etat: etatAFaire.id,
      })))
      toast.success(`${idsTachesSelectionnees.length} tache(s) attribuee(s).`)
      setIdsTachesSelectionnees([])
      setIdExecutantAttributionLot('')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Attribution impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function attribuerSelectionAvenir() {
    const etatAFaire = etats.find((etat) => etat.nom === 'A_FAIRE')

    if (idsTachesAvenirSelectionnees.length === 0) {
      toast.error('Selectionnez au moins une tache a venir.')
      return
    }

    if (!idExecutantAttributionAvenir) {
      toast.error('Choisissez un executant.')
      return
    }

    if (!etatAFaire) {
      toast.error("L'etat A_FAIRE est introuvable.")
      return
    }

    setSoumission(true)
    try {
      await Promise.all(idsTachesAvenirSelectionnees.map((id) => modifierPlanningTachePeriodique(id, {
        id_executant: idExecutantAttributionAvenir,
        id_etat: etatAFaire.id,
      })))
      toast.success(`${idsTachesAvenirSelectionnees.length} tache(s) a venir attribuee(s).`)
      setIdsTachesAvenirSelectionnees([])
      setIdExecutantAttributionAvenir('')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Attribution impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function realiser(planningItem: TachePeriodiquePlanning, duree: number | null, commentaire: string | null) {
    const etatAFaire = etats.find((etat) => etat.nom === 'A_FAIRE')
    if (!etatAFaire) {
      toast.error("L'etat A faire est introuvable. Execute le script SQL des taches periodiques.")
      return
    }

    try {
      await realiserTachePeriodique(planningItem, {
        id_executant: planningItem.id_executant,
        date_realisation: formatDateInput(new Date()),
        duree_minutes: duree,
        commentaire,
        idEtatAFaire: etatAFaire.id,
      })
      toast.success('Tache realisee et prochaine echeance calculee.')
      setRealisation(null)
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Realisation impossible.')
    }
  }

  async function changerEtat(planningItem: TachePeriodiquePlanning, nomEtat: string) {
    if (nomEtat === 'TERMINE') {
      setRealisation(planningItem)
      return
    }

    if (nomEtat === 'ANNULEE' && !window.confirm('Annuler cette tache ?')) return

    const etat = etats.find((item) => item.nom === nomEtat)
    if (!etat) {
      toast.error(`L'etat ${nomEtat} est introuvable.`)
      return
    }

    try {
      await modifierPlanningTachePeriodique(planningItem.id, { id_etat: etat.id })
      toast.success('Etat mis a jour.')
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Modification impossible.')
    }
  }

  async function reporter(planningItem: TachePeriodiquePlanning, date: string, motif: string) {
    if (!peutReporterTache(planningItem)) {
      toast.error('Cette tache ne peut plus etre reportee.')
      return
    }

    if (!motif.trim()) {
      toast.error('Le motif est obligatoire.')
      return
    }
    try {
      await reporterTachePeriodique(planningItem.id, date, motif.trim())
      toast.success('Tache reportee.')
      setReport(null)
      await charger()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Report impossible.')
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Taches periodiques</h1>
          <p className="mt-1 text-sm text-slate-500">Referentiel, echeances, propositions et historique.</p>
        </div>
        <button type="button" onClick={() => void charger()} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <RefreshCcw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['suivi', 'avenir', 'propositions', 'referentiel', 'historique'] as Onglet[]).map((item) => (
          <button key={item} type="button" onClick={() => setOnglet(item)} className={onglet === item ? 'rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white' : 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'}>
            {libelleOnglet(item)}
          </button>
        ))}
      </div>

      {onglet === 'referentiel' && (
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={enregistrerTache} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              {edition ? <Pencil className="h-4 w-4 text-teal-700" /> : <Plus className="h-4 w-4 text-teal-700" />}
              <h2 className="font-semibold text-slate-950">{edition ? 'Modifier' : 'Ajouter'} une tache</h2>
            </div>
            <Champ label="Nom"><input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={inputClass} /></Champ>
            <Champ label="Code"><input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} /></Champ>
            <Champ label="Categorie de lieu">
              {edition ? (
                <select value={form.id_categorie_lieu || ''} onChange={(e) => setForm({ ...form, id_categorie_lieu: e.target.value || null })} className={inputClass}>
                  <option value="">Choisir</option>
                  {categories.map((categorie) => <option key={categorie.id} value={categorie.id}>{categorie.nom}</option>)}
                </select>
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
                  {categories.length === 0 && <p className="px-1 py-2 text-sm text-slate-500">Aucune categorie disponible.</p>}
                  {categories.map((categorie) => (
                    <label key={categorie.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={idsCategoriesCreation.includes(categorie.id)}
                        onChange={(e) => basculerCategorieCreation(categorie.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      />
                      <span>{categorie.nom}</span>
                    </label>
                  ))}
                </div>
              )}
              {!edition && idsCategoriesCreation.length > 1 && (
                <p className="mt-1 text-xs text-slate-500">{idsCategoriesCreation.length} taches seront creees, une par categorie selectionnee.</p>
              )}
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Frequence"><input type="number" min={1} value={form.frequence_jours} onChange={(e) => setForm({ ...form, frequence_jours: Number(e.target.value) })} className={inputClass} /></Champ>
              <Champ label="Points"><input type="number" min={0} value={form.points_estimes} onChange={(e) => setForm({ ...form, points_estimes: Number(e.target.value) })} className={inputClass} /></Champ>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Priorite"><SelectSimple value={form.priorite} values={priorites} onChange={(value) => setForm({ ...form, priorite: value as PrioriteTache })} /></Champ>
              <Champ label="Lourdeur"><SelectSimple value={form.niveau_lourdeur} values={lourdeurs} onChange={(value) => setForm({ ...form, niveau_lourdeur: value as LourdeurTache })} /></Champ>
            </div>
            <Champ label="Nature"><SelectSimple value={form.nature} values={natures} onChange={(value) => setForm({ ...form, nature: value as NatureTache })} /></Champ>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.est_reportable} onChange={(e) => setForm({ ...form, est_reportable: e.target.checked })} />Reportable</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.est_actif} onChange={(e) => setForm({ ...form, est_actif: e.target.checked })} />Active</label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {edition && <button type="button" onClick={annulerEdition} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><X className="mr-1 inline h-4 w-4" />Annuler</button>}
              <button disabled={soumission} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="mr-1 inline h-4 w-4" />Enregistrer</button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <Filtres recherche={recherche} setRecherche={setRecherche} categorieFiltre={categorieFiltre} setCategorieFiltre={setCategorieFiltre} categories={categories} prioriteFiltre={prioriteFiltre} setPrioriteFiltre={setPrioriteFiltre} statutFiltre={statutFiltre} setStatutFiltre={setStatutFiltre} />
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50"><tr><Th>Nom</Th><Th>Categorie</Th><Th>Frequence</Th><Th>Priorite</Th><Th>Points</Th><Th>Actions</Th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {chargement && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>}
                  {!chargement && tachesFiltrees.map((tache) => (
                    <tr key={tache.id}>
                      <Td><p className="font-semibold text-slate-900">{tache.nom}</p><p className="text-xs text-slate-500">{tache.code}</p></Td>
                      <Td>{tache.categorie_lieu?.nom || '-'}</Td><Td>{tache.frequence_jours} j</Td><Td>{tache.priorite}</Td><Td>{tache.points_estimes}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <button onClick={() => demarrerEdition(tache)} className={iconButton}><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => setOccurrence(tache)} className={iconButton}><Plus className="h-4 w-4" /></button>
                          {estAdmin() && <button onClick={() => void supprimerTache(tache)} className={dangerButton}><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {onglet === 'suivi' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">A traiter maintenant</h2>
            <p className="mt-1 text-sm text-slate-500">Taches en retard et taches dues aujourd'hui.</p>
          </div>
          {idsTachesSelectionnees.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-teal-100 bg-teal-50 p-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-semibold text-teal-900">{idsTachesSelectionnees.length} tache(s) selectionnee(s)</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select value={idExecutantAttributionLot} onChange={(e) => setIdExecutantAttributionLot(e.target.value)} className={inputClass}>
                  <option value="">Choisir un executant</option>
                  {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
                </select>
                <button type="button" disabled={soumission || !idExecutantAttributionLot} onClick={() => void attribuerSelection()} className="h-10 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white disabled:opacity-60">Attribuer</button>
                <button type="button" onClick={() => { setIdsTachesSelectionnees([]); setIdExecutantAttributionLot('') }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Annuler</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>
                    <input
                      type="checkbox"
                      checked={toutesTachesSuiviSelectionnees}
                      onChange={(e) => selectionnerToutesTachesSuivi(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                  </Th>
                  <Th>Tache</Th><Th>Lieu</Th><Th>Echeance</Th><Th>Classification</Th><Th>Etat</Th><Th>Executant</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {planningSuivi.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Aucune tache urgente a traiter.</td></tr>}
                {planningSuivi.map((item) => {
                  const classification = classifications.get(item.id)
                  return (
                    <tr key={item.id}>
                      <Td>
                        <input
                          type="checkbox"
                          checked={idsTachesSelectionnees.includes(item.id)}
                          onChange={(e) => basculerTacheSuivi(item.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        />
                      </Td>
                      <Td><p className="font-semibold text-slate-900">{item.tache?.nom}</p><p className="text-xs text-slate-500">{item.tache?.nature} - {item.tache?.points_estimes} pts</p></Td>
                      <Td>{item.lieu?.nom}</Td>
                      <Td>{formatDateCourte(item.date_echeance)}{item.est_reportee && <p className="text-xs text-amber-700">Reportee</p>}</Td>
                      <Td><Badge tone={classification?.couleur || 'slate'}>{classification?.label || '-'}</Badge></Td>
                      <Td><Badge tone={couleurEtat(item.etat?.nom)}>{libelleEtatTache(item.etat?.nom)}</Badge></Td>
                      <Td>{item.executant?.nom || 'Non affecte'}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {item.id_executant ? (
                            <select value={item.etat?.nom || 'A_FAIRE'} onChange={(e) => void changerEtat(item, e.target.value)} className={inputClass}>
                              {['A_FAIRE', 'EN_COURS', 'BLOQUE', 'ANNULEE', 'TERMINE'].map((etat) => <option key={etat} value={etat}>{libelleEtatTache(etat)}</option>)}
                            </select>
                          ) : (
                            <button onClick={() => { setIdPlanningAAttribuer(item.id); setOnglet('propositions') }} className={iconButton}>Attribuer</button>
                          )}
                          {peutReporterTache(item) && <button onClick={() => setReport(item)} className={iconButton}>Reporter</button>}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onglet === 'avenir' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">Prochaines echeances</h2>
            <p className="mt-1 text-sm text-slate-500">Taches a preparer pour les jours a venir.</p>
          </div>
          {idsTachesAvenirSelectionnees.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-teal-100 bg-teal-50 p-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm font-semibold text-teal-900">{idsTachesAvenirSelectionnees.length} tache(s) a venir selectionnee(s)</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select value={idExecutantAttributionAvenir} onChange={(e) => setIdExecutantAttributionAvenir(e.target.value)} className={inputClass}>
                  <option value="">Choisir un executant</option>
                  {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
                </select>
                <button type="button" disabled={soumission || !idExecutantAttributionAvenir} onClick={() => void attribuerSelectionAvenir()} className="h-10 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white disabled:opacity-60">Attribuer</button>
                <button type="button" onClick={() => { setIdsTachesAvenirSelectionnees([]); setIdExecutantAttributionAvenir('') }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">Annuler</button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <Th>
                    <input
                      type="checkbox"
                      checked={toutesTachesAvenirSelectionnees}
                      onChange={(e) => selectionnerToutesTachesAvenir(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                  </Th>
                  <Th>Tache</Th><Th>Lieu</Th><Th>Echeance</Th><Th>Classification</Th><Th>Etat</Th><Th>Executant</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {planningAvenir.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Aucune tache a venir.</td></tr>}
                {planningAvenir.map((item) => {
                  const classification = classifications.get(item.id)
                  return (
                    <tr key={item.id}>
                      <Td>
                        <input
                          type="checkbox"
                          checked={idsTachesAvenirSelectionnees.includes(item.id)}
                          onChange={(e) => basculerTacheAvenir(item.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                        />
                      </Td>
                      <Td><p className="font-semibold text-slate-900">{item.tache?.nom}</p><p className="text-xs text-slate-500">{item.tache?.nature} - {item.tache?.points_estimes} pts</p></Td>
                      <Td>{item.lieu?.nom}</Td>
                      <Td>{formatDateCourte(item.date_echeance)}{item.est_reportee && <p className="text-xs text-amber-700">Reportee</p>}</Td>
                      <Td><Badge tone={classification?.couleur || 'slate'}>{classification?.label || '-'}</Badge></Td>
                      <Td><Badge tone={couleurEtat(item.etat?.nom)}>{libelleEtatTache(item.etat?.nom)}</Badge></Td>
                      <Td>{item.executant?.nom || 'Non affecte'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onglet === 'propositions' && (
        <div className="space-y-3">
          {idPlanningAAttribuer && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setIdPlanningAAttribuer(null)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                Voir toutes les propositions
              </button>
            </div>
          )}
          {propositionsAffichees.length === 0 && <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">Aucune proposition disponible pour cette tache.</div>}
          {propositionsAffichees.map((proposition) => {
            const cle = `${proposition.planning.id}-${proposition.executant.id}`
            const idExecutant = executantsProposition[cle] || proposition.executant.id

            return (
              <div key={cle} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{proposition.planning.tache?.nom} - {proposition.planning.lieu?.nom}</p>
                    <p className="text-sm text-slate-500">{formatDateCourte(proposition.planning.date_echeance)} - {proposition.planning.tache?.points_estimes} pts - {proposition.classification.label}</p>
                    {proposition.dateAffectation !== proposition.planning.date_echeance && (
                      <p className="mt-1 text-xs font-semibold text-teal-700">A traiter le {formatDateCourte(proposition.dateAffectation)}</p>
                    )}
                    {!proposition.lieuDisponible && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">Disponibilite a verifier</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={idExecutant} onChange={(e) => setExecutantsProposition({ ...executantsProposition, [cle]: e.target.value })} className={inputClass}>
                      {executants.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
                    </select>
                    <button onClick={() => void accepterProposition(proposition, idExecutant)} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Valider l'affectation</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {onglet === 'historique' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50"><tr><Th>Date</Th><Th>Tache</Th><Th>Lieu</Th><Th>Executant</Th><Th>Duree</Th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {historique.map((item) => <tr key={item.id}><Td>{formatDateCourte(item.date_realisation)}</Td><Td>{item.tache?.nom}</Td><Td>{item.lieu?.nom}</Td><Td>{item.executant?.nom || '-'}</Td><Td>{item.duree_minutes || '-'} min</Td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {realisation && <RealisationModal planning={realisation} executants={executants} onClose={() => setRealisation(null)} onSubmit={realiser} />}
      {report && <ReportModal planning={report} onClose={() => setReport(null)} onSubmit={reporter} />}
      {occurrence && <OccurrenceModal tache={occurrence} lieux={lieux} onClose={() => setOccurrence(null)} onSubmit={creerOccurrence} />}
    </section>
  )
}

function OccurrenceModal({ tache, lieux, onClose, onSubmit }: { tache: TachePeriodique; lieux: Array<{ id: string; nom: string; id_categorie: string; est_actif: boolean; batiment?: { nom: string } | null }>; onClose: () => void; onSubmit: (tache: TachePeriodique, idsLieux: string[], dateEcheance: string) => Promise<void> }) {
  const [idsLieux, setIdsLieux] = useState<string[]>([])
  const [rechercheLieu, setRechercheLieu] = useState('')
  const [date, setDate] = useState(formatDateInput(new Date()))
  const [soumission, setSoumission] = useState(false)
  const lieuxCompatibles = lieux.filter((lieu) => lieu.est_actif && (!tache.id_categorie_lieu || lieu.id_categorie === tache.id_categorie_lieu))
  const terme = rechercheLieu.trim().toLowerCase()
  const lieuxAffiches = lieuxCompatibles.filter((lieu) => {
    if (!terme) return true
    return [lieu.nom, lieu.batiment?.nom].filter(Boolean).join(' ').toLowerCase().includes(terme)
  })
  const tousAffichesSelectionnes = lieuxAffiches.length > 0 && lieuxAffiches.every((lieu) => idsLieux.includes(lieu.id))

  function basculerLieu(idLieu: string, coche: boolean) {
    setIdsLieux((selection) => coche ? Array.from(new Set([...selection, idLieu])) : selection.filter((id) => id !== idLieu))
  }

  function basculerTousAffiches(coche: boolean) {
    const idsAffiches = lieuxAffiches.map((lieu) => lieu.id)
    setIdsLieux((selection) => {
      if (coche) return Array.from(new Set([...selection, ...idsAffiches]))
      return selection.filter((id) => !idsAffiches.includes(id))
    })
  }

  async function creer() {
    setSoumission(true)
    try {
      await onSubmit(tache, idsLieux, date)
    } finally {
      setSoumission(false)
    }
  }

  return (
    <Modal title="Creer une echeance" onClose={onClose}>
      <p className="text-sm text-slate-600">{tache.nom}</p>
      <Champ label="Lieux">
        <div className="rounded-md border border-slate-300 bg-white">
          <div className="border-b border-slate-200 p-2">
            <input
              value={rechercheLieu}
              onChange={(e) => setRechercheLieu(e.target.value)}
              placeholder="Rechercher un lieu..."
              className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
            <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={tousAffichesSelectionnes} onChange={(e) => basculerTousAffiches(e.target.checked)} />
              Selectionner les lieux affiches
            </label>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {lieuxAffiches.map((lieu) => (
              <label key={lieu.id} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <input type="checkbox" checked={idsLieux.includes(lieu.id)} onChange={(e) => basculerLieu(lieu.id, e.target.checked)} />
                <span>{lieu.nom}{lieu.batiment ? ` (${lieu.batiment.nom})` : ''}</span>
              </label>
            ))}
            {lieuxAffiches.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Aucun lieu trouve.</p>}
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">{idsLieux.length} lieu(x) selectionne(s)</p>
        {lieuxCompatibles.length === 0 && <p className="mt-1 text-xs text-amber-700">Aucun lieu dans cette categorie.</p>}
      </Champ>
      <Champ label="Date echeance"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Champ>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm font-semibold">Annuler</button>
        <button type="button" disabled={soumission || idsLieux.length === 0} onClick={() => void creer()} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{soumission ? 'Creation...' : 'Creer'}</button>
      </div>
    </Modal>
  )
}

function RealisationModal({ planning, executants, onClose, onSubmit }: { planning: TachePeriodiquePlanning; executants: Array<{ id: string; nom: string }>; onClose: () => void; onSubmit: (planning: TachePeriodiquePlanning, duree: number | null, commentaire: string | null) => Promise<void> }) {
  const [duree, setDuree] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [soumission, setSoumission] = useState(false)

  async function valider() {
    setSoumission(true)
    try {
      await onSubmit(planning, duree ? Number(duree) : null, commentaire || null)
    } finally {
      setSoumission(false)
    }
  }

  return <Modal title="Marquer comme realisee" onClose={onClose}><p className="text-sm text-slate-600">{planning.tache?.nom} - {planning.lieu?.nom}</p><Champ label="Duree minutes"><input value={duree} onChange={(e) => setDuree(e.target.value)} type="number" className={inputClass} /></Champ><Champ label="Commentaire"><textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className={inputClass} /></Champ><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm font-semibold">Annuler</button><button type="button" disabled={soumission} onClick={() => void valider()} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{soumission ? 'Validation...' : 'Valider'}</button></div></Modal>
}

function ReportModal({ planning, onClose, onSubmit }: { planning: TachePeriodiquePlanning; onClose: () => void; onSubmit: (planning: TachePeriodiquePlanning, date: string, motif: string) => void }) {
  const [date, setDate] = useState(planning.date_echeance)
  const [motif, setMotif] = useState('')
  return <Modal title="Reporter la tache" onClose={onClose}><Champ label="Nouvelle echeance"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Champ><Champ label="Motif"><textarea value={motif} onChange={(e) => setMotif(e.target.value)} className={inputClass} /></Champ><div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="rounded-md border px-3 py-2 text-sm font-semibold">Annuler</button><button onClick={() => onSubmit(planning, date, motif)} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Reporter</button></div></Modal>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4"><div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-slate-950">{title}</h2><button onClick={onClose}><X className="h-4 w-4" /></button></div>{children}</div></div>
}

function Filtres({ recherche, setRecherche, categorieFiltre, setCategorieFiltre, categories, prioriteFiltre, setPrioriteFiltre, statutFiltre, setStatutFiltre }: any) {
  return <div className="grid gap-2 border-b border-slate-200 p-4 md:grid-cols-4"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Recherche..." className={`${inputClass} pl-9`} /></label><select value={categorieFiltre} onChange={(e) => setCategorieFiltre(e.target.value)} className={inputClass}><option value="tous">Toutes categories</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select><select value={prioriteFiltre} onChange={(e) => setPrioriteFiltre(e.target.value)} className={inputClass}><option value="tous">Toutes priorites</option>{priorites.map((p) => <option key={p} value={p}>{p}</option>)}</select><select value={statutFiltre} onChange={(e) => setStatutFiltre(e.target.value)} className={inputClass}><option value="tous">Tous statuts</option><option value="actif">Actif</option><option value="inactif">Inactif</option></select></div>
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-3 block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>
}

function SelectSimple({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>{values.map((item) => <option key={item} value={item}>{item}</option>)}</select>
}

function Badge({ tone, children }: { tone: 'red' | 'orange' | 'green' | 'slate'; children: React.ReactNode }) {
  const classes = { red: 'bg-rose-50 text-rose-800 ring-rose-100', orange: 'bg-amber-50 text-amber-800 ring-amber-100', green: 'bg-emerald-50 text-emerald-800 ring-emerald-100', slate: 'bg-slate-100 text-slate-700 ring-slate-200' }
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>{children}</span>
}

function couleurEtat(etat?: string): 'red' | 'orange' | 'green' | 'slate' {
  if (etat === 'EN_COURS') return 'orange'
  if (etat === 'BLOQUE' || etat === 'ANNULEE') return 'red'
  if (etat === 'TERMINE') return 'green'
  return 'slate'
}

function libelleEtatTache(etat?: string) {
  return {
    A_FAIRE: 'A faire',
    EN_COURS: 'En cours',
    BLOQUE: 'Bloquee',
    ANNULEE: 'Annulee',
    TERMINE: 'Terminee',
  }[etat || 'A_FAIRE']
}

function peutReporterTache(planning: TachePeriodiquePlanning) {
  return !['EN_COURS', 'TERMINE'].includes(planning.etat?.nom || '')
}

function estErreurDoublonSupabase(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-left font-semibold text-slate-600">{children}</th> }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3 text-slate-700">{children}</td> }

function payloadVide(): TachePeriodiquePayload {
  return { nom: '', code: null, description: null, id_categorie_lieu: null, frequence_jours: 30, priorite: 'normale', niveau_lourdeur: 'moyen', nature: 'entretien', points_estimes: 1, est_reportable: true, delai_alerte_jours: 3, est_actif: true }
}

function libelleOnglet(onglet: Onglet) {
  return { referentiel: 'Referentiel', suivi: 'Suivi', avenir: 'A venir', propositions: 'Propositions', historique: 'Historique' }[onglet]
}

const inputClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100'
const iconButton = 'inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
const dangerButton = 'inline-flex h-9 items-center justify-center rounded-md border border-rose-300 px-2 text-rose-700 hover:bg-rose-50'

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function formatDateCourte(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}
