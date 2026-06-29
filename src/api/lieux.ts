import { supabase } from '../lib/supabase'

export type Batiment = {
  id: string
  code: string
  nom: string
  id_executant_defaut: string | null
  executant_defaut?: {
    id: string
    nom: string
  } | null
}

export type CategorieLieu = {
  id: string
  code: string
  nom: string
}

export type Lieu = {
  id: string
  nom: string
  code: string | null
  id_batiment: string | null
  id_categorie: string
  numero: string | null
  est_actif: boolean
  batiment?: Batiment | null
  categorie?: CategorieLieu | null
}

export type BatimentPayload = {
  code: string
  nom: string
  id_executant_defaut: string | null
}

export type CategorieLieuPayload = {
  code: string
  nom: string
}

export type LieuPayload = {
  nom: string
  code: string | null
  id_batiment: string | null
  id_categorie: string
  numero: string | null
  est_actif: boolean
}

const selectBatiment = 'id,code,nom,id_executant_defaut,executant_defaut:executant(id,nom)'
const selectCategorie = 'id,code,nom'
const selectLieu = 'id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)'

export function estLieuChambre(lieu: Pick<Lieu, 'categorie'>) {
  const code = lieu.categorie?.code?.trim().toLowerCase() || ''
  const nom = lieu.categorie?.nom?.trim().toLowerCase() || ''

  return ['chambre', 'chambres'].includes(code) || nom.includes('chambre')
}

export async function listerBatiments() {
  const { data, error } = await supabase
    .from('batiments')
    .select(selectBatiment)
    .order('code', { ascending: true })
    .returns<Batiment[]>()

  if (error) {
    throw error
  }

  return data
}

export async function creerBatiment(payload: BatimentPayload) {
  const { data, error } = await supabase
    .from('batiments')
    .insert(payload)
    .select(selectBatiment)
    .single<Batiment>()

  if (error) {
    throw error
  }

  return data
}

export async function modifierBatiment(id: string, payload: BatimentPayload) {
  const { data, error } = await supabase
    .from('batiments')
    .update(payload)
    .eq('id', id)
    .select(selectBatiment)
    .single<Batiment>()

  if (error) {
    throw error
  }

  return data
}

export async function supprimerBatiment(id: string) {
  const { error } = await supabase.from('batiments').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function listerCategoriesLieu() {
  const { data, error } = await supabase
    .from('categories_lieu')
    .select(selectCategorie)
    .order('nom', { ascending: true })
    .returns<CategorieLieu[]>()

  if (error) {
    throw error
  }

  return data
}

export async function creerCategorieLieu(payload: CategorieLieuPayload) {
  const { data, error } = await supabase
    .from('categories_lieu')
    .insert(payload)
    .select(selectCategorie)
    .single<CategorieLieu>()

  if (error) {
    throw error
  }

  return data
}

export async function modifierCategorieLieu(id: string, payload: CategorieLieuPayload) {
  const { data, error } = await supabase
    .from('categories_lieu')
    .update(payload)
    .eq('id', id)
    .select(selectCategorie)
    .single<CategorieLieu>()

  if (error) {
    throw error
  }

  return data
}

export async function supprimerCategorieLieu(id: string) {
  const { error } = await supabase.from('categories_lieu').delete().eq('id', id)

  if (error) {
    throw error
  }
}

export async function listerLieux() {
  const { data, error } = await supabase
    .from('lieux')
    .select(selectLieu)
    .order('nom', { ascending: true })
    .returns<Lieu[]>()

  if (error) {
    throw error
  }

  return data
}

export async function creerLieu(payload: LieuPayload) {
  const { data, error } = await supabase
    .from('lieux')
    .insert(payload)
    .select(selectLieu)
    .single<Lieu>()

  if (error) {
    throw error
  }

  return data
}

export async function modifierLieu(id: string, payload: LieuPayload) {
  const { data, error } = await supabase
    .from('lieux')
    .update(payload)
    .eq('id', id)
    .select(selectLieu)
    .single<Lieu>()

  if (error) {
    throw error
  }

  return data
}

export async function supprimerLieu(id: string) {
  const { error } = await supabase.from('lieux').delete().eq('id', id)

  if (error) {
    throw error
  }
}
