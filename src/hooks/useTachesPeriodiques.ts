import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import { listerLieux, type Lieu } from '../api/lieux'
import { listerPlanning, type PlanningExecutant } from '../api/planning'
import { listerEtatsMouvement, listerPlanningChambre, type EtatMouvement, type PlanningChambre } from '../api/planningChambre'
import {
  listerHistoriqueTachesPeriodiques,
  listerPlanningTachesPeriodiques,
  listerTachesPeriodiques,
  type TachePeriodique,
  type TachePeriodiqueHistorique,
  type TachePeriodiquePlanning,
} from '../api/tachesPeriodiques'

export type ClassificationTache = {
  niveau: 1 | 2 | 3 | 4 | 5 | 6
  label: string
  couleur: 'red' | 'orange' | 'green' | 'slate'
  jours: number
}

export type PropositionTache = {
  planning: TachePeriodiquePlanning
  classification: ClassificationTache
  executant: Executant
  pointsLibres: number | null
  score: number
}

export function useTachesPeriodiques() {
  const [taches, setTaches] = useState<TachePeriodique[]>([])
  const [planning, setPlanning] = useState<TachePeriodiquePlanning[]>([])
  const [historique, setHistorique] = useState<TachePeriodiqueHistorique[]>([])
  const [lieux, setLieux] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [etats, setEtats] = useState<EtatMouvement[]>([])
  const [planningChambres, setPlanningChambres] = useState<PlanningChambre[]>([])
  const [planningExecutants, setPlanningExecutants] = useState<PlanningExecutant[]>([])
  const [chargement, setChargement] = useState(true)

  const aujourdHui = formatDateInput(new Date())
  const dateFin = ajouterJours(aujourdHui, 30)

  const charger = useCallback(async () => {
    setChargement(true)

    try {
      const [
        tachesResultat,
        planningResultat,
        historiqueResultat,
        lieuxResultat,
        executantsResultat,
        etatsResultat,
        planningChambresResultat,
        planningExecutantsResultat,
      ] = await Promise.all([
        listerTachesPeriodiques(),
        listerPlanningTachesPeriodiques(),
        listerHistoriqueTachesPeriodiques(),
        listerLieux(),
        listerExecutants(),
        listerEtatsMouvement(),
        listerPlanningChambre(aujourdHui, dateFin),
        listerPlanning(aujourdHui, dateFin),
      ])

      setTaches(tachesResultat)
      setPlanning(planningResultat)
      setHistorique(historiqueResultat)
      setLieux(lieuxResultat)
      setExecutants(executantsResultat)
      setEtats(etatsResultat)
      setPlanningChambres(planningChambresResultat)
      setPlanningExecutants(planningExecutantsResultat)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Taches periodiques impossibles a charger.')
    } finally {
      setChargement(false)
    }
  }, [aujourdHui, dateFin])

  useEffect(() => {
    void charger()
  }, [charger])

  const classifications = useMemo(() => {
    const map = new Map<string, ClassificationTache>()
    planning.forEach((item) => map.set(item.id, classifierTache(item.date_echeance, item.tache?.delai_alerte_jours ?? 3)))
    return map
  }, [planning])

  const propositions = useMemo(() => {
    const charges = calculerChargesExecutants(planningChambres, planning, historique)

    return planning
      .filter((item) => item.est_actif && item.tache?.est_actif && !item.date_realisation && !item.id_executant)
      .filter((item) => estLieuDisponible(item.lieu, item.date_echeance, planningChambres))
      .flatMap((item) => {
        const classification = classifications.get(item.id) || classifierTache(item.date_echeance, item.tache?.delai_alerte_jours ?? 3)
        const candidats = executants
          .filter((executant) => estExecutantCompatibleAvecLieu(executant, item.lieu))
          .filter((executant) => estExecutantEnTravail(executant.id, item.date_echeance, planningExecutants))
          .map((executant) => {
            const charge = charges.get(`${executant.id}-${item.date_echeance}`) || 0
            const capacite = executant.domaine?.capacite_max ?? null
            const pointsLibres = capacite === null ? null : capacite - charge
            return { executant, pointsLibres, charge, capacite }
          })
          .filter((candidat) => candidat.pointsLibres === null || candidat.pointsLibres >= (item.tache?.points_estimes || 0))
          .filter((candidat) => {
            if (candidat.capacite === null) return true
            if (candidat.charge < candidat.capacite * 0.9) return true
            return item.tache?.nature === 'obligatoire' || item.tache?.priorite === 'haute'
          })

        const meilleurCandidat = candidats.sort((a, b) => {
          if (a.charge !== b.charge) return a.charge - b.charge
          if (a.pointsLibres === null && b.pointsLibres !== null) return 1
          if (a.pointsLibres !== null && b.pointsLibres === null) return -1
          if (a.pointsLibres !== null && b.pointsLibres !== null && a.pointsLibres !== b.pointsLibres) {
            return b.pointsLibres - a.pointsLibres
          }
          return a.executant.nom.localeCompare(b.executant.nom)
        })[0]

        if (!meilleurCandidat) return []

        return [{
          planning: item,
          classification,
          executant: meilleurCandidat.executant,
          pointsLibres: meilleurCandidat.pointsLibres,
          score: scoreTache(item, classification),
        }]
      })
      .sort((a, b) => b.score - a.score)
  }, [classifications, executants, planning, planningChambres, planningExecutants])

  return {
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
  }
}

