import { supabase } from '../lib/supabase'
import { estLieuChambre, listerLieux, type Lieu } from './lieux'
import type { InterventionMaintenance } from './interventionsMaintenance'
import type { TacheChambre } from './tachesChambres'
import type { TachePeriodiqueHistorique } from './tachesPeriodiques'

export type TypeActionHistoriqueChambre = 'menage' | 'intervention' | 'periodique'

export type ActionHistoriqueChambre = {
  id: string
  date: string
  id_lieu: string
  type: TypeActionHistoriqueChambre
  libelle: string
}

export type HistoriqueChambre = {
  chambres: Lieu[]
  actions: ActionHistoriqueChambre[]
}

const selectTacheChambreHistorique =
  'id,id_lieu,date_execution,type_mouvement(id,nom),etat:etat_mouvement(id,nom),lieu:lieux(id,nom,code,id_batiment,id_categorie,id_executant_defaut,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom))'

const selectInterventionHistorique =
  'id,titre,travail_a_faire,id_lieu,date_intervention,date_fin,id_etat,lieu:lieux(id,nom,code,id_batiment,id_categorie,id_executant_defaut,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_intervention:type_intervention_maintenance(id,nom,est_actif),etat:etat_mouvement(id,nom)'

const selectTachePeriodiqueHistorique =
  'id,id_tache,id_lieu,date_realisation,tache:tache_periodique(id,nom),lieu:lieux(id,nom,code,id_batiment,id_categorie,id_executant_defaut,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom))'

export async function listerHistoriqueChambres(dateDebut: string, dateFin: string): Promise<HistoriqueChambre> {
  const [lieuxResultat, menagesResultat, interventionsResultat, periodiquesResultat] = await Promise.all([
    listerLieux(),
    listerActionsMenage(dateDebut, dateFin),
    listerActionsIntervention(dateDebut, dateFin),
    listerActionsPeriodiques(dateDebut, dateFin),
  ])

  const chambres = lieuxResultat
    .filter((lieu) => lieu.est_actif && estLieuChambre(lieu))
    .sort((a, b) => (a.batiment?.nom || '').localeCompare(b.batiment?.nom || '') || (a.numero || a.nom).localeCompare(b.numero || b.nom))
  const idsChambres = new Set(chambres.map((chambre) => chambre.id))
  const actions = [...menagesResultat, ...interventionsResultat, ...periodiquesResultat]
    .filter((action) => idsChambres.has(action.id_lieu))
    .sort((a, b) => a.date.localeCompare(b.date) || ordreType(a.type) - ordreType(b.type) || a.libelle.localeCompare(b.libelle))

  return { chambres, actions }
}

async function listerActionsMenage(dateDebut: string, dateFin: string) {
  const { data, error } = await supabase
    .from('tache_chambre')
    .select(selectTacheChambreHistorique)
    .gte('date_execution', dateDebut)
    .lte('date_execution', dateFin)
    .returns<Array<Pick<TacheChambre, 'id' | 'id_lieu' | 'date_execution' | 'type_mouvement' | 'etat' | 'lieu'>>>()

  if (error) throw error

  return data
    .filter((item) => item.lieu && estLieuChambre(item.lieu))
    .filter((item) => estEtatRealise(item.etat?.nom))
    .map<ActionHistoriqueChambre>((item) => ({
      id: `menage-${item.id}`,
      date: item.date_execution,
      id_lieu: item.id_lieu,
      type: 'menage',
      libelle: libelleCourt(item.type_mouvement?.nom || 'Menage'),
    }))
}

async function listerActionsIntervention(dateDebut: string, dateFin: string) {
  const { data, error } = await supabase
    .from('intervention_maintenance')
    .select(selectInterventionHistorique)
    .eq('est_actif', true)
    .returns<InterventionMaintenance[]>()

  if (error) throw error

  return data
    .filter((item) => item.lieu && estLieuChambre(item.lieu))
    .filter((item) => estEtatRealise(item.etat?.nom))
    .map((item) => ({ item, date: item.date_fin || item.date_intervention }))
    .filter(({ date }) => date >= dateDebut && date <= dateFin)
    .map<ActionHistoriqueChambre>(({ item, date }) => ({
      id: `intervention-${item.id}`,
      date,
      id_lieu: item.id_lieu,
      type: 'intervention',
      libelle: libelleCourt(item.titre || item.type_intervention?.nom || 'Intervention'),
    }))
}

async function listerActionsPeriodiques(dateDebut: string, dateFin: string) {
  const { data, error } = await supabase
    .from('tache_periodique_historique')
    .select(selectTachePeriodiqueHistorique)
    .gte('date_realisation', dateDebut)
    .lte('date_realisation', dateFin)
    .returns<TachePeriodiqueHistorique[]>()

  if (error) throw error

  return data
    .filter((item) => item.lieu && estLieuChambre(item.lieu))
    .map<ActionHistoriqueChambre>((item) => ({
      id: `periodique-${item.id}`,
      date: item.date_realisation,
      id_lieu: item.id_lieu,
      type: 'periodique',
      libelle: libelleCourt(item.tache?.nom || 'Tache periodique'),
    }))
}

function estEtatRealise(etat?: string) {
  return ['TERMINE', 'terminee', 'validee'].includes(etat || '')
}

function libelleCourt(valeur: string) {
  const texte = valeur.trim()
  const upper = texte.toUpperCase()
  const abreviations: Record<string, string> = {
    ARRIVEE: 'Arrivee',
    DEPART: 'Depart',
    RECOUCHE: 'Recouche',
    MENAGE: 'GM',
    'GRAND MENAGE': 'GM',
  }

  return abreviations[upper] || texte
}

function ordreType(type: TypeActionHistoriqueChambre) {
  return { menage: 1, intervention: 2, periodique: 3 }[type]
}
