import { supabase } from '../lib/supabase'

export type DomaineExecutant = {
  id: string
  nom: string
  capacite_max: number | null
}

export type Executant = {
  id: string
  nom: string
  id_domaine: string
  domaine?: DomaineExecutant | null
}

export type ExecutantPayload = {
  nom: string
  id_domaine: string
}

const selectDomaineExecutant = 'id,nom,capacite_max'
const selectExecutant = 'id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max)'

export async function listerDomainesExecutants() {
  const { data, error } = await supabase
    .from('domaine_executant')
    .select(selectDomaineExecutant)
    .order('nom', { ascending: true })
    .returns<DomaineExecutant[]>()

  if (error) {
    throw error
  }

  return data
}

export async function listerExecutants() {
  const { data, error } = await supabase
    .from('executant')
    .select(selectExecutant)
    .order('nom', { ascending: true })
    .returns<Executant[]>()

  if (error) {
    throw error
  }

  return data
}

export async function creerExecutant(payload: ExecutantPayload) {
  const { data, error } = await supabase
    .from('executant')
    .insert(payload)
    .select(selectExecutant)
    .single<Executant>()

  if (error) {
    throw error
  }

  return data
}

export async function modifierExecutant(id: string, payload: ExecutantPayload) {
  const { data, error } = await supabase
    .from('executant')
    .update(payload)
    .eq('id', id)
    .select(selectExecutant)
    .single<Executant>()

  if (error) {
    throw error
  }

  return data
}

export async function supprimerExecutant(id: string) {
  const { error } = await supabase.from('executant').delete().eq('id', id)

  if (error) {
    throw error
  }
}