export function classifierTache(dateEcheance: string, delaiAlerte: number): ClassificationTache {
  const jours = differenceJours(formatDateInput(new Date()), dateEcheance)

  if (jours < 0) return { niveau: 1, label: `En retard de ${Math.abs(jours)} j`, couleur: 'red', jours }
  if (jours === 0) return { niveau: 2, label: "Due aujourd'hui", couleur: 'orange', jours }
  if (jours <= delaiAlerte) return { niveau: 3, label: `Dans ${jours} j`, couleur: 'green', jours }
  if (jours <= 7) return { niveau: 4, label: 'Cette semaine', couleur: 'green', jours }
  if (jours <= 30) return { niveau: 5, label: 'Ce mois', couleur: 'slate', jours }
  return { niveau: 6, label: 'Non urgente', couleur: 'slate', jours }
}

function scoreTache(item: TachePeriodiquePlanning, classification: ClassificationTache) {
  const urgence = 100 - classification.niveau * 10
  const nonReportable = item.tache?.est_reportable === false && classification.jours < 0 ? 50 : 0
  const nature = item.tache?.nature === 'obligatoire' ? 30 : item.tache?.nature === 'entretien' ? 15 : 5
  const priorite = item.tache?.priorite === 'haute' ? 20 : item.tache?.priorite === 'normale' ? 10 : 0
  return urgence + nonReportable + nature + priorite
}

function estLieuDisponible(lieu: Lieu | null | undefined, date: string, planningChambres: PlanningChambre[]) {
  if (!lieu) return false
  if (lieu.categorie?.code !== 'chambre') return true
  return !planningChambres.some((mouvement) => mouvement.id_lieu === lieu.id && mouvement.date === date)
}

export function estExecutantCompatibleAvecLieu(executant: Executant, lieu: Lieu | null | undefined) {
  const domaine = executant.domaine?.nom.toLowerCase() || ''
  const categorie = lieu?.categorie?.code.toLowerCase() || lieu?.categorie?.nom.toLowerCase() || ''

  if (categorie.includes('chambre')) return domaine.includes('chambre')
  if (categorie.includes('salle') || categorie.includes('commun') || categorie.includes('restaurant')) return domaine.includes('salle')
  if (categorie.includes('technique') || categorie.includes('maintenance')) return domaine.includes('maint')

  return true
}

function estExecutantEnTravail(idExecutant: string, date: string, planningExecutants: PlanningExecutant[]) {
  return planningExecutants.some(
    (planning) => planning.id_executant === idExecutant && planning.date === date && planning.type_planning?.nom.toUpperCase() === 'TRAVAIL',
  )
}

function calculerChargesExecutants(
  planningChambres: PlanningChambre[],
  planningTaches: TachePeriodiquePlanning[],
  historiqueTaches: TachePeriodiqueHistorique[],
) {
  const map = new Map<string, number>()

  planningChambres.forEach((mouvement) => {
    if (!mouvement.id_executant) return
    const cle = `${mouvement.id_executant}-${mouvement.date}`
    map.set(cle, (map.get(cle) || 0) + (mouvement.type_mouvement?.points || 0))
  })

  planningTaches.forEach((tache) => {
    if (!tache.id_executant || !tache.est_actif || tache.date_realisation || tache.etat?.nom === 'ANNULEE') return
    const cle = `${tache.id_executant}-${tache.date_echeance}`
    map.set(cle, (map.get(cle) || 0) + (tache.tache?.points_estimes || 0))
  })

  historiqueTaches.forEach((tache) => {
    if (!tache.id_executant) return
    const cle = `${tache.id_executant}-${tache.date_realisation}`
    map.set(cle, (map.get(cle) || 0) + (tache.tache?.points_estimes || 0))
  })

  return map
}

function differenceJours(debut: string, fin: string) {
  const a = new Date(`${debut}T00:00:00`).getTime()
  const b = new Date(`${fin}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

function ajouterJours(date: string, jours: number) {
  const resultat = new Date(`${date}T00:00:00`)
  resultat.setDate(resultat.getDate() + jours)
  return formatDateInput(resultat)
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}
