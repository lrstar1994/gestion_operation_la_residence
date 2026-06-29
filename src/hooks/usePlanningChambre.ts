import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import { listerLieux, type Lieu } from '../api/lieux'
import { listerPlanning, type PlanningExecutant } from '../api/planning'
import { listerHistoriqueTachesPeriodiques, listerPlanningTachesPeriodiques, type TachePeriodiqueHistorique, type TachePeriodiquePlanning } from '../api/tachesPeriodiques'
import {
  appliquerMouvementsLot,
  calculerCharges,
  creerMouvementChambre,
  listerEtatsMouvement,
  listerPlanningChambre,
  listerTypesMouvement,
  modifierMouvementChambre,
  supprimerMouvementChambre,
  verifierConflitsPlanningChambre,
  type ChargeExecutant,
  type EtatMouvement,
  type PlanningChambre,
  type PlanningChambrePayload,
  type TypeMouvement,
} from '../api/planningChambre'

export type SuggestionAffectation = {
  payload: PlanningChambrePayload
  chargeActuelle: ChargeExecutant | null
  suggestions: ChargeExecutant[]
}

export function usePlanningChambre(dateDebut: string, dateFin?: string) {
  const [chambres, setChambres] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [typesMouvement, setTypesMouvement] = useState<TypeMouvement[]>([])
  const [etats, setEtats] = useState<EtatMouvement[]>([])
  const [planning, setPlanning] = useState<PlanningChambre[]>([])
  const [planningTaches, setPlanningTaches] = useState<TachePeriodiquePlanning[]>([])
  const [historiqueTaches, setHistoriqueTaches] = useState<TachePeriodiqueHistorique[]>([])
  const [planningExecutants, setPlanningExecutants] = useState<PlanningExecutant[]>([])
  const [chargement, setChargement] = useState(true)

  const etatAffecte = etats.find((etat) => etat.nom === 'AFFECTE') || etats[0]
  const charges = useMemo(() => calculerCharges(planning, executants, planningTaches, historiqueTaches), [executants, historiqueTaches, planning, planningTaches])

  const planningParCellule = useMemo(() => {
    const map = new Map<string, PlanningChambre[]>()

    planning.forEach((mouvement) => {
      const cle = `${mouvement.id_lieu}-${mouvement.date}`
      map.set(cle, [...(map.get(cle) || []), mouvement])
    })

    return map
  }, [planning])

  const charger = useCallback(async () => {
    setChargement(true)

    try {
      const [
        lieuxResultat,
        executantsResultat,
        typesResultat,
        etatsResultat,
        planningResultat,
        planningExecutantsResultat,
        planningTachesResultat,
        historiqueTachesResultat,
      ] = await Promise.all([
        listerLieux(),
        listerExecutants(),
        listerTypesMouvement(),
        listerEtatsMouvement(),
        listerPlanningChambre(dateDebut, dateFin),
        listerPlanning(dateDebut, dateFin),
        listerPlanningTachesPeriodiques(),
        listerHistoriqueTachesPeriodiques(),
      ])

      setChambres(lieuxResultat.filter((lieu) => lieu.est_actif && lieu.categorie?.code === 'chambre'))
      setExecutants(executantsResultat.filter((executant) => executant.domaine?.nom.toLowerCase().includes('chambre')))
      setTypesMouvement(typesResultat)
      setEtats(etatsResultat)
      setPlanning(planningResultat)
      setPlanningExecutants(planningExecutantsResultat)
      setPlanningTaches(planningTachesResultat.filter((tache) => tache.date_echeance >= dateDebut && (!dateFin || tache.date_echeance <= dateFin)))
      setHistoriqueTaches(historiqueTachesResultat.filter((tache) => tache.date_realisation >= dateDebut && (!dateFin || tache.date_realisation <= dateFin)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Planning chambres impossible a charger.')
    } finally {
      setChargement(false)
    }
  }, [dateDebut, dateFin])

  useEffect(() => {
    void charger()
  }, [charger])

  function executantDefautPourChambre(chambre: Lieu) {
    return chambre.batiment?.id_executant_defaut || null
  }

  function estExecutantEnTravail(idExecutant: string | null | undefined, date: string) {
    if (!idExecutant) return false

    return planningExecutants.some(
      (planningExecutant) =>
        planningExecutant.id_executant === idExecutant &&
        planningExecutant.date === date &&
        planningExecutant.type_planning?.nom.toUpperCase() === 'TRAVAIL',
    )
  }

  function executantsEnTravail(date: string) {
    return executants.filter((executant) => estExecutantEnTravail(executant.id, date))
  }

  function mouvementPayload(chambre: Lieu, date: string, typeId: string, executantId?: string | null): PlanningChambrePayload {
    const executantCandidat = executantId ?? executantDefautPourChambre(chambre)

    return {
      id_lieu: chambre.id,
      date,
      id_type_mouvement: typeId,
      id_executant: estExecutantEnTravail(executantCandidat, date) ? executantCandidat : null,
      id_etat: etatAffecte?.id || '',
    }
  }

  function detecterSurcharges(payloads: PlanningChambrePayload[]) {
    const pointsParType = new Map(typesMouvement.map((type) => [type.id, type.points]))
    const pointsAjoutes = new Map<string, number>()

    payloads.forEach((payload) => {
      if (!payload.id_executant) return
      const cle = `${payload.id_executant}-${payload.date}`
      pointsAjoutes.set(
        cle,
        (pointsAjoutes.get(cle) || 0) + (pointsParType.get(payload.id_type_mouvement) || 0),
      )
    })

    const suggestions: SuggestionAffectation[] = []

    payloads.forEach((payload) => {
      if (!payload.id_executant) return

      const charge = charges.find((item) => item.executant.id === payload.id_executant) || null
      const chargeJour = charge?.pointsParDate.find((item) => item.date === payload.date)
      const ajout = pointsAjoutes.get(`${payload.id_executant}-${payload.date}`) || 0
      const pointsJour = chargeJour?.points || 0

      if (!charge?.capaciteMax || pointsJour + ajout <= charge.capaciteMax) {
        return
      }

      const mouvementPoints = pointsParType.get(payload.id_type_mouvement) || 0
      suggestions.push({
        payload,
        chargeActuelle: charge,
        suggestions: charges
          .filter((item) => item.executant.id !== payload.id_executant)
          .filter((item) => item.executant.domaine?.nom.toLowerCase().includes('chambre'))
          .filter((item) => estExecutantEnTravail(item.executant.id, payload.date))
          .filter((item) => {
            if (item.capaciteMax === null) return true

            const chargeJourSuggestion = item.pointsParDate.find((chargeDate) => chargeDate.date === payload.date)
            const pointsDejaProposes = pointsAjoutes.get(`${item.executant.id}-${payload.date}`) || 0
            return (chargeJourSuggestion?.points || 0) + pointsDejaProposes + mouvementPoints <= item.capaciteMax * 0.9
          })
          .sort((a, b) => a.points - b.points),
      })
    })

    return suggestions
  }

  async function appliquerLot(payloads: PlanningChambrePayload[], remplacer: boolean) {
    const resultat = await appliquerMouvementsLot(payloads, remplacer)
    fusionnerPlanning(resultat.sauvegardes)
    return resultat
  }

  async function verifierConflits(payloads: PlanningChambrePayload[]) {
    return verifierConflitsPlanningChambre(payloads)
  }

  async function enregistrerMouvement(payload: PlanningChambrePayload, id?: string) {
    const mouvement = id ? await modifierMouvementChambre(id, payload) : await creerMouvementChambre(payload)
    fusionnerPlanning([mouvement])
    return mouvement
  }

  async function supprimerMouvement(id: string) {
    await supprimerMouvementChambre(id)
    setPlanning((liste) => liste.filter((mouvement) => mouvement.id !== id))
  }

  function fusionnerPlanning(nouveaux: PlanningChambre[]) {
    setPlanning((liste) => {
      const map = new Map(liste.map((mouvement) => [mouvement.id, mouvement]))
      nouveaux.forEach((mouvement) => map.set(mouvement.id, mouvement))
      return Array.from(map.values())
    })
  }

  return {
    chambres,
    executants,
    planningExecutants,
    typesMouvement,
    etats,
    planning,
    charges,
    planningParCellule,
    chargement,
    etatAffecte,
    charger,
    mouvementPayload,
    executantsEnTravail,
    estExecutantEnTravail,
    verifierConflits,
    detecterSurcharges,
    appliquerLot,
    enregistrerMouvement,
    supprimerMouvement,
  }
}
