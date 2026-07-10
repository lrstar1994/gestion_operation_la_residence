import { supabase } from '../lib/supabase'
import type { Executant } from './executants'
import type { Lieu } from './lieux'
import type { EtatMouvement, PlanningChambre, TypeMouvement } from './planningChambre'

export type UrgenceTacheChambre = 'haute' | 'normale' | 'basse'

export type TacheChambre = {
  id: string
  id_planning_chambre: string | null
  id_lieu: string
  id_type_mouvement: string
  date_mouvement: string
  date_execution: string
  date_limite: string
  id_executant: string | null
  id_etat: string
  points: number
  urgence: UrgenceTacheChambre
  commentaire: string | null
  motif_blocage?: string | null
  created_at: string
  updated_at: string
  planning_chambre?: PlanningChambre | null
  lieu?: Lieu | null
  type_mouvement?: TypeMouvement | null
  executant?: Executant | null
  etat?: EtatMouvement | null
}

export type TacheChambrePayload = {
  id_planning_chambre: string | null
  id_lieu: string
  id_type_mouvement: string
  date_mouvement: string
  date_execution: string
  date_limite: string
  id_executant: string | null
  id_etat: string
  points: number
  urgence: UrgenceTacheChambre
  commentaire: string | null
  motif_blocage?: string | null
}

const selectTacheChambre =
  'id,id_planning_chambre,id_lieu,id_type_mouvement,date_mouvement,date_execution,date_limite,id_executant,id_etat,points,urgence,commentaire,motif_blocage,created_at,updated_at,' +
  'planning_chambre:id_planning_chambre(id,id_lieu,date,id_type_mouvement,id_executant,id_etat,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))),' +
  'lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),' +
  'type_mouvement(id,nom,points),' +
  'executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max)),' +
  'etat:etat_mouvement(id,nom)'

export async function listerTachesChambres(dateDebut: string, dateFin?: string) {
  let requete = supabase
    .from('tache_chambre')
    .select(selectTacheChambre)
    .gte('date_execution', dateDebut)

  if (dateFin) {
    requete = requete.lte('date_execution', dateFin)
  }

  const { data, error } = await requete
    .order('date_execution', { ascending: true })
    .order('date_limite', { ascending: true })
    .returns<TacheChambre[]>()

  if (error) throw error
  return data
}

export async function listerToutesTachesChambres() {
  const { data, error } = await supabase
    .from('tache_chambre')
    .select(selectTacheChambre)
    .order('date_execution', { ascending: true })
    .returns<TacheChambre[]>()

  if (error) throw error
  return data
}

export async function creerTacheChambre(payload: TacheChambrePayload) {
  const { data, error } = await supabase
    .from('tache_chambre')
    .insert(payload)
    .select(selectTacheChambre)
    .single<TacheChambre>()

  if (error) throw error
  return data
}

export async function modifierTacheChambre(id: string, payload: Partial<TacheChambrePayload>) {
  const { data, error } = await supabase
    .from('tache_chambre')
    .update(payload)
    .eq('id', id)
    .select(selectTacheChambre)
    .single<TacheChambre>()

  if (error) throw error
  return data
}

export async function supprimerTacheChambre(id: string) {
  const { error } = await supabase.from('tache_chambre').delete().eq('id', id)
  if (error) throw error
}
