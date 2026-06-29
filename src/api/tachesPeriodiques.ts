import type { Executant } from './executants'
import type { CategorieLieu, Lieu } from './lieux'
import type { EtatMouvement } from './planningChambre'
import { supabase } from '../lib/supabase'

export type PrioriteTache = 'haute' | 'normale' | 'basse'
export type LourdeurTache = 'leger' | 'moyen' | 'lourd'
export type NatureTache = 'obligatoire' | 'entretien' | 'opportuniste'

export type TachePeriodique = {
  id: string
  nom: string
  code: string | null
  description: string | null
  id_categorie_lieu: string | null
  frequence_jours: number
  priorite: PrioriteTache
  niveau_lourdeur: LourdeurTache
  nature: NatureTache
  points_estimes: number
  est_reportable: boolean
  delai_alerte_jours: number
  est_actif: boolean
  categorie_lieu?: CategorieLieu | null
}

export type TachePeriodiquePayload = Omit<TachePeriodique, 'id'>

export type TachePeriodiquePlanning = {
  id: string
  id_tache: string
  id_lieu: string
  id_executant: string | null
  date_realisation: string | null
  date_echeance: string
  date_echeance_originale: string | null
  id_etat: string
  est_reportee: boolean
  motif_report: string | null
  est_actif: boolean
  tache?: TachePeriodique | null
  lieu?: Lieu | null
  executant?: Executant | null
  etat?: EtatMouvement | null
}

export type TachePeriodiquePlanningPayload = {
  id_tache: string
  id_lieu: string
  id_executant: string | null
  date_realisation: string | null
  date_echeance: string
  date_echeance_originale: string | null
  id_etat: string
  est_reportee: boolean
  motif_report: string | null
  est_actif: boolean
}

export type TachePeriodiqueHistorique = {
  id: string
  id_tache: string
  id_lieu: string
  id_executant: string | null
  date_realisation: string
  duree_minutes: number | null
  commentaire: string | null
  created_at: string
  tache?: TachePeriodique | null
  lieu?: Lieu | null
  executant?: Executant | null
}

const selectTache =
  'id,nom,code,description,id_categorie_lieu,frequence_jours,priorite,niveau_lourdeur,nature,points_estimes,est_reportable,delai_alerte_jours,est_actif,categorie_lieu:categories_lieu(id,code,nom)'
const selectPlanning =
  'id,id_tache,id_lieu,id_executant,date_realisation,date_echeance,date_echeance_originale,id_etat,est_reportee,motif_report,est_actif,tache:tache_periodique(id,nom,code,description,id_categorie_lieu,frequence_jours,priorite,niveau_lourdeur,nature,points_estimes,est_reportable,delai_alerte_jours,est_actif,categorie_lieu:categories_lieu(id,code,nom)),lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max)),etat:etat_mouvement(id,nom)'
const selectHistorique =
  'id,id_tache,id_lieu,id_executant,date_realisation,duree_minutes,commentaire,created_at,tache:tache_periodique(id,nom,code,description,id_categorie_lieu,frequence_jours,priorite,niveau_lourdeur,nature,points_estimes,est_reportable,delai_alerte_jours,est_actif,categorie_lieu:categories_lieu(id,code,nom)),lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))'

export async function listerTachesPeriodiques() {
  const { data, error } = await supabase.from('tache_periodique').select(selectTache).order('nom').returns<TachePeriodique[]>()
  if (error) throw error
  return data
}

export async function creerTachePeriodique(payload: TachePeriodiquePayload) {
  const { data, error } = await supabase.from('tache_periodique').insert(payload).select(selectTache).single<TachePeriodique>()
  if (error) throw error
  return data
}

export async function modifierTachePeriodique(id: string, payload: TachePeriodiquePayload) {
  const { data, error } = await supabase.from('tache_periodique').update(payload).eq('id', id).select(selectTache).single<TachePeriodique>()
  if (error) throw error
  return data
}

export async function supprimerTachePeriodique(id: string) {
  const { error } = await supabase.from('tache_periodique').delete().eq('id', id)
  if (error) throw error
}

export async function listerPlanningTachesPeriodiques() {
  const { data, error } = await supabase
    .from('tache_periodique_planning')
    .select(selectPlanning)
    .eq('est_actif', true)
    .order('date_echeance', { ascending: true })
    .returns<TachePeriodiquePlanning[]>()
  if (error) throw error
  return data
}

export async function creerPlanningTachePeriodique(payload: TachePeriodiquePlanningPayload) {
  const { data, error } = await supabase
    .from('tache_periodique_planning')
    .insert(payload)
    .select(selectPlanning)
    .single<TachePeriodiquePlanning>()
  if (error) throw error
  return data
}

export async function modifierPlanningTachePeriodique(id: string, payload: Partial<TachePeriodiquePlanningPayload>) {
  const { data, error } = await supabase
    .from('tache_periodique_planning')
    .update(payload)
    .eq('id', id)
    .select(selectPlanning)
    .single<TachePeriodiquePlanning>()
  if (error) throw error
  return data
}

export async function realiserTachePeriodique(
  planning: TachePeriodiquePlanning,
  payload: { id_executant: string | null; date_realisation: string; duree_minutes: number | null; commentaire: string | null; idEtatAFaire: string },
) {
  const prochaineEcheance = ajouterJours(payload.date_realisation, planning.tache?.frequence_jours || 1)

  const { error: historiqueError } = await supabase.from('tache_periodique_historique').insert({
    id_tache: planning.id_tache,
    id_lieu: planning.id_lieu,
    id_executant: payload.id_executant,
    date_realisation: payload.date_realisation,
    duree_minutes: payload.duree_minutes,
    commentaire: payload.commentaire,
  })
  if (historiqueError) throw historiqueError

  return modifierPlanningTachePeriodique(planning.id, {
    id_executant: null,
    date_realisation: null,
    date_echeance: prochaineEcheance,
    date_echeance_originale: prochaineEcheance,
    id_etat: payload.idEtatAFaire,
    est_reportee: false,
    motif_report: null,
  })
}

export async function reporterTachePeriodique(id: string, dateEcheance: string, motif: string) {
  return modifierPlanningTachePeriodique(id, {
    date_echeance: dateEcheance,
    est_reportee: true,
    motif_report: motif,
  })
}

export async function listerHistoriqueTachesPeriodiques() {
  const { data, error } = await supabase
    .from('tache_periodique_historique')
    .select(selectHistorique)
    .order('date_realisation', { ascending: false })
    .limit(200)
    .returns<TachePeriodiqueHistorique[]>()
  if (error) throw error
  return data
}

function ajouterJours(date: string, jours: number) {
  const resultat = new Date(`${date}T00:00:00`)
  resultat.setDate(resultat.getDate() + jours)
  const annee = resultat.getFullYear()
  const mois = String(resultat.getMonth() + 1).padStart(2, '0')
  const jour = String(resultat.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}
