import { listerExecutants, type Executant } from './executants'
import {
  listerInterventionsMaintenance,
  modifierInterventionMaintenance,
  reordonnerInterventionsMaintenance,
  type InterventionMaintenance,
} from './interventionsMaintenance'
import { listerEtatsMouvement, type EtatMouvement } from './planningChambre'
import {
  listerPlanningTachesPeriodiques,
  modifierPlanningTachePeriodique,
  type TachePeriodiquePlanning,
} from './tachesPeriodiques'
import {
  idsExecutantsTacheChambre,
  listerTachesChambres,
  modifierTacheChambre,
  type TacheChambre,
} from './tachesChambres'

export type ItemFemmeChambre =
  | { source: 'chambre'; id: string; executant: Executant; lieu: string; action: string; statut: string; progression: number; points: number; tache: TacheChambre }
  | { source: 'periodique'; id: string; executant: Executant; lieu: string; action: string; statut: string; progression: number; points: 0; planning: TachePeriodiquePlanning }

export type ItemMaintenance = {
  id: string
  executant: Executant
  lieu: string
  titre: string
  type: string
  idTypeIntervention: string
  ordre: number | null
  statut: string
  intervention: InterventionMaintenance
}

export type ItemNonAffecte =
  | { source: 'chambre'; id: string; libelleSource: string; lieu: string; action: string; statut: string; date: string; tache: TacheChambre }
  | { source: 'periodique'; id: string; libelleSource: string; lieu: string; action: string; statut: string; date: string; planning: TachePeriodiquePlanning }
  | { source: 'maintenance'; id: string; libelleSource: string; lieu: string; action: string; statut: string; date: string; intervention: InterventionMaintenance }

export type SuiviDuJour = {
  femmesChambre: ItemFemmeChambre[]
  maintenances: ItemMaintenance[]
  nonAffectes: ItemNonAffecte[]
  executantsChambres: Executant[]
  maintenanciers: Executant[]
  etats: EtatMouvement[]
}

export async function chargerSuiviDuJour(date: string): Promise<SuiviDuJour> {
  const [tachesChambres, planningsPeriodiques, interventions, executants, etats] = await Promise.all([
    listerTachesChambres(date, date),
    listerPlanningTachesPeriodiques(),
    listerInterventionsMaintenance(),
    listerExecutants(),
    listerEtatsMouvement(),
  ])

  const executantsParId = new Map(executants.map((executant) => [executant.id, executant]))
  const femmesChambreIds = new Set(executants.filter(estFemmeDeChambre).map((executant) => executant.id))
  const maintenancierIds = new Set(executants.filter(estMaintenancier).map((executant) => executant.id))
  const periodiquesJour = planningsPeriodiques.filter((planning) => planning.est_actif && !planning.date_realisation && planning.date_echeance <= date)
  const interventionsJour = interventions
    .filter((intervention) => intervention.est_actif)
    .filter((intervention) => !estEtatFerme(intervention.etat?.nom))
    .filter((intervention) => intervention.date_intervention <= date)

  const femmesChambre: ItemFemmeChambre[] = []
  const nonAffectes: ItemNonAffecte[] = []

  tachesChambres.forEach((tache) => {
    const ids = idsExecutantsTacheChambre(tache)

    if (ids.length === 0) {
      nonAffectes.push({
        source: 'chambre',
        id: tache.id,
        libelleSource: 'Chambre',
        lieu: tache.lieu?.nom || 'Chambre',
        action: libelleActionChambre(tache.type_mouvement?.nom),
        statut: tache.etat?.nom || 'AFFECTE',
        date: tache.date_execution,
        tache,
      })
      return
    }

    ids.forEach((idExecutant) => {
      const executant = executantsParId.get(idExecutant)
      if (!executant || !femmesChambreIds.has(idExecutant)) return

      femmesChambre.push({
        source: 'chambre',
        id: `${tache.id}-${idExecutant}`,
        executant,
        lieu: tache.lieu?.nom || 'Chambre',
        action: libelleActionChambre(tache.type_mouvement?.nom),
        statut: tache.etat?.nom || 'AFFECTE',
        progression: progressionDepuisEtat(tache.etat?.nom),
        points: pointsChambreSuivi(tache.type_mouvement?.nom, tache.points) / Math.max(ids.length, 1),
        tache,
      })
    })
  })

  periodiquesJour.forEach((planning) => {
    if (!planning.id_executant) {
      nonAffectes.push({
        source: 'periodique',
        id: planning.id,
        libelleSource: 'Periodique',
        lieu: planning.lieu?.nom || 'Lieu',
        action: planning.tache?.nom || 'Tache periodique',
        statut: planning.etat?.nom || 'A_FAIRE',
        date: planning.date_echeance,
        planning,
      })
      return
    }

    const executant = executantsParId.get(planning.id_executant)
    if (!executant || !femmesChambreIds.has(planning.id_executant)) return

    femmesChambre.push({
      source: 'periodique',
      id: planning.id,
      executant,
      lieu: planning.lieu?.nom || 'Lieu',
      action: planning.tache?.nom || 'Tache periodique',
      statut: planning.etat?.nom || 'A_FAIRE',
      progression: progressionDepuisEtat(planning.etat?.nom),
      points: 0,
      planning,
    })
  })

  const maintenances: ItemMaintenance[] = []

  interventionsJour.forEach((intervention) => {
    if (!intervention.id_executant) {
      nonAffectes.push({
        source: 'maintenance',
        id: intervention.id,
        libelleSource: 'Maintenance',
        lieu: intervention.lieu?.nom || 'Lieu',
        action: intervention.titre,
        statut: intervention.etat?.nom || 'AFFECTE',
        date: intervention.date_intervention,
        intervention,
      })
      return
    }

    const executant = executantsParId.get(intervention.id_executant)
    if (!executant || !maintenancierIds.has(intervention.id_executant)) return

    maintenances.push({
      id: intervention.id,
      executant,
      lieu: intervention.lieu?.nom || 'Lieu',
      titre: intervention.titre,
      type: intervention.type_intervention?.nom || 'Maintenance',
      idTypeIntervention: intervention.id_type_intervention,
      ordre: intervention.ordre_realisation,
      statut: intervention.etat?.nom || 'AFFECTE',
      intervention,
    })
  })

  return {
    femmesChambre: femmesChambre.sort((a, b) => a.executant.nom.localeCompare(b.executant.nom) || a.lieu.localeCompare(b.lieu)),
    maintenances: maintenances.sort((a, b) => a.executant.nom.localeCompare(b.executant.nom) || (a.ordre ?? 9999) - (b.ordre ?? 9999) || a.titre.localeCompare(b.titre)),
    nonAffectes: nonAffectes.sort((a, b) => a.libelleSource.localeCompare(b.libelleSource) || a.lieu.localeCompare(b.lieu)),
    executantsChambres: executants.filter(estFemmeDeChambre),
    maintenanciers: executants.filter(estMaintenancier),
    etats,
  }
}

