import { Fragment, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BedDouble, CalendarDays, ChevronLeft, ChevronRight, Maximize2, Minimize2, Save, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Lieu } from '../api/lieux'
import type { ChargeExecutant, PlanningChambre, PlanningChambrePayload } from '../api/planningChambre'
import { listerTachesChambres, type TacheChambre } from '../api/tachesChambres'
import { useAuth } from '../hooks/useAuth'
import { type SuggestionAffectation, usePlanningChambre } from '../hooks/usePlanningChambre'

type ModalCellule = {
  chambre: Lieu
  date: string
  mouvements: PlanningChambre[]
}

type ReaffectationEnAttente = {
  mouvement: PlanningChambre
  payload: PlanningChambrePayload
}

const joursLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function PlanningChambres() {
  const [recherche, setRecherche] = useState('')
  const [batimentFiltre, setBatimentFiltre] = useState('tous')
  const [chambresSelectionnees, setChambresSelectionnees] = useState<string[]>([])
  const [dateLot, setDateLot] = useState(formatDateInput(new Date()))
  const [typeLot, setTypeLot] = useState('')
  const [executantLot, setExecutantLot] = useState('')
  const [remplacer, setRemplacer] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestionAffectation[]>([])
  const [payloadsEnAttente, setPayloadsEnAttente] = useState<PlanningChambrePayload[]>([])
  const [reaffectationsEnAttente, setReaffectationsEnAttente] = useState<ReaffectationEnAttente[]>([])
  const [modal, setModal] = useState<ModalCellule | null>(null)
  const [typeModal, setTypeModal] = useState('')
  const [executantModal, setExecutantModal] = useState('')
  const [mouvementEdition, setMouvementEdition] = useState<PlanningChambre | null>(null)
  const [soumission, setSoumission] = useState(false)
  const [pagePlanning, setPagePlanning] = useState(1)
  const [lignesParPage, setLignesParPage] = useState(15)
  const [panneauSaisieOuvert, setPanneauSaisieOuvert] = useState(false)
  const [modeGrandAngle, setModeGrandAngle] = useState(false)
  const [tachesOperationnelles, setTachesOperationnelles] = useState<TacheChambre[]>([])
  const { estAdmin, peutAccederAuDomaine } = useAuth()

  const aujourdHui = formatDateInput(new Date())

  const {
    chambres,
    executants,
    typesMouvement,
    etats,
    planning,
    charges,
    planningParCellule,
    chargement,
    etatAffecte,
    mouvementPayload,
    executantsEnTravail,
    verifierConflits,
    detecterSurcharges,
    appliquerLot,
    enregistrerMouvement,
    supprimerMouvement,
  } = usePlanningChambre(aujourdHui)

  const peutModifier = estAdmin() || peutAccederAuDomaine('chambres')
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
  const chambresFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase()

    return chambres.filter((chambre) => {
      if (batimentFiltre !== 'tous' && chambre.id_batiment !== batimentFiltre) return false
      if (!terme) return true
      return [chambre.nom, chambre.numero, chambre.batiment?.nom].filter(Boolean).join(' ').toLowerCase().includes(terme)
    })
  }, [batimentFiltre, chambres, recherche])

  const datesVisibles = useMemo(
    () => Array.from(new Set(planning.map((mouvement) => mouvement.date).filter((date) => date >= aujourdHui))).sort(),
    [aujourdHui, planning],
  )
  const mouvementsParJour = datesVisibles.map((date) => {
    return planning.filter((mouvement) => mouvement.date === date)
  })
  const executantsLotDisponibles = executantsEnTravail(dateLot)
  const chargesBatiments = useMemo(() => {
    const map = new Map<string, { id: string; nom: string; pointsParDate: Map<string, number>; total: number }>()

    planning.forEach((mouvement) => {
      const batiment = mouvement.lieu?.batiment
      const id = batiment?.id || 'sans-batiment'
      const nom = batiment?.nom || 'Sans batiment'
      const points = mouvement.type_mouvement?.points || 0
      const charge = map.get(id) || { id, nom, pointsParDate: new Map<string, number>(), total: 0 }

      charge.pointsParDate.set(mouvement.date, (charge.pointsParDate.get(mouvement.date) || 0) + points)
      charge.total += points
      map.set(id, charge)
    })

    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [planning])
  const datesOperationnelles = useMemo(
    () => Array.from(new Set(tachesOperationnelles.map((tache) => tache.date_execution))).sort(),
    [tachesOperationnelles],
  )
  const chargesExecutantsOperationnelles = useMemo(() => {
    return executants.map((executant) => {
      const tachesExecutant = tachesOperationnelles.filter((tache) => tache.id_executant === executant.id)
      const capaciteMax = executant.domaine?.capacite_max ?? null
      const pointsParDate = datesOperationnelles.map((date) => {
        const points = tachesExecutant
          .filter((tache) => tache.date_execution === date)
          .reduce((total, tache) => total + tache.points, 0)
        const taux = capaciteMax ? points / capaciteMax : null

        return {
          date,
          points,
          taux,
          surcharge: capaciteMax !== null && points > capaciteMax,
        }
      }).filter((jour) => jour.points > 0)
      const pic = pointsParDate.reduce((max, jour) => Math.max(max, jour.points), 0)
      const taux = capaciteMax ? pic / capaciteMax : null

      return {
        executant,
        points: pic,
        capaciteMax,
        taux,
        surcharge: pointsParDate.some((jour) => jour.surcharge),
        pointsParDate,
      }
    }).filter((charge) => charge.points > 0)
  }, [datesOperationnelles, executants, tachesOperationnelles])
  const chargesBatimentsOperationnelles = useMemo(() => {
    const map = new Map<string, { id: string; nom: string; pointsParDate: Map<string, number>; total: number }>()

    tachesOperationnelles.forEach((tache) => {
      const batiment = tache.lieu?.batiment
      const id = batiment?.id || 'sans-batiment'
      const nom = batiment?.nom || 'Sans batiment'
      const charge = map.get(id) || { id, nom, pointsParDate: new Map<string, number>(), total: 0 }

      charge.pointsParDate.set(tache.date_execution, (charge.pointsParDate.get(tache.date_execution) || 0) + tache.points)
      charge.total += tache.points
      map.set(id, charge)
    })

    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [tachesOperationnelles])
  const propositionsEnAttente = payloadsEnAttente.length > 0 || reaffectationsEnAttente.length > 0
  const payloadsProposition = payloadsEnAttente.length > 0 ? payloadsEnAttente : reaffectationsEnAttente.map((item) => item.payload)
  const reaffectationsSelectionnees = reaffectationsEnAttente.filter((item) => item.payload.id_executant !== item.mouvement.id_executant)
  const peutValiderPropositions = payloadsEnAttente.length > 0 || reaffectationsSelectionnees.length > 0
  const totalPagesPlanning = Math.max(1, Math.ceil(chambresFiltrees.length / lignesParPage))
  const chambresPage = useMemo(() => {
    const debut = (pagePlanning - 1) * lignesParPage
    return chambresFiltrees.slice(debut, debut + lignesParPage)
  }, [chambresFiltrees, lignesParPage, pagePlanning])
  const chambresPageParBatiment = useMemo(() => {
    const map = new Map<string, { id: string; nom: string; chambres: Lieu[] }>()

    chambresPage.forEach((chambre) => {
      const id = chambre.id_batiment || 'sans-batiment'
      const nom = chambre.batiment?.nom || 'Sans batiment'
      const groupe = map.get(id) || { id, nom, chambres: [] }

      groupe.chambres.push(chambre)
      map.set(id, groupe)
    })

    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [chambresPage])

  useEffect(() => {
    setPagePlanning(1)
  }, [batimentFiltre, recherche])

  useEffect(() => {
    if (pagePlanning > totalPagesPlanning) {
      setPagePlanning(totalPagesPlanning)
    }
  }, [pagePlanning, totalPagesPlanning])

  useEffect(() => {
    let actif = true

    async function chargerTachesOperationnelles() {
      try {
        const resultat = await listerTachesChambres(aujourdHui, ajouterJours(aujourdHui, 120))
        if (actif) setTachesOperationnelles(resultat)
      } catch {
        if (actif) setTachesOperationnelles([])
      }
    }

    void chargerTachesOperationnelles()
    return () => {
      actif = false
    }
  }, [aujourdHui])

  function basculerChambre(id: string, coche: boolean) {
    setChambresSelectionnees((selection) => (coche ? Array.from(new Set([...selection, id])) : selection.filter((item) => item !== id)))
  }

  function selectionnerToutes(coche: boolean) {
    setChambresSelectionnees(coche ? chambresFiltrees.map((chambre) => chambre.id) : [])
  }

  function construirePayloadsLot() {
    if (!typeLot || !dateLot) return []

    return chambresSelectionnees
      .map((idChambre) => chambres.find((chambre) => chambre.id === idChambre))
      .filter(Boolean)
      .map((chambre) => mouvementPayload(chambre!, dateLot, typeLot, executantLot || undefined))
  }

  async function appliquerPayloads(payloads: PlanningChambrePayload[]) {
    setSoumission(true)

    try {
      const resultat = await appliquerLot(payloads, remplacer)

      if (resultat.conflits.length > 0) {
        toast.warning(`${resultat.conflits.length} conflit(s). Cochez remplacer pour ecraser les mouvements existants.`)
      } else {
        toast.success(`${resultat.sauvegardes.length} mouvement(s) applique(s).`)
        setSuggestions([])
        setPayloadsEnAttente([])
        setReaffectationsEnAttente([])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Application impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function gererLot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!peutModifier) {
      toast.error("Vous n'avez pas le droit de modifier ce planning.")
      return
    }

    const payloads = construirePayloadsLot()

    if (payloads.length === 0) {
      toast.error('Selectionnez au moins une chambre, une date et un mouvement.')
      return
    }

    try {
      if (!remplacer) {
        const conflits = await verifierConflits(payloads)

        if (conflits.length > 0) {
          toast.warning(`${conflits.length} conflit(s). Cochez remplacer pour ecraser les mouvements existants.`)
          setSuggestions([])
          setPayloadsEnAttente([])
          setReaffectationsEnAttente([])
          return
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification des conflits impossible.')
      return
    }

    await appliquerPayloads(payloads)
  }

  function appliquerSuggestion(payload: PlanningChambrePayload, idExecutant: string) {
    const payloads = payloadsEnAttente.map((item) =>
      item.id_lieu === payload.id_lieu && item.date === payload.date && item.id_type_mouvement === payload.id_type_mouvement
        ? { ...item, id_executant: idExecutant }
        : item,
    )
    const reaffectations = reaffectationsEnAttente.map((item) =>
      item.payload.id_lieu === payload.id_lieu && item.payload.date === payload.date && item.payload.id_type_mouvement === payload.id_type_mouvement
        ? { ...item, payload: { ...item.payload, id_executant: idExecutant } }
        : item,
    )
    setPayloadsEnAttente(payloads)
    setReaffectationsEnAttente(reaffectations)
    setSuggestions((liste) =>
      liste.filter(
        (suggestion) =>
          !(
            suggestion.payload.id_lieu === payload.id_lieu &&
            suggestion.payload.date === payload.date &&
            suggestion.payload.id_type_mouvement === payload.id_type_mouvement
          ),
      ),
    )
    toast.success('Proposition selectionnee. Validez pour enregistrer le mouvement.')
  }

  async function validerPropositions() {
    const reaffectationsSelectionnees = reaffectationsEnAttente.filter((item) => item.payload.id_executant !== item.mouvement.id_executant)

    if (reaffectationsSelectionnees.length > 0) {
      setSoumission(true)

      try {
        await Promise.all(reaffectationsSelectionnees.map((item) => enregistrerMouvement(item.payload, item.mouvement.id)))
        setSuggestions([])
        setPayloadsEnAttente([])
        setReaffectationsEnAttente([])
        toast.success(`${reaffectationsSelectionnees.length} mouvement(s) reaffecte(s).`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Reaffectation impossible.')
      } finally {
        setSoumission(false)
      }
      return
    }

    if (payloadsEnAttente.length === 0) {
      toast.warning('Selectionnez au moins une proposition a valider.')
      return
    }

    await appliquerPayloads(payloadsEnAttente)
  }

  function proposerReaffectation(chargeIdExecutant: string, date: string) {
    const mouvements = planning
      .filter((mouvement) => mouvement.id_executant === chargeIdExecutant)
      .filter((mouvement) => mouvement.date === date)
      .filter((mouvement) => mouvement.etat?.nom === 'AFFECTE')

    if (mouvements.length === 0) {
      toast.info('Aucun mouvement affecte non demarre a reaffecter pour cet executant.')
      return
    }

    const reaffectations = mouvements.map((mouvement) => ({
      mouvement,
      payload: {
        id_lieu: mouvement.id_lieu,
        date: mouvement.date,
        id_type_mouvement: mouvement.id_type_mouvement,
        id_executant: mouvement.id_executant,
        id_etat: mouvement.id_etat,
      },
    }))
    const payloads = reaffectations.map((item) => item.payload)

    setPayloadsEnAttente([])
    setReaffectationsEnAttente(reaffectations)
    setSuggestions(detecterSurcharges(payloads))
    toast.warning('Choisissez un autre executant pour les mouvements en surcharge.')
  }

  function libellePayload(payload: PlanningChambrePayload) {
    const chambre = chambres.find((item) => item.id === payload.id_lieu)
    const type = typesMouvement.find((item) => item.id === payload.id_type_mouvement)

    return {
      chambre: chambre ? `${chambre.nom}${chambre.batiment ? ` (${chambre.batiment.nom})` : ''}` : 'Chambre',
      type: type ? `${type.nom} (${type.points} pts)` : 'Mouvement',
      date: formatDateCourte(payload.date),
    }
  }

  function nomExecutant(idExecutant: string | null) {
    if (!idExecutant) return 'Non affecte'
    return executants.find((executant) => executant.id === idExecutant)?.nom || 'Executant'
  }

  function executantsDisponiblesPourDate(date: string, idCourant?: string | null) {
    const disponibles = executantsEnTravail(date)
    const courant = idCourant ? executants.find((executant) => executant.id === idCourant) : null

    if (courant && !disponibles.some((executant) => executant.id === courant.id)) {
      return [courant, ...disponibles]
    }

    return disponibles
  }

  function pointsPayload(payload: PlanningChambrePayload) {
    return typesMouvement.find((type) => type.id === payload.id_type_mouvement)?.points || 0
  }

  function ouvrirModal(chambre: Lieu, date: string) {
    const mouvements = planningParCellule.get(`${chambre.id}-${date}`) || []
    const premier = mouvements[0] || null

    setModal({ chambre, date, mouvements })
    setMouvementEdition(premier)
    setTypeModal(premier?.id_type_mouvement || typesMouvement[0]?.id || '')
    setExecutantModal(premier?.id_executant || chambre.batiment?.id_executant_defaut || '')
  }

  async function enregistrerModal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!modal || !typeModal) return

    const payload = {
      id_lieu: modal.chambre.id,
      date: modal.date,
      id_type_mouvement: typeModal,
      id_executant: executantModal || null,
      id_etat: mouvementEdition?.id_etat || etatAffecte?.id || etats[0]?.id || '',
    }
    try {
      await enregistrerMouvement(payload, mouvementEdition?.id)
      setModal(null)
      toast.success('Mouvement enregistre.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  return (
    <section className={modeGrandAngle ? 'fixed inset-0 z-[70] overflow-auto bg-slate-50 p-4' : 'space-y-5'}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Planning des chambres</h1>
          <p className="mt-1 text-sm text-slate-500">Mouvements, points et detection de surcharge.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPanneauSaisieOuvert(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800">
            <SlidersHorizontal className="h-4 w-4" />
            Saisie rapide
          </button>
          <button type="button" onClick={() => setModeGrandAngle((actif) => !actif)} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            {modeGrandAngle ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {modeGrandAngle ? 'Quitter grand angle' : 'Grand angle'}
          </button>
          <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4 text-teal-700" />
            A partir du {formatDateCourte(aujourdHui)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <aside className="hidden">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-teal-700" />
              <h2 className="font-semibold text-slate-950">Saisie rapide</h2>
            </div>
            <form onSubmit={gererLot} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
                <input type="date" value={dateLot} onChange={(event) => setDateLot(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Mouvement</span>
                <select value={typeLot} onChange={(event) => setTypeLot(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                  <option value="">Choisir</option>
                  {typesMouvement.map((type) => (
                    <option key={type.id} value={type.id}>{type.nom} ({type.points} pts)</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Executant</span>
                <select value={executantLot} onChange={(event) => setExecutantLot(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                  <option value="">Defaut du batiment si en travail</option>
                  {executantsLotDisponibles.map((executant) => (
                    <option key={executant.id} value={executant.id}>{executant.nom}</option>
                  ))}
                </select>
                {executantsLotDisponibles.length === 0 && <p className="mt-1 text-xs text-amber-700">Aucun executant en travail pour cette date.</p>}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={remplacer} onChange={(event) => setRemplacer(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                Remplacer les mouvements existants
              </label>
              <button type="submit" disabled={!peutModifier || soumission} className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                <Save className="h-4 w-4" />
                Appliquer
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold text-slate-950">Chambres</h2>
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={chambresFiltrees.length > 0 && chambresFiltrees.every((chambre) => chambresSelectionnees.includes(chambre.id))} onChange={(event) => selectionnerToutes(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
              Selectionner les visibles
            </label>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {chambresFiltrees.map((chambre) => (
                <label key={chambre.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <input type="checkbox" checked={chambresSelectionnees.includes(chambre.id)} onChange={(event) => basculerChambre(chambre.id, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                  <span className="min-w-0 truncate">{chambre.nom} {chambre.batiment ? `(${chambre.batiment.nom})` : ''}</span>
                </label>
              ))}
            </div>
          </div>

          {propositionsEnAttente && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <h2 className="font-semibold">Proposition d'affectation</h2>
              </div>
              <p className="mb-3 text-sm text-amber-900">
                Choisissez un autre executant pour chaque mouvement. A la validation, le mouvement sera modifie et les points passeront au nouvel executant.
              </p>
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div key={`${suggestion.payload.id_lieu}-${suggestion.payload.date}-${suggestion.payload.id_type_mouvement}`} className="rounded-md bg-white p-3 text-sm">
                    <p className="font-semibold text-slate-900">
                      {libellePayload(suggestion.payload).type} - {libellePayload(suggestion.payload).chambre}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {libellePayload(suggestion.payload).date} - actuellement affecte a {nomExecutant(suggestion.payload.id_executant)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-amber-800">
                      {suggestion.chargeActuelle?.executant.nom} depasse sa capacite. Proposer ce mouvement a :
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestion.suggestions.length === 0 && (
                        <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                          Aucun executant disponible sous 90 %
                        </span>
                      )}
                      {suggestion.suggestions.map((charge) => (
                        <button key={charge.executant.id} type="button" onClick={() => appliquerSuggestion(suggestion.payload, charge.executant.id)} className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100">
                          {charge.executant.nom} ({charge.points}/{charge.capaciteMax || '∞'})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {suggestions.length === 0 && (
                <div className="mt-3 space-y-2">
                  {payloadsProposition.map((payload) => {
                    const libelle = libellePayload(payload)

                    return (
                      <div key={`${payload.id_lieu}-${payload.date}-${payload.id_type_mouvement}`} className="rounded-md bg-white p-3 text-sm">
                        <p className="font-semibold text-slate-900">{libelle.type} - {libelle.chambre}</p>
                        <p className="text-xs text-slate-500">{libelle.date} - pret a enregistrer avec {nomExecutant(payload.id_executant)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void validerPropositions()} disabled={soumission || !peutValiderPropositions} className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Valider les affectations</button>
                <button type="button" onClick={() => { setSuggestions([]); setPayloadsEnAttente([]); setReaffectationsEnAttente([]) }} className="rounded-md border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800">Refuser</button>
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0 space-y-4">
          <ChargeExecutants charges={charges} peutModifier={peutModifier} onProposerReaffectation={proposerReaffectation} />
          <ChargeExecutantsOperationnelles charges={chargesExecutantsOperationnelles} />
          <ChargeBatiments title="Charge hoteliere des batiments" subtitle="Selon la date du mouvement" charges={chargesBatiments} dates={datesVisibles} />
          <ChargeBatiments title="Charge operationnelle des batiments" subtitle="Selon la date execution des taches" charges={chargesBatimentsOperationnelles} dates={datesOperationnelles} />

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[220px_180px_1fr]">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Chambre..." className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
                </label>
                <select value={batimentFiltre} onChange={(event) => setBatimentFiltre(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                  <option value="tous">Tous batiments</option>
                  {batiments.map((batiment) => <option key={batiment.id} value={batiment.id}>{batiment.nom}</option>)}
                </select>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <CalendarDays className="h-4 w-4" />
                  Toutes les dates a venir avec planning
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-10 w-56 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-600">Chambre</th>
                    {datesVisibles.map((date, index) => (
                      <th key={date} className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-600">
                        {joursLabels[new Date(`${date}T00:00:00`).getDay()]} <span className="block text-xs font-normal text-slate-500">{formatDateCourte(date)}</span>
                        <span className="mt-1 block text-xs text-teal-700">Hotelier: {mouvementsParJour[index].reduce((total, mouvement) => total + (mouvement.type_mouvement?.points || 0), 0)} pts</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chargement && <tr><td colSpan={datesVisibles.length + 1} className="px-4 py-8 text-center text-slate-500">Chargement...</td></tr>}
                  {!chargement && datesVisibles.length === 0 && (
                    <tr>
                      <td colSpan={1} className="px-4 py-8 text-center text-slate-500">Aucun planning a venir.</td>
                    </tr>
                  )}
                  {!chargement && datesVisibles.length > 0 && chambresPageParBatiment.map((groupe) => (
                    <Fragment key={groupe.id}>
                      <tr className="border-b border-slate-200 bg-slate-100">
                        <td colSpan={datesVisibles.length + 1} className="sticky left-0 px-3 py-2 text-xs font-bold uppercase text-slate-600">
                          {groupe.nom} - {groupe.chambres.length} chambre(s)
                        </td>
                      </tr>
                      {groupe.chambres.map((chambre) => (
                        <tr key={chambre.id} className="border-b border-slate-100">
                          <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-3 text-left align-top">
                            <span className="block font-semibold text-slate-900">{chambre.nom}</span>
                            <span className="text-xs font-normal text-slate-500">{chambre.batiment?.nom}</span>
                          </th>
                          {datesVisibles.map((date) => {
                            const mouvements = planningParCellule.get(`${chambre.id}-${date}`) || []
                            return (
                              <td key={date} className="min-w-36 border-r border-slate-100 p-2 align-top">
                                <button type="button" onClick={() => ouvrirModal(chambre, date)} className="min-h-20 w-full rounded-md border border-transparent p-2 text-left hover:border-teal-200 hover:bg-teal-50">
                                  {mouvements.length === 0 ? <span className="text-slate-300">-</span> : <CellMouvements mouvements={mouvements} />}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  {!chargement && chambresFiltrees.length === 0 && (
                    <tr>
                      <td colSpan={datesVisibles.length + 1} className="px-4 py-8 text-center text-slate-500">Aucune chambre trouvee.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationPlanning
              page={pagePlanning}
              totalPages={totalPagesPlanning}
              totalItems={chambresFiltrees.length}
              lignesParPage={lignesParPage}
              onPageChange={setPagePlanning}
              onLignesParPageChange={(value) => {
                setLignesParPage(value)
                setPagePlanning(1)
              }}
            />
          </div>

          <div className="hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold text-slate-950">Charge des executants</h2>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {charges.map((charge) => (
                <div key={charge.executant.id} className={charge.surcharge ? 'rounded-md border border-rose-200 bg-rose-50 p-3' : 'rounded-md border border-slate-200 p-3'}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{charge.executant.nom}</p>
                    <span className="text-sm font-semibold text-slate-600">{charge.points}/{charge.capaciteMax || '∞'} pts</span>
                  </div>
                  {charge.taux !== null && <div className="mt-2 h-2 rounded-full bg-slate-100"><div className={charge.surcharge ? 'h-2 rounded-full bg-rose-600' : 'h-2 rounded-full bg-teal-600'} style={{ width: `${Math.min(charge.taux * 100, 100)}%` }} /></div>}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {panneauSaisieOuvert && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/35">
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Saisie rapide</h2>
                <p className="text-sm text-slate-500">{chambresSelectionnees.length} chambre(s) selectionnee(s)</p>
              </div>
              <button type="button" onClick={() => setPanneauSaisieOuvert(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={gererLot} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
                <input type="date" value={dateLot} onChange={(event) => setDateLot(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Mouvement</span>
                <select value={typeLot} onChange={(event) => setTypeLot(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                  <option value="">Choisir</option>
                  {typesMouvement.map((type) => <option key={type.id} value={type.id}>{type.nom} ({type.points} pts)</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Executant</span>
                <select value={executantLot} onChange={(event) => setExecutantLot(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                  <option value="">Defaut du batiment si en travail</option>
                  {executantsLotDisponibles.map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
                </select>
                {executantsLotDisponibles.length === 0 && <p className="mt-1 text-xs text-amber-700">Aucun executant en travail pour cette date.</p>}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={remplacer} onChange={(event) => setRemplacer(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                Remplacer les mouvements existants
              </label>

              <div className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 p-3">
                  <span className="text-sm font-semibold text-slate-900">Chambres visibles</span>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input type="checkbox" checked={chambresFiltrees.length > 0 && chambresFiltrees.every((chambre) => chambresSelectionnees.includes(chambre.id))} onChange={(event) => selectionnerToutes(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                    Tout
                  </label>
                </div>
                <div className="max-h-80 space-y-1 overflow-y-auto p-2">
                  {chambresFiltrees.map((chambre) => (
                    <label key={chambre.id} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={chambresSelectionnees.includes(chambre.id)} onChange={(event) => basculerChambre(chambre.id, event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600" />
                      <span className="min-w-0 truncate">{chambre.nom} {chambre.batiment ? `(${chambre.batiment.nom})` : ''}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={!peutModifier || soumission} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
                <Save className="h-4 w-4" />
                Appliquer
              </button>
            </form>
          </aside>
        </div>
      )}

      {propositionsEnAttente && (
        <div className="fixed inset-y-0 right-0 z-[65] flex w-full max-w-lg flex-col border-l border-amber-200 bg-amber-50 shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-amber-200 p-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-amber-950">
                <AlertTriangle className="h-4 w-4" />
                Reequilibrage des affectations
              </h2>
              <p className="mt-1 text-sm text-amber-900">Choisissez un autre executant. Une seule selection suffit pour valider.</p>
            </div>
            <button type="button" onClick={() => { setSuggestions([]); setPayloadsEnAttente([]); setReaffectationsEnAttente([]) }} className="rounded-md p-2 text-amber-800 hover:bg-amber-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {suggestions.map((suggestion) => {
              const libelle = libellePayload(suggestion.payload)

              return (
                <div key={`${suggestion.payload.id_lieu}-${suggestion.payload.date}-${suggestion.payload.id_type_mouvement}`} className="rounded-lg bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{libelle.chambre}</p>
                      <p className="text-sm text-slate-600">{libelle.type} - {libelle.date}</p>
                    </div>
                    <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Actuel : {nomExecutant(suggestion.payload.id_executant)}</span>
                  </div>
                  {suggestion.chargeActuelle && (
                    <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {suggestion.chargeActuelle.executant.nom} est en surcharge.
                    </p>
                  )}
                  <div className="mt-3 grid gap-2">
                    {suggestion.suggestions.length === 0 && <span className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">Aucun executant disponible.</span>}
                    {suggestion.suggestions.map((charge) => (
                      <button key={charge.executant.id} type="button" onClick={() => appliquerSuggestion(suggestion.payload, charge.executant.id)} className="flex items-center justify-between gap-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-left text-sm font-semibold text-teal-800 hover:bg-teal-100">
                        <span>{charge.executant.nom}</span>
                        <span>{charge.points + pointsPayload(suggestion.payload)}/{charge.capaciteMax || 'infini'} pts apres</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {suggestions.length === 0 && payloadsProposition.map((payload) => {
              const libelle = libellePayload(payload)
              return (
                <div key={`${payload.id_lieu}-${payload.date}-${payload.id_type_mouvement}`} className="rounded-lg bg-white p-4 shadow-sm">
                  <p className="font-semibold text-slate-950">{libelle.chambre}</p>
                  <p className="text-sm text-slate-600">{libelle.type} - {libelle.date}</p>
                  <p className="mt-2 text-xs font-semibold text-teal-700">Pret avec {nomExecutant(payload.id_executant)}</p>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 border-t border-amber-200 p-4">
            <button type="button" onClick={() => void validerPropositions()} disabled={soumission || !peutValiderPropositions} className="flex-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Valider les affectations</button>
            <button type="button" onClick={() => { setSuggestions([]); setPayloadsEnAttente([]); setReaffectationsEnAttente([]) }} className="rounded-md border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800">Refuser</button>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={enregistrerModal} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">{modal.chambre.nom}</h2>
            <p className="mt-1 text-sm text-slate-500">{formatDateLongue(modal.date)}</p>
            {modal.mouvements.length > 0 && (
              <div className="mt-4 space-y-2">
                {modal.mouvements.map((mouvement) => (
                  <button key={mouvement.id} type="button" onClick={() => { setMouvementEdition(mouvement); setTypeModal(mouvement.id_type_mouvement); setExecutantModal(mouvement.id_executant || '') }} className={mouvementEdition?.id === mouvement.id ? 'w-full rounded-md border border-teal-300 bg-teal-50 p-2 text-left text-sm' : 'w-full rounded-md border border-slate-200 p-2 text-left text-sm'}>
                    {mouvement.type_mouvement?.nom} - {mouvement.executant?.nom || 'Non affecte'}
                  </button>
                ))}
              </div>
            )}
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Mouvement</span>
              <select value={typeModal} onChange={(event) => setTypeModal(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                {typesMouvement.map((type) => <option key={type.id} value={type.id}>{type.nom} ({type.points} pts)</option>)}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Executant</span>
              <select value={executantModal} onChange={(event) => setExecutantModal(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100">
                <option value="">Non affecte</option>
                {executantsDisponiblesPourDate(modal.date, mouvementEdition?.id_executant).map((executant) => <option key={executant.id} value={executant.id}>{executant.nom}</option>)}
              </select>
              {executantsEnTravail(modal.date).length === 0 && <p className="mt-1 text-xs text-amber-700">Aucun executant en travail pour cette date.</p>}
            </label>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {mouvementEdition && <button type="button" onClick={() => void supprimerMouvement(mouvementEdition.id).then(() => setModal(null))} className="rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700"><Trash2 className="mr-2 inline h-4 w-4" />Supprimer</button>}
              <button type="button" onClick={() => setModal(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Annuler</button>
              <button type="submit" disabled={!peutModifier} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

function CellMouvements({ mouvements }: { mouvements: PlanningChambre[] }) {
  return (
    <div className="space-y-1">
      {mouvements.map((mouvement) => (
        <div key={mouvement.id} className={`rounded-md px-2 py-1 ring-1 ${couleurMouvement(mouvement.type_mouvement?.nom)}`}>
          <p className="text-xs font-semibold">{mouvement.type_mouvement?.nom} ({mouvement.type_mouvement?.points} pts)</p>
          <p className="truncate text-xs text-slate-500">{mouvement.executant?.nom || 'Non affecte'}</p>
        </div>
      ))}
    </div>
  )
}

function couleurMouvement(type?: string) {
  const nom = type?.toUpperCase() || ''

  if (nom.includes('DEPART')) return 'bg-rose-50 text-rose-800 ring-rose-100'
  if (nom.includes('RECOUCHE')) return 'bg-sky-50 text-sky-800 ring-sky-100'
  if (nom.includes('ARRIVEE')) return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (nom.includes('MENAGE')) return 'bg-teal-50 text-teal-800 ring-teal-100'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

function ChargeExecutants({
  charges,
  peutModifier,
  onProposerReaffectation,
}: {
  charges: ChargeExecutant[]
  peutModifier: boolean
  onProposerReaffectation: (idExecutant: string, date: string) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Charge hoteliere des executants</h2>
          <p className="text-xs text-slate-500">Selon la date du mouvement</p>
        </div>
        <span className="text-xs font-semibold uppercase text-slate-500">
          {charges.filter((charge) => charge.surcharge).length} surcharge(s)
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {charges.map((charge) => {
          const capacite = charge.capaciteMax === null ? 'infini' : charge.capaciteMax
          const taux = charge.taux === null ? null : Math.min(charge.taux * 100, 100)

          return (
            <div key={charge.executant.id} className={charge.surcharge ? 'rounded-md border border-rose-200 bg-rose-50 p-3' : 'rounded-md border border-slate-200 p-3'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{charge.executant.nom}</p>
                  <p className="text-xs text-slate-500">{charge.executant.domaine?.nom}</p>
                </div>
                <span className={charge.surcharge ? 'shrink-0 text-sm font-semibold text-rose-700' : 'shrink-0 text-sm font-semibold text-slate-600'}>
                  {charge.points}/{capacite} pts
                </span>
              </div>
              {taux !== null && (
                <div className="mt-3 h-2 rounded-full bg-white">
                  <div className={charge.surcharge ? 'h-2 rounded-full bg-rose-600' : 'h-2 rounded-full bg-teal-600'} style={{ width: `${taux}%` }} />
                </div>
              )}
              {charge.pointsParDate.length > 0 && (
                <div className="mt-3 space-y-1">
                  {charge.pointsParDate.map((jour) => (
                    <div key={jour.date} className={jour.surcharge ? 'rounded-md bg-white px-2 py-1 text-xs text-rose-700' : 'rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600'}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{formatDateCourte(jour.date)}</span>
                        <span className="font-semibold">{jour.points}/{capacite} pts</span>
                      </div>
                      {jour.surcharge && (
                        <button
                          type="button"
                          onClick={() => onProposerReaffectation(charge.executant.id, jour.date)}
                          disabled={!peutModifier}
                          className="mt-2 w-full rounded-md bg-rose-700 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
                        >
                          Proposer une reaffectation
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChargeExecutantsOperationnelles({
  charges,
}: {
  charges: Array<{
    executant: ChargeExecutant['executant']
    points: number
    capaciteMax: number | null
    taux: number | null
    surcharge: boolean
    pointsParDate: Array<{ date: string; points: number; taux: number | null; surcharge: boolean }>
  }>
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Charge operationnelle des executants</h2>
          <p className="text-xs text-slate-500">Selon la date execution des taches</p>
        </div>
        <span className="text-xs font-semibold uppercase text-slate-500">
          {charges.filter((charge) => charge.surcharge).length} surcharge(s)
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {charges.length === 0 && <p className="text-sm text-slate-500">Aucune tache operationnelle planifiee.</p>}
        {charges.map((charge) => {
          const capacite = charge.capaciteMax === null ? 'infini' : charge.capaciteMax
          const taux = charge.taux === null ? null : Math.min(charge.taux * 100, 100)

          return (
            <div key={charge.executant.id} className={charge.surcharge ? 'rounded-md border border-rose-200 bg-rose-50 p-3' : 'rounded-md border border-slate-200 p-3'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{charge.executant.nom}</p>
                  <p className="text-xs text-slate-500">{charge.executant.domaine?.nom}</p>
                </div>
                <span className={charge.surcharge ? 'shrink-0 text-sm font-semibold text-rose-700' : 'shrink-0 text-sm font-semibold text-slate-600'}>
                  {charge.points}/{capacite} pts
                </span>
              </div>
              {taux !== null && (
                <div className="mt-3 h-2 rounded-full bg-white">
                  <div className={charge.surcharge ? 'h-2 rounded-full bg-rose-600' : 'h-2 rounded-full bg-teal-600'} style={{ width: `${taux}%` }} />
                </div>
              )}
              {charge.pointsParDate.length > 0 && (
                <div className="mt-3 space-y-1">
                  {charge.pointsParDate.map((jour) => (
                    <div key={jour.date} className={jour.surcharge ? 'rounded-md bg-white px-2 py-1 text-xs text-rose-700' : 'rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600'}>
                      <div className="flex items-center justify-between gap-2">
                        <span>{formatDateCourte(jour.date)}</span>
                        <span className="font-semibold">{jour.points}/{capacite} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChargeBatiments({
  title,
  subtitle,
  charges,
  dates,
}: {
  title: string
  subtitle: string
  charges: Array<{ id: string; nom: string; pointsParDate: Map<string, number>; total: number }>
  dates: string[]
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-950">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-48 border-b border-r border-slate-200 px-3 py-3 text-left font-semibold text-slate-600">Batiment</th>
              {dates.map((date) => (
                <th key={date} className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-600">
                  {joursLabels[new Date(`${date}T00:00:00`).getDay()]}
                  <span className="block text-xs font-normal text-slate-500">{formatDateCourte(date)}</span>
                </th>
              ))}
              <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {dates.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">Aucun planning a venir.</td>
              </tr>
            )}
            {dates.length > 0 && charges.map((charge) => (
              <tr key={charge.id} className="border-b border-slate-100">
                <th className="border-r border-slate-200 px-3 py-3 text-left font-semibold text-slate-900">{charge.nom}</th>
                {dates.map((date) => (
                  <td key={date} className="px-3 py-3 text-slate-600">
                    {charge.pointsParDate.get(date) || 0} pts
                  </td>
                ))}
                <td className="px-3 py-3 font-semibold text-teal-700">{charge.total} pts</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaginationPlanning({
  page,
  totalPages,
  totalItems,
  lignesParPage,
  onPageChange,
  onLignesParPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  lignesParPage: number
  onPageChange: (page: number) => void
  onLignesParPageChange: (value: number) => void
}) {
  const debut = totalItems === 0 ? 0 : (page - 1) * lignesParPage + 1
  const fin = Math.min(page * lignesParPage, totalItems)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {debut}-{fin} sur {totalItems} chambre{totalItems > 1 ? 's' : ''}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lignesParPage}
          onChange={(event) => onLignesParPageChange(Number(event.target.value))}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          <option value={10}>10 / page</option>
          <option value={15}>15 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
        </select>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page <= 1}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Page precedente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-16 text-center font-semibold text-slate-700">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(page + 1, totalPages))}
          disabled={page >= totalPages}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function ajouterJours(date: string, jours: number) {
  const valeur = new Date(`${date}T00:00:00`)
  valeur.setDate(valeur.getDate() + jours)
  return formatDateInput(valeur)
}

function formatDateCourte(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(new Date(`${date}T00:00:00`))
}

function formatDateLongue(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}
