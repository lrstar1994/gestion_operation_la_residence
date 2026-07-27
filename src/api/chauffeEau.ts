import { supabase } from '../lib/supabase'
import type { Lieu } from './lieux'
import type { PlanningChambre } from './planningChambre'

export type TypeActionChauffeEau = 'ALLUMER' | 'ETEINDRE'
export type EtatActionChauffeEau = 'A_FAIRE' | 'TERMINE' | 'BLOQUE'

export type ChauffeEauAction = {
  id: string
  id_lieu: string
  id_planning_chambre: string | null
  date_action: string
  type_action: TypeActionChauffeEau
  etat: EtatActionChauffeEau
  commentaire: string | null
  est_actif: boolean
  created_at: string
  updated_at: string
  lieu?: Lieu | null
  planning_chambre?: PlanningChambre | null
}

export type ChauffeEauActionPayload = {
  id_lieu: string
  id_planning_chambre: string | null
  date_action: string
  type_action: TypeActionChauffeEau
  etat: EtatActionChauffeEau
  commentaire: string | null
  est_actif?: boolean
}

const selectChauffeEau =
  'id,id_lieu,id_planning_chambre,date_action,type_action,etat,commentaire,est_actif,created_at,updated_at,' +
  'lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),' +
  'planning_chambre:id_planning_chambre(id,id_lieu,date,id_type_mouvement,id_executant,id_etat,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max)))'

const selectPlanningChambre =
  'id,id_lieu,date,id_type_mouvement,id_executant,id_etat,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))'

export async function listerActionsChauffeEau(date: string) {
  await synchroniserActionsChauffeEau(date)

  const { data, error } = await supabase
    .from('chauffe_eau_action')
    .select(selectChauffeEau)
    .eq('date_action', date)
    .eq('est_actif', true)
    .order('etat', { ascending: true })
    .order('type_action', { ascending: true })
    .returns<ChauffeEauAction[]>()

  if (error) throw error
  return data
}

export async function modifierActionChauffeEau(id: string, payload: Partial<ChauffeEauActionPayload>) {
  const { data, error } = await supabase
    .from('chauffe_eau_action')
    .update(payload)
    .eq('id', id)
    .select(selectChauffeEau)
    .single<ChauffeEauAction>()

  if (error) throw error
  return data
}

export async function synchroniserActionsChauffeEau(date: string) {
  const demain = ajouterJours(date, 1)
  const [departs, arrivees] = await Promise.all([
    listerMouvementsPourChauffeEau(date, 'DEPART'),
    listerMouvementsPourChauffeEau(demain, 'ARRIVEE'),
  ])

  const payloads: ChauffeEauActionPayload[] = [
    ...departs.map((mouvement) => payloadDepuisMouvement(mouvement, date, 'ETEINDRE')),
    ...arrivees.map((mouvement) => payloadDepuisMouvement(mouvement, date, 'ALLUMER')),
  ]

  if (payloads.length === 0) return []

  const conditions = payloads
    .map((payload) => `and(id_lieu.eq.${payload.id_lieu},date_action.eq.${payload.date_action},type_action.eq.${payload.type_action})`)
    .join(',')

  const { data: existantes, error: existantesError } = await supabase
    .from('chauffe_eau_action')
    .select('id_lieu,date_action,type_action')
    .or(conditions)
    .returns<Array<{ id_lieu: string; date_action: string; type_action: TypeActionChauffeEau }>>()

  if (existantesError) throw existantesError

  const clesExistantes = new Set(existantes.map((action) => cleAction(action.id_lieu, action.date_action, action.type_action)))
  const aCreer = payloads.filter((payload) => !clesExistantes.has(cleAction(payload.id_lieu, payload.date_action, payload.type_action)))

  if (aCreer.length === 0) return []

  const { data, error } = await supabase
    .from('chauffe_eau_action')
    .insert(aCreer)
    .select(selectChauffeEau)
    .returns<ChauffeEauAction[]>()

  if (error) throw error
  return data
}

async function listerMouvementsPourChauffeEau(date: string, type: 'DEPART' | 'ARRIVEE') {
  const { data, error } = await supabase
    .from('planning_chambre')
    .select(selectPlanningChambre)
    .eq('date', date)
    .returns<PlanningChambre[]>()

  if (error) throw error
  return data.filter((mouvement) => normaliserTexte(mouvement.type_mouvement?.nom || '').includes(type.toLowerCase()))
}

function payloadDepuisMouvement(mouvement: PlanningChambre, dateAction: string, typeAction: TypeActionChauffeEau): ChauffeEauActionPayload {
  return {
    id_lieu: mouvement.id_lieu,
    id_planning_chambre: mouvement.id,
    date_action: dateAction,
    type_action: typeAction,
    etat: 'A_FAIRE',
    commentaire: null,
    est_actif: true,
  }
}

function cleAction(idLieu: string, dateAction: string, typeAction: TypeActionChauffeEau) {
  return `${idLieu}-${dateAction}-${typeAction}`
}

function ajouterJours(date: string, jours: number) {
  const valeur = new Date(`${date}T00:00:00`)
  valeur.setDate(valeur.getDate() + jours)
  return formatDateInput(valeur)
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}

function normaliserTexte(valeur: string) {
  return valeur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
