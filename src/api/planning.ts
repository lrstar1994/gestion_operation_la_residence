import { supabase } from '../lib/supabase'

export type TypePlanning = {
  id: string
  nom: string
  couleur: string
}

export type PlanningExecutant = {
  id: string
  id_executant: string
  id_type_planning: string
  date: string
  heure_debut: string | null
  heure_fin: string | null
  type_planning?: TypePlanning | null
}

export type PlanningPayload = {
  id_executant: string
  id_type_planning: string
  date: string
  heure_debut: string | null
  heure_fin: string | null
}

export type ConflitPlanning = {
  payload: PlanningPayload
  existant: PlanningExecutant
}

const selectTypePlanning = 'id,nom,couleur'
const selectPlanning = 'id,id_executant,id_type_planning,date,heure_debut,heure_fin,type_planning(id,nom,couleur)'

export async function listerTypesPlanning() {
  const { data, error } = await supabase
    .from('type_planning')
    .select(selectTypePlanning)
    .order('nom', { ascending: true })
    .returns<TypePlanning[]>()

  if (error) {
    throw error
  }

  return data
}

export async function listerPlanning(dateDebut: string, dateFin?: string) {
  let requete = supabase
    .from('planning_executant')
    .select(selectPlanning)
    .gte('date', dateDebut)

  if (dateFin) {
    requete = requete.lte('date', dateFin)
  }

  const { data, error } = await requete
    .order('date', { ascending: true })
    .returns<PlanningExecutant[]>()

  if (error) {
    throw error
  }

  return data
}

export async function trouverPlanningExistant(idExecutant: string, date: string) {
  const { data, error } = await supabase
    .from('planning_executant')
    .select(selectPlanning)
    .eq('id_executant', idExecutant)
    .eq('date', date)
    .maybeSingle<PlanningExecutant>()

  if (error) {
    throw error
  }

  return data
}

export async function creerPlanning(payload: PlanningPayload) {
  const { data, error } = await supabase
    .from('planning_executant')
    .insert(payload)
    .select(selectPlanning)
    .single<PlanningExecutant>()

  if (error) {
    throw error
  }

  return data
}

export async function remplacerPlanning(payload: PlanningPayload) {
  const { data, error } = await supabase
    .from('planning_executant')
    .upsert(payload, { onConflict: 'id_executant,date' })
    .select(selectPlanning)
    .single<PlanningExecutant>()

  if (error) {
    throw error
  }

  return data
}

export async function appliquerPlanningLot(payloads: PlanningPayload[], remplacer: boolean) {
  if (payloads.length === 0) {
    return { sauvegardes: [] as PlanningExecutant[], conflits: [] as ConflitPlanning[] }
  }

  if (remplacer) {
    const { data, error } = await supabase
      .from('planning_executant')
      .upsert(payloads, { onConflict: 'id_executant,date' })
      .select(selectPlanning)
      .returns<PlanningExecutant[]>()

    if (error) {
      throw error
    }

    return { sauvegardes: data, conflits: [] as ConflitPlanning[] }
  }

  const combinaisons = payloads.map((payload) => ({
    id_executant: payload.id_executant,
    date: payload.date,
  }))

  const { data: existants, error: erreurExistants } = await supabase
    .from('planning_executant')
    .select(selectPlanning)
    .or(combinaisons.map((item) => `and(id_executant.eq.${item.id_executant},date.eq.${item.date})`).join(','))
    .returns<PlanningExecutant[]>()

  if (erreurExistants) {
    throw erreurExistants
  }

  const cleExistants = new Map(existants.map((planning) => [`${planning.id_executant}-${planning.date}`, planning]))
  const conflits: ConflitPlanning[] = []
  const aCreer: PlanningPayload[] = []

  payloads.forEach((payload) => {
    const existant = cleExistants.get(`${payload.id_executant}-${payload.date}`)

    if (existant) {
      conflits.push({ payload, existant })
      return
    }

    aCreer.push(payload)
  })

  if (aCreer.length === 0) {
    return { sauvegardes: [] as PlanningExecutant[], conflits }
  }

  const { data, error } = await supabase
    .from('planning_executant')
    .insert(aCreer)
    .select(selectPlanning)
    .returns<PlanningExecutant[]>()

  if (error) {
    throw error
  }

  return { sauvegardes: data, conflits }
}
