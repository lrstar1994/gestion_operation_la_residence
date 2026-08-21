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
  executants?: Array<{ id: string; id_executant: string; executant?: Executant | null }>
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
  id_executants?: string[]
  id_etat: string
  points: number
  urgence: UrgenceTacheChambre
  commentaire: string | null
  motif_blocage?: string | null
}

const selectTacheChambre =
  'id,id_planning_chambre,id_lieu,id_type_mouvement,date_mouvement,date_execution,date_limite,id_executant,id_etat,points,urgence,commentaire,motif_blocage,created_at,updated_at,' +
  'planning_chambre:id_planning_chambre(id,id_lieu,date,id_type_mouvement,id_executant,id_etat,lieu:lieux(id,nom,code,id_batiment,id_categorie,id_executant_defaut,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom),executant_defaut:executant(id,nom)),type_mouvement(id,nom,points,couleur),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))),' +
  'lieu:lieux(id,nom,code,id_batiment,id_categorie,id_executant_defaut,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom),executant_defaut:executant(id,nom)),' +
  'type_mouvement(id,nom,points,couleur),' +
  'executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max)),' +
  'executants:tache_chambre_executant(id,id_executant,executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))),' +
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
  const { id_executants, ...payloadBase } = normaliserPayloadTacheChambre(payload)
  const { data, error } = await supabase
    .from('tache_chambre')
    .insert(payloadBase)
    .select(selectTacheChambre)
    .single<TacheChambre>()

  if (error) throw error
  return remplacerExecutantsTacheChambre(data.id, id_executants)
}

export async function modifierTacheChambre(id: string, payload: Partial<TacheChambrePayload>) {
  const idExecutants = payload.id_executants ?? (payload.id_executant !== undefined ? (payload.id_executant ? [payload.id_executant] : []) : undefined)
  const { id_executants: _idExecutants, ...payloadBase } = payload
  const payloadFinal = idExecutants === undefined ? payloadBase : { ...payloadBase, id_executant: idExecutants[0] || null }
  const { data, error } = await supabase
    .from('tache_chambre')
    .update(payloadFinal)
    .eq('id', id)
    .select(selectTacheChambre)
    .single<TacheChambre>()

  if (error) throw error
  if (idExecutants === undefined) return data
  return remplacerExecutantsTacheChambre(data.id, idExecutants)
}

export async function supprimerTacheChambre(id: string) {
  const { error } = await supabase.from('tache_chambre').delete().eq('id', id)
  if (error) throw error
}

export function idsExecutantsTacheChambre(tache: Pick<TacheChambre, 'id_executant' | 'executants'>) {
  const idsLiaison = tache.executants?.map((item) => item.id_executant).filter(Boolean) || []
  if (idsLiaison.length > 0) return Array.from(new Set(idsLiaison))
  return tache.id_executant ? [tache.id_executant] : []
}

export function libelleExecutantsTacheChambre(tache: Pick<TacheChambre, 'executant' | 'executants'>) {
  const noms = tache.executants?.map((item) => item.executant?.nom).filter(Boolean) || []
  if (noms.length > 0) return noms.join(', ')
  return tache.executant?.nom || 'Non affecte'
}

function normaliserPayloadTacheChambre(payload: TacheChambrePayload) {
  const idExecutants = Array.from(new Set(payload.id_executants ?? (payload.id_executant ? [payload.id_executant] : [])))
  return {
    ...payload,
    id_executant: idExecutants[0] || null,
    id_executants: idExecutants,
  }
}

async function remplacerExecutantsTacheChambre(idTacheChambre: string, idExecutants: string[]) {
  const { error: deleteError } = await supabase
    .from('tache_chambre_executant')
    .delete()
    .eq('id_tache_chambre', idTacheChambre)

  if (deleteError) throw deleteError

  if (idExecutants.length > 0) {
    const { error: insertError } = await supabase
      .from('tache_chambre_executant')
      .insert(idExecutants.map((idExecutant) => ({ id_tache_chambre: idTacheChambre, id_executant: idExecutant })))

    if (insertError) throw insertError
  }

  const { data, error } = await supabase
    .from('tache_chambre')
    .select(selectTacheChambre)
    .eq('id', idTacheChambre)
    .single<TacheChambre>()

  if (error) throw error
  return data
}