export async function changerEtatSuiviDuJour(item: ItemFemmeChambre, idEtat: string) {
  if (item.source === 'chambre') {
    return modifierTacheChambre(item.tache.id, { id_etat: idEtat })
  }

  return modifierPlanningTachePeriodique(item.planning.id, { id_etat: idEtat })
}

export async function affecterItemNonAffecte(item: ItemNonAffecte, idExecutant: string) {
  if (item.source === 'chambre') {
    return modifierTacheChambre(item.tache.id, { id_executant: idExecutant, id_executants: [idExecutant] })
  }

  if (item.source === 'periodique') {
    return modifierPlanningTachePeriodique(item.planning.id, { id_executant: idExecutant })
  }

  return modifierInterventionMaintenance(item.intervention.id, { id_executant: idExecutant })
}

export async function changerEtatInterventionSuivi(intervention: InterventionMaintenance, idEtat: string) {
  return modifierInterventionMaintenance(intervention.id, { id_etat: idEtat })
}

export async function deplacerInterventionMaintenanceJour(
  item: ItemMaintenance,
  toutesInterventions: ItemMaintenance[],
  direction: -1 | 1,
) {
  const fileType = toutesInterventions
    .filter((intervention) => intervention.idTypeIntervention === item.idTypeIntervention)
    .sort((a, b) => (a.ordre ?? 9999) - (b.ordre ?? 9999) || a.titre.localeCompare(b.titre))
  const index = fileType.findIndex((intervention) => intervention.id === item.id)
  const cible = index + direction

  if (index < 0 || cible < 0 || cible >= fileType.length) return

  const ids = fileType.map((intervention) => intervention.id)
  const [deplace] = ids.splice(index, 1)
  ids.splice(cible, 0, deplace)
  await reordonnerInterventionsMaintenance(item.idTypeIntervention, ids)
}

function estFemmeDeChambre(executant: Executant) {
  return executant.domaine?.nom.toLowerCase().includes('chambre') || false
}

function estMaintenancier(executant: Executant) {
  return executant.domaine?.nom.toLowerCase().includes('maint') || false
}

function estEtatFerme(etat?: string | null) {
  return ['TERMINE', 'VALIDEE', 'ANNULEE', 'terminee', 'validee', 'annulee'].includes(etat || '')
}

function progressionDepuisEtat(etat?: string | null) {
  if (etat === 'TERMINE' || etat === 'terminee') return 100
  if (etat === 'EN_COURS' || etat === 'en_cours') return 50
  if (etat === 'BLOQUE' || etat === 'bloquee') return 25
  return 0
}

function libelleActionChambre(type?: string | null) {
  const nom = type?.trim().toUpperCase()
  if (nom === 'ARRIVEE') return 'Preparation arrivee'
  if (nom === 'DEPART') return 'Nettoyage depart'
  if (nom === 'RECOUCHE') return 'Recouche'
  if (nom === 'MENAGE') return 'Menage'
  return type || 'Travail chambre'
}

function pointsChambreSuivi(type: string | null | undefined, pointsFallback: number) {
  const nom = type?.trim().toUpperCase()
  if (nom === 'RECOUCHE') return 1
  if (nom === 'ARRIVEE') return 2
  if (nom === 'DEPART') return 3
  return pointsFallback || 0
}
