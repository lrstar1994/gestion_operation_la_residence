import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Save, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { listerDomainesExecutants, listerExecutants, type DomaineExecutant, type Executant } from '../api/executants'
import {
  appliquerPlanningLot,
  creerPlanning,
  listerPlanning,
  listerTypesPlanning,
  remplacerPlanning,
  trouverPlanningExistant,
  type PlanningExecutant,
  type PlanningPayload,
  type TypePlanning,
} from '../api/planning'
import { useAuth } from '../hooks/useAuth'

type DomaineFiltre = string

type FormulairePlanning = {
  idTypePlanning: string
  heureDebut: string
  heureFin: string
}

type ModalCellule = {
  executant: Executant
  date: string
  planning: PlanningExecutant | null
}

const joursLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const couleursFallback = ['#16a34a', '#2563eb', '#9333ea', '#dc2626', '#0891b2', '#ea580c', '#4f46e5']

const formulaireInitial: FormulairePlanning = {
  idTypePlanning: '',
  heureDebut: '09:00',
  heureFin: '17:00',
}

export function PlanningHebdomadaire() {
  const [domaines, setDomaines] = useState<DomaineExecutant[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [typesPlanning, setTypesPlanning] = useState<TypePlanning[]>([])
  const [plannings, setPlannings] = useState<PlanningExecutant[]>([])
  const [dateReference, setDateReference] = useState(() => formatDateInput(semainePlanningParDefaut(new Date())))
  const [chargement, setChargement] = useState(true)
  const [soumissionLot, setSoumissionLot] = useState(false)
  const [modal, setModal] = useState<ModalCellule | null>(null)
  const [formulaireModal, setFormulaireModal] = useState<FormulairePlanning>(formulaireInitial)
  const [executantsSelectionnes, setExecutantsSelectionnes] = useState<string[]>([])
  const [dateDebutLot, setDateDebutLot] = useState(dateReference)
  const [dateFinLot, setDateFinLot] = useState(formatDateInput(finSemaine(new Date(dateReference))))
  const [formulaireLot, setFormulaireLot] = useState<FormulairePlanning>(formulaireInitial)
  const [remplacerExistants, setRemplacerExistants] = useState(false)
  const [filtreDomaine, setFiltreDomaine] = useState<DomaineFiltre>('tous')
  const [recherche, setRecherche] = useState('')
  const [filtreType, setFiltreType] = useState('tous')
  const [panneauSaisieOuvert, setPanneauSaisieOuvert] = useState(false)
  const { estAdmin, profil } = useAuth()

  const semaine = useMemo(() => {
    const debut = debutSemaine(new Date(`${dateReference}T00:00:00`))
    return Array.from({ length: 7 }, (_, index) => ajouterJours(debut, index))
  }, [dateReference])

  const dateDebutSemaine = formatDateInput(semaine[0])
  const dateFinSemaine = formatDateInput(semaine[6])

  const planningParCellule = useMemo(() => {
    const map = new Map<string, PlanningExecutant>()
    plannings.forEach((planning) => {
      map.set(clePlanning(planning.id_executant, planning.date), planning)
    })
    return map
  }, [plannings])

  const domainesVisibles = useMemo(() => {
    return domaines
  }, [domaines])

  const executantsSelectionnables = useMemo(() => {
    const domaineIdsVisibles = new Set(domainesVisibles.map((domaine) => domaine.id))
    const rechercheNormalisee = recherche.trim().toLowerCase()

    return executants.filter((executant) => {
      const domaine = domaines.find((item) => item.id === executant.id_domaine)

      if (!domaineIdsVisibles.has(executant.id_domaine)) {
        return false
      }

      if (filtreDomaine !== 'tous' && executant.id_domaine !== filtreDomaine) {
        return false
      }

      if (rechercheNormalisee && !executant.nom.toLowerCase().includes(rechercheNormalisee)) {
        return false
      }

      return true
    })
  }, [domaines, domainesVisibles, executants, filtreDomaine, recherche])

  const executantsVisibles = useMemo(() => {
    return executantsSelectionnables.filter((executant) => {
      const planningSemaine = semaine
        .map((jour) => planningParCellule.get(clePlanning(executant.id, formatDateInput(jour))))
        .filter(Boolean) as PlanningExecutant[]

      if (planningSemaine.length === 0) {
        return false
      }

      if (filtreType !== 'tous' && !planningSemaine.some((planning) => planning.id_type_planning === filtreType)) {
        return false
      }

      return true
    })
  }, [executantsSelectionnables, filtreType, planningParCellule, semaine])

  const typeSelectionneLot = typesPlanning.find((type) => type.id === formulaireLot.idTypePlanning)
  const typeSelectionneModal = typesPlanning.find((type) => type.id === formulaireModal.idTypePlanning)
  const lectureSeule = !estAdmin()

  async function chargerDonnees() {
    setChargement(true)

    try {
      const [domainesResultat, executantsResultat, typesResultat, planningResultat] = await Promise.all([
        listerDomainesExecutants(),
        listerExecutants(),
        listerTypesPlanning(),
        listerPlanning(dateDebutSemaine, dateFinSemaine),
      ])

      setDomaines(domainesResultat)
      setExecutants(executantsResultat)
      setTypesPlanning(typesResultat)
      setPlannings(planningResultat)

      const typeTravail = typesResultat.find((type) => estTypeTravail(type))
      const premierType = typeTravail?.id || typesResultat[0]?.id || ''
      setFormulaireLot((etat) => ({ ...etat, idTypePlanning: etat.idTypePlanning || premierType }))
      setFormulaireModal((etat) => ({ ...etat, idTypePlanning: etat.idTypePlanning || premierType }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Planning impossible a charger.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    void chargerDonnees()
  }, [dateDebutSemaine, dateFinSemaine])

  useEffect(() => {
    setDateDebutLot(dateDebutSemaine)
    setDateFinLot(dateFinSemaine)
  }, [dateDebutSemaine, dateFinSemaine])

  function changerSemaine(delta: number) {
    setDateReference(formatDateInput(ajouterJours(new Date(`${dateReference}T00:00:00`), delta * 7)))
  }

  function basculerSelection(idExecutant: string, coche: boolean) {
    setExecutantsSelectionnes((selection) =>
      coche ? Array.from(new Set([...selection, idExecutant])) : selection.filter((id) => id !== idExecutant),
    )
  }

  function selectionnerTousVisibles(coche: boolean) {
    setExecutantsSelectionnes(coche ? executantsSelectionnables.map((executant) => executant.id) : [])
  }

  async function gererLot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (lectureSeule) {
      toast.error('Seul un admin peut modifier le planning.')
      return
    }

    setSoumissionLot(true)

    try {
      const payloads = construirePayloadsLot()

      if (payloads.length === 0) {
        toast.error('Selectionnez au moins un executant et une plage de dates valide.')
        return
      }

      const resultat = await appliquerPlanningLot(payloads, remplacerExistants)
      fusionnerPlannings(resultat.sauvegardes)

      if (resultat.conflits.length > 0) {
        toast.warning(
          `${resultat.conflits.length} conflit(s) detecte(s). Cochez "Remplacer" pour ecraser les plannings existants.`,
        )
      } else {
        toast.success(`${resultat.sauvegardes.length} planning(s) applique(s).`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Application du planning impossible.')
    } finally {
      setSoumissionLot(false)
    }
  }

  function construirePayloadsLot() {
    if (!formulaireLot.idTypePlanning || !dateDebutLot || !dateFinLot || dateFinLot < dateDebutLot) {
      return []
    }

    const type = typesPlanning.find((item) => item.id === formulaireLot.idTypePlanning)
    const dates = datesEntre(dateDebutLot, dateFinLot)

    return executantsSelectionnes.flatMap((idExecutant) =>
      dates.map((date) =>
        normaliserPayload({
          id_executant: idExecutant,
          id_type_planning: formulaireLot.idTypePlanning,
          date,
          heure_debut: estTypeTravail(type) ? formulaireLot.heureDebut : null,
          heure_fin: estTypeTravail(type) ? formulaireLot.heureFin : null,
        }),
      ),
    )
  }

  function ouvrirModal(executant: Executant, date: string) {
    const planning = planningParCellule.get(clePlanning(executant.id, date)) || null

    setModal({ executant, date, planning })
    setFormulaireModal({
      idTypePlanning: planning?.id_type_planning || typesPlanning.find((type) => estTypeTravail(type))?.id || typesPlanning[0]?.id || '',
      heureDebut: formatHeure(planning?.heure_debut) || '09:00',
      heureFin: formatHeure(planning?.heure_fin) || '17:00',
    })
  }

  async function enregistrerCellule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!modal) {
      return
    }

    if (lectureSeule) {
      toast.error('Seul un admin peut modifier le planning.')
      return
    }

    const payload = construirePayloadCellule(modal)

    try {
      const existant = await trouverPlanningExistant(payload.id_executant, payload.date)

      if (existant && !modal.planning) {
        const remplacer = window.confirm('Un planning existe deja pour cet executant et cette date. Le remplacer ?')

        if (!remplacer) {
          return
        }
      }

      const sauvegarde = existant ? await remplacerPlanning(payload) : await creerPlanning(payload)
      fusionnerPlannings([sauvegarde])
      setModal(null)
      toast.success('Planning enregistre.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  function construirePayloadCellule(cellule: ModalCellule): PlanningPayload {
    const type = typesPlanning.find((item) => item.id === formulaireModal.idTypePlanning)

    return normaliserPayload({
      id_executant: cellule.executant.id,
      id_type_planning: formulaireModal.idTypePlanning,
      date: cellule.date,
      heure_debut: estTypeTravail(type) ? formulaireModal.heureDebut : null,
      heure_fin: estTypeTravail(type) ? formulaireModal.heureFin : null,
    })
  }

  function fusionnerPlannings(nouveaux: PlanningExecutant[]) {
    setPlannings((liste) => {
      const map = new Map(liste.map((planning) => [clePlanning(planning.id_executant, planning.date), planning]))
      nouveaux.forEach((planning) => {
        map.set(clePlanning(planning.id_executant, planning.date), planning)
      })
      return Array.from(map.values())
    })
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Planning hebdomadaire</h1>
          <p className="mt-1 text-sm text-slate-500">Saisie rapide et consultation par executant.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!lectureSeule && (
            <button
              type="button"
              onClick={() => setPanneauSaisieOuvert(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Saisie rapide
            </button>
          )}
          <button
            type="button"
            onClick={() => changerSemaine(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            aria-label="Semaine precedente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={dateReference}
            onChange={(event) => setDateReference(formatDateInput(debutSemaine(new Date(`${event.target.value}T00:00:00`))))}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
          <button
            type="button"
            onClick={() => changerSemaine(1)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            aria-label="Semaine suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {!lectureSeule && (
        <aside className="hidden">
          {!lectureSeule && (
            <form onSubmit={gererLot} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-700" />
                <h2 className="font-semibold text-slate-950">Saisie rapide</h2>
              </div>

              <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={executantsSelectionnables.length > 0 && executantsSelectionnables.every((executant) => executantsSelectionnes.includes(executant.id))}
                  onChange={(event) => selectionnerTousVisibles(event.target.checked)}
                  disabled={executantsSelectionnables.length === 0}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600 disabled:opacity-50"
                />
                Selectionner les visibles
              </label>

              <div className="mb-4 max-h-36 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
                {executantsSelectionnables.map((executant) => (
                  <label key={executant.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={executantsSelectionnes.includes(executant.id)}
                      onChange={(event) => basculerSelection(executant.id, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <span className="truncate">{executant.nom}</span>
                  </label>
                ))}
                {executantsSelectionnables.length === 0 && <p className="px-1 py-2 text-sm text-slate-500">Aucun executant.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ChampDate label="Debut" value={dateDebutLot} onChange={setDateDebutLot} disabled={false} />
                <ChampDate label="Fin" value={dateFinLot} onChange={setDateFinLot} disabled={false} />
              </div>

              <PlanningFields
                className="mt-3"
                types={typesPlanning}
                formulaire={formulaireLot}
                setFormulaire={setFormulaireLot}
                typeSelectionne={typeSelectionneLot}
                disabled={false}
              />

              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={remplacerExistants}
                  onChange={(event) => setRemplacerExistants(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Remplacer les plannings existants
              </label>

              <button
                type="submit"
                disabled={soumissionLot}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {soumissionLot ? 'Application...' : 'Appliquer'}
              </button>
            </form>
          )}
        </aside>
        )}

        <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-teal-700" />
                <h2 className="font-semibold text-slate-950">
                  Du {formatDateCourte(dateDebutSemaine)} au {formatDateCourte(dateFinSemaine)}
                </h2>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[160px_220px_180px]">
                <label className="block">
                  <span className="sr-only">Domaine</span>
                  <select
                    value={filtreDomaine}
                    onChange={(event) => setFiltreDomaine(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="tous">Tous les domaines</option>
                    {domainesVisibles.map((domaine) => <option key={domaine.id} value={domaine.id}>{domaine.nom}</option>)}
                  </select>
                </label>

                <label className="relative block">
                  <span className="sr-only">Executant</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={recherche}
                    onChange={(event) => setRecherche(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    placeholder="Rechercher..."
                  />
                </label>

                <label className="block">
                  <span className="sr-only">Type</span>
                  <select
                    value={filtreType}
                    onChange={(event) => setFiltreType(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="tous">Tous les types</option>
                    {typesPlanning.map((type) => (
                      <option key={type.id} value={type.id}>
                        {capitaliser(type.nom)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Affichage limite aux plannings enregistres dans la base pour cette semaine.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-10 w-56 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-left font-semibold text-slate-600">
                    Executants
                  </th>
                  {semaine.map((jour, index) => (
                    <th key={formatDateInput(jour)} className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-600">
                      <span className="block">{joursLabels[index]}</span>
                      <span className="text-xs font-normal text-slate-500">{formatDateCourte(formatDateInput(jour))}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chargement && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Chargement...
                    </td>
                  </tr>
                )}

                {!chargement &&
                  executantsVisibles.map((executant) => (
                    <tr key={executant.id} className="border-b border-slate-100">
                      <th className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-3 text-left align-top">
                        <span className="block font-semibold text-slate-900">{executant.nom}</span>
                        <span className="block truncate text-xs font-normal text-slate-500">
                          {domaines.find((domaine) => domaine.id === executant.id_domaine)?.nom}
                        </span>
                      </th>
                      {semaine.map((jour) => {
                        const date = formatDateInput(jour)
                        const planning = planningParCellule.get(clePlanning(executant.id, date)) || null

                        return (
                          <td key={date} className="min-w-32 border-r border-slate-100 p-2 align-top">
                            <button
                              type="button"
                              onClick={() => ouvrirModal(executant, date)}
                              className="min-h-16 w-full rounded-md border border-transparent p-2 text-left transition hover:border-teal-200 hover:bg-teal-50"
                            >
                              <CellulePlanning planning={planning} />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}

                {!chargement && executantsVisibles.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Aucun executant pour ces filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {panneauSaisieOuvert && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/35">
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Saisie rapide</h2>
                <p className="text-sm text-slate-500">{executantsSelectionnes.length} executant(s) selectionne(s)</p>
              </div>
              <button type="button" onClick={() => setPanneauSaisieOuvert(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={gererLot} className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={executantsSelectionnables.length > 0 && executantsSelectionnables.every((executant) => executantsSelectionnes.includes(executant.id))}
                  onChange={(event) => selectionnerTousVisibles(event.target.checked)}
                  disabled={executantsSelectionnables.length === 0}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600 disabled:opacity-50"
                />
                Selectionner les visibles
              </label>

              <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {executantsSelectionnables.map((executant) => (
                  <label key={executant.id} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={executantsSelectionnes.includes(executant.id)}
                      onChange={(event) => basculerSelection(executant.id, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <span className="truncate">{executant.nom}</span>
                  </label>
                ))}
                {executantsSelectionnables.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">Aucun executant.</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ChampDate label="Debut" value={dateDebutLot} onChange={setDateDebutLot} disabled={false} />
                <ChampDate label="Fin" value={dateFinLot} onChange={setDateFinLot} disabled={false} />
              </div>

              <PlanningFields
                types={typesPlanning}
                formulaire={formulaireLot}
                setFormulaire={setFormulaireLot}
                typeSelectionne={typeSelectionneLot}
                disabled={false}
              />

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={remplacerExistants}
                  onChange={(event) => setRemplacerExistants(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Remplacer les plannings existants
              </label>

              <button
                type="submit"
                disabled={soumissionLot}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {soumissionLot ? 'Application...' : 'Appliquer'}
              </button>
            </form>
          </aside>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={enregistrerCellule} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-950">Modifier le planning</h2>
              <p className="mt-1 text-sm text-slate-500">
                {modal.executant.nom} - {formatDateLongue(modal.date)}
              </p>
            </div>

            {modal.planning && (
              <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Un planning existe deja. L'enregistrement remplacera cette valeur.
              </div>
            )}

            <PlanningFields
              types={typesPlanning}
              formulaire={formulaireModal}
              setFormulaire={setFormulaireModal}
              typeSelectionne={typeSelectionneModal}
              disabled={lectureSeule}
            />

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={lectureSeule}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

function PlanningFields({
  types,
  formulaire,
  setFormulaire,
  typeSelectionne,
  disabled,
  className = '',
}: {
  types: TypePlanning[]
  formulaire: FormulairePlanning
  setFormulaire: React.Dispatch<React.SetStateAction<FormulairePlanning>>
  typeSelectionne?: TypePlanning
  disabled: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Type</span>
        <select
          value={formulaire.idTypePlanning}
          onChange={(event) => setFormulaire((etat) => ({ ...etat, idTypePlanning: event.target.value }))}
          disabled={disabled || types.length === 0}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
        >
          {types.map((type, index) => (
            <option key={type.id} value={type.id}>
              {capitaliser(type.nom || `Type ${index + 1}`)}
            </option>
          ))}
        </select>
      </label>

      {estTypeTravail(typeSelectionne) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Debut</span>
            <input
              type="time"
              value={formulaire.heureDebut}
              onChange={(event) => setFormulaire((etat) => ({ ...etat, heureDebut: event.target.value }))}
              disabled={disabled}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Fin</span>
            <input
              type="time"
              value={formulaire.heureFin}
              onChange={(event) => setFormulaire((etat) => ({ ...etat, heureFin: event.target.value }))}
              disabled={disabled}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function ChampDate({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
      />
    </label>
  )
}

function CellulePlanning({ planning }: { planning: PlanningExecutant | null }) {
  if (!planning?.type_planning) {
    return <span className="text-sm text-slate-300">Non defini</span>
  }

  const type = planning.type_planning
  const couleur = type.couleur || couleurDepuisTexte(type.nom)

  return (
    <div>
      <span
        className="inline-flex rounded-md px-2 py-1 text-xs font-semibold text-white"
        style={{ backgroundColor: couleur }}
      >
        {capitaliser(type.nom)}
      </span>
      {estTypeTravail(type) && (
        <p className="mt-2 text-xs font-medium text-slate-700">
          {formatHeure(planning.heure_debut)}-{formatHeure(planning.heure_fin)}
        </p>
      )}
    </div>
  )
}

function normaliserPayload(payload: PlanningPayload): PlanningPayload {
  if (payload.heure_debut && payload.heure_fin && payload.heure_fin <= payload.heure_debut) {
    throw new Error("L'heure de fin doit etre superieure a l'heure de debut.")
  }

  return payload
}

function debutSemaine(date: Date) {
  const resultat = new Date(date)
  resultat.setDate(resultat.getDate() - resultat.getDay())
  return resultat
}

function semainePlanningParDefaut(date: Date) {
  return debutSemaine(date)
}

function finSemaine(date: Date) {
  return ajouterJours(debutSemaine(date), 6)
}

function ajouterJours(date: Date, jours: number) {
  const resultat = new Date(date)
  resultat.setDate(resultat.getDate() + jours)
  return resultat
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function datesEntre(debut: string, fin: string) {
  const dates: string[] = []
  let date = new Date(`${debut}T00:00:00`)
  const limite = new Date(`${fin}T00:00:00`)

  while (date <= limite) {
    dates.push(formatDateInput(date))
    date = ajouterJours(date, 1)
  }

  return dates
}

function formatDateCourte(date: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(new Date(`${date}T00:00:00`))
}

function formatDateLongue(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function formatHeure(heure?: string | null) {
  return heure?.slice(0, 5) || ''
}

function clePlanning(idExecutant: string, date: string) {
  return `${idExecutant}-${date}`
}

function estTypeTravail(type?: TypePlanning) {
  return type?.nom.toLowerCase() === 'travail'
}

function capitaliser(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function couleurDepuisTexte(value: string) {
  const index = value.split('').reduce((total, lettre) => total + lettre.charCodeAt(0), 0) % couleursFallback.length
  return couleursFallback[index]
}
