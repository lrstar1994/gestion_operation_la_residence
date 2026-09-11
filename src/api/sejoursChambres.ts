import { supabase } from '../lib/supabase'
import type { Lieu } from './lieux'

export type TypeSejourChambre = 'normal' | 'long_sejour'

export type SejourChambre = {
  id: string
  id_lieu: string
  date_debut: string
  date_fin: string
  type_sejour: TypeSejourChambre
  frequence_menage_semaine: 1 | 2 | null
  jour_menage_1: number | null
  jour_menage_2: number | null
  est_actif: boolean
  created_at: string
  updated_at: string
  lieu?: Lieu | null
}

export type SejourChambrePayload = {
  id_lieu: string
  date_debut: string
  date_fin: string
  type_sejour: TypeSejourChambre
  frequence_menage_semaine?: 1 | 2 | null
  jour_menage_1?: number | null
  jour_menage_2?: number | null
  est_actif?: boolean
}

export type HistoriqueDeplacementTacheChambre = {
  id: string
  id_tache_chambre: string
  ancienne_date_execution: string
  nouvelle_date_execution: string
  modifie_par: string | null
  created_at: string
  utilisateur?: {
    id: string
    nom: string
    email: string
  } | null
}

const selectSejourChambre =
  'id,id_lieu,date_debut,date_fin,type_sejour,frequence_menage_semaine,jour_menage_1,jour_menage_2,est_actif,created_at,updated_at,' +
  'lieu:lieux(id,nom,code,id_batiment,id_categorie,id_executant_defaut,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom),executant_defaut:executant(id,nom))'

const selectHistoriqueDeplacement =
  'id,id_tache_chambre,ancienne_date_execution,nouvelle_date_execution,modifie_par,created_at,utilisateur:utilisateurs(id,nom,email)'

export async function listerSejoursChambres() {
  const { data, error } = await supabase
    .from('sejour_chambre')
    .select(selectSejourChambre)
    .order('date_debut', { ascending: false })
    .returns<SejourChambre[]>()

  if (error) throw error
  return data
}

export async function creerSejourChambre(payload: SejourChambrePayload) {
  const { data, error } = await supabase
    .from('sejour_chambre')
    .insert({
      ...payload,
      frequence_menage_semaine: payload.type_sejour === 'long_sejour' ? payload.frequence_menage_semaine : null,
      jour_menage_1: payload.type_sejour === 'long_sejour' ? payload.jour_menage_1 : null,
      jour_menage_2: payload.type_sejour === 'long_sejour' && payload.frequence_menage_semaine === 2 ? payload.jour_menage_2 : null,
      est_actif: payload.est_actif ?? true,
    })
    .select(selectSejourChambre)
    .single<SejourChambre>()

  if (error) throw error
  return data
}

export async function modifierSejourChambre(id: string, payload: Partial<SejourChambrePayload>) {
  const typeSejour = payload.type_sejour
  const frequence = typeSejour === 'normal' ? null : payload.frequence_menage_semaine
  const jour1 = typeSejour === 'normal' ? null : payload.jour_menage_1
  const jour2 = typeSejour === 'long_sejour' && payload.frequence_menage_semaine === 2 ? payload.jour_menage_2 : null
  const payloadFinal = typeSejour
    ? { ...payload, frequence_menage_semaine: frequence, jour_menage_1: jour1, jour_menage_2: jour2 }
    : payload

  const { data, error } = await supabase
    .from('sejour_chambre')
    .update(payloadFinal)
    .eq('id', id)
    .select(selectSejourChambre)
    .single<SejourChambre>()

  if (error) throw error
  return data
}

export async function listerHistoriqueDeplacementsTachesChambres() {
  const { data, error } = await supabase
    .from('historique_deplacement_tache_chambre')
    .select(selectHistoriqueDeplacement)
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<HistoriqueDeplacementTacheChambre[]>()

  if (error) throw error
  return data
}
