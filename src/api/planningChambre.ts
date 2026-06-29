import { supabase } from '../lib/supabase'
import type { Executant } from './executants'
import type { Lieu } from './lieux'
import type { TachePeriodiqueHistorique, TachePeriodiquePlanning } from './tachesPeriodiques'

export type TypeMouvement = {
  id: string
  nom: string
  points: number
}

export type EtatMouvement = {
  id: string
  nom: string
}

export type PlanningChambre = {
  id: string
  id_lieu: string
  date: string
  id_type_mouvement: string
  id_executant: string | null
  id_etat: string
  motif_blocage?: string | null
  updated_at?: string
  lieu?: Lieu | null
  type_mouvement?: TypeMouvement | null
  etat?: EtatMouvement | null
  executant?: Executant | null
}

export type PlanningChambrePayload = {
  id_lieu: string
  date: string
  id_type_mouvement: string
  id_executant: string | null
  id_etat: string
}

export type TemplatePlanningChambre = {
  id: string
  nom: string
  description: string | null
}

export type TemplatePlanningChambreItem = {
  id: string
  id_template: string
  id_lieu: string
  jour_semaine: number
  id_type_mouvement: string
  id_executant: string | null
  lieu?: Lieu | null
  type_mouvement?: TypeMouvement | null
  executant?: Executant | null
}

export type ChargeExecutant = {
  executant: Executant
  points: number
  capaciteMax: number | null
  taux: number | null
  surcharge: boolean
  disponible90: boolean
  pointsParDate: Array<{
    date: string
    points: number
    taux: number | null
    surcharge: boolean
    disponible90: boolean
  }>
}

export type ConflitPlanningChambre = {
  payload: PlanningChambrePayload
  existants: PlanningChambre[]
}

const selectTypeMouvement = 'id,nom,points'
const selectEtatMouvement = 'id,nom'
const selectPlanningChambre =
  'id,id_lieu,date,id_type_mouvement,id_executant,id_etat,motif_blocage,updated_at,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))'
const selectTemplate =
  'id,nom,description'
const selectTemplateItem =
  'id,id_template,id_lieu,jour_semaine,id_type_mouvement,id_executant,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))'

export async function listerTypesMouvement() {
  const { data, error } = await supabase
    .from('type_mouvement')
    .select(selectTypeMouvement)
    .order('nom', { ascending: true })
    .returns<TypeMouvement[]>()

  if (error) throw error
  return data
}

export async function creerTypeMouvement(payload: { nom: string; points: number }) {
  const { data, error } = await supabase
    .from('type_mouvement')
    .insert(payload)
    .select(selectTypeMouvement)
    .single<TypeMouvement>()

  if (error) throw error
  return data
}

export async function modifierTypeMouvement(id: string, payload: { nom: string; points: number }) {
  const { data, error } = await supabase
    .from('type_mouvement')
    .update(payload)
    .eq('id', id)
    .select(selectTypeMouvement)
    .single<TypeMouvement>()

  if (error) throw error
  return data
}

export async function supprimerTypeMouvement(id: string) {
  const { error } = await supabase.from('type_mouvement').delete().eq('id', id)
  if (error) throw error
}

export async function listerEtatsMouvement() {
  const { data, error } = await supabase
    .from('etat_mouvement')
    .select(selectEtatMouvement)
    .order('nom', { ascending: true })
    .returns<EtatMouvement[]>()

  if (error) throw error
  return data
}

export async function listerPlanningChambre(dateDebut: string, dateFin?: string) {
  let requete = supabase
    .from('planning_chambre')
    .select(selectPlanningChambre)
    .gte('date', dateDebut)

  if (dateFin) {
    requete = requete.lte('date', dateFin)
  }

  const { data, error } = await requete
    .order('date', { ascending: true })
    .returns<PlanningChambre[]>()

  if (error) throw error
  return data
}

export async function trouverMouvementsChambre(idLieu: string, date: string) {
  const { data, error } = await supabase
    .from('planning_chambre')
    .select(selectPlanningChambre)
    .eq('id_lieu', idLieu)
    .eq('date', date)
    .returns<PlanningChambre[]>()

  if (error) throw error
  return data
}

export async function creerMouvementChambre(payload: PlanningChambrePayload) {
  const { data, error } = await supabase
    .from('planning_chambre')
    .insert(payload)
    .select(selectPlanningChambre)
    .single<PlanningChambre>()

  if (error) throw error
  return data
}

export async function modifierMouvementChambre(id: string, payload: PlanningChambrePayload) {
  const { data, error } = await supabase
    .from('planning_chambre')
    .update(payload)
    .eq('id', id)
    .select(selectPlanningChambre)
    .single<PlanningChambre>()

  if (error) throw error
  return data
}

export async function supprimerMouvementChambre(id: string) {
  const { error } = await supabase.from('planning_chambre').delete().eq('id', id)
  if (error) throw error
}

export async function verifierConflitsPlanningChambre(payloads: PlanningChambrePayload[]) {
  if (payloads.length === 0) return [] as ConflitPlanningChambre[]

  const conditions = payloads
    .map((payload) => `and(id_lieu.eq.${payload.id_lieu},date.eq.${payload.date},id_type_mouvement.eq.${payload.id_type_mouvement})`)
    .join(',')

  const { data: existants, error } = await supabase
    .from('planning_chambre')
    .select(selectPlanningChambre)
    .or(conditions)
    .returns<PlanningChambre[]>()

  if (error) throw error

  const parCle = new Map<string, PlanningChambre[]>()
  existants.forEach((mouvement) => {
    const cle = cleMouvement(mouvement.id_lieu, mouvement.date, mouvement.id_type_mouvement)
    parCle.set(cle, [...(parCle.get(cle) || []), mouvement])
  })

  return payloads.reduce<ConflitPlanningChambre[]>((conflits, payload) => {
    const existantsPayload = parCle.get(cleMouvement(payload.id_lieu, payload.date, payload.id_type_mouvement))

    if (existantsPayload?.length) {
      conflits.push({ payload, existants: existantsPayload })
    }

    return conflits
  }, [])
}

export async function appliquerMouvementsLot(payloads: PlanningChambrePayload[], remplacer: boolean) {
  if (payloads.length === 0) {
    return { sauvegardes: [] as PlanningChambre[], conflits: [] as ConflitPlanningChambre[] }
  }

  if (remplacer) {
    const { data, error } = await supabase
      .from('planning_chambre')
      .upsert(payloads, { onConflict: 'id_lieu,date,id_type_mouvement' })
      .select(selectPlanningChambre)
      .returns<PlanningChambre[]>()

    if (error) throw error
    return { sauvegardes: data, conflits: [] as ConflitPlanningChambre[] }
  }

  const conflits = await verifierConflitsPlanningChambre(payloads)
  const clesEnConflit = new Set(conflits.map((conflit) => cleMouvement(conflit.payload.id_lieu, conflit.payload.date, conflit.payload.id_type_mouvement)))
  const aCreer: PlanningChambrePayload[] = []

  payloads.forEach((payload) => {
    if (clesEnConflit.has(cleMouvement(payload.id_lieu, payload.date, payload.id_type_mouvement))) return

    aCreer.push(payload)
  })

  if (aCreer.length === 0) {
    return { sauvegardes: [] as PlanningChambre[], conflits }
  }

  const { data, error } = await supabase
    .from('planning_chambre')
    .insert(aCreer)
    .select(selectPlanningChambre)
    .returns<PlanningChambre[]>()

  if (error) throw error
  return { sauvegardes: data, conflits }
}

export async function listerTemplatesPlanningChambre() {
  const { data, error } = await supabase
    .from('template_planning_chambre')
    .select(selectTemplate)
    .order('nom', { ascending: true })
    .returns<TemplatePlanningChambre[]>()

  if (error) throw error
  return data
}

export async function creerTemplatePlanningChambre(payload: { nom: string; description: string | null }) {
  const { data, error } = await supabase
    .from('template_planning_chambre')
    .insert(payload)
    .select(selectTemplate)
    .single<TemplatePlanningChambre>()

  if (error) throw error
  return data
}

export async function supprimerTemplatePlanningChambre(id: string) {
  const { error } = await supabase.from('template_planning_chambre').delete().eq('id', id)
  if (error) throw error
}

export async function listerItemsTemplatePlanningChambre(idTemplate: string) {
  const { data, error } = await supabase
    .from('template_planning_chambre_item')
    .select(selectTemplateItem)
    .eq('id_template', idTemplate)
    .returns<TemplatePlanningChambreItem[]>()

  if (error) throw error
  return data
}

export async function remplacerItemsTemplatePlanningChambre(
  idTemplate: string,
  items: Array<Omit<TemplatePlanningChambreItem, 'id' | 'lieu' | 'type_mouvement' | 'executant'>>,
) {
  const { error: deleteError } = await supabase.from('template_planning_chambre_item').delete().eq('id_template', idTemplate)
  if (deleteError) throw deleteError

  if (items.length === 0) return []

  const { data, error } = await supabase
    .from('template_planning_chambre_item')
    .insert(items)
    .select(selectTemplateItem)
    .returns<TemplatePlanningChambreItem[]>()

  if (error) throw error
  return data
}

export function calculerCharges(
  planning: PlanningChambre[],
  executants: Executant[],
  planningTaches: TachePeriodiquePlanning[] = [],
  historiqueTaches: TachePeriodiqueHistorique[] = [],
) {
  return executants.map<ChargeExecutant>((executant) => {
    const mouvementsExecutant = planning
      .filter((mouvement) => mouvement.id_executant === executant.id)
    const tachesExecutant = planningTaches
      .filter((tache) => tache.id_executant === executant.id && tache.est_actif && !tache.date_realisation && tache.etat?.nom !== 'ANNULEE')
    const tachesRealiseesExecutant = historiqueTaches
      .filter((tache) => tache.id_executant === executant.id)
    const capaciteMax = executant.domaine?.capacite_max ?? null
    const pointsParDateMap = new Map<string, number>()

    mouvementsExecutant.forEach((mouvement) => {
      pointsParDateMap.set(mouvement.date, (pointsParDateMap.get(mouvement.date) || 0) + (mouvement.type_mouvement?.points || 0))
    })

    tachesExecutant.forEach((tache) => {
      pointsParDateMap.set(tache.date_echeance, (pointsParDateMap.get(tache.date_echeance) || 0) + (tache.tache?.points_estimes || 0))
    })

    tachesRealiseesExecutant.forEach((tache) => {
      pointsParDateMap.set(tache.date_realisation, (pointsParDateMap.get(tache.date_realisation) || 0) + (tache.tache?.points_estimes || 0))
    })

    const pointsParDate = Array.from(pointsParDateMap.entries())
      .map(([date, points]) => {
        const taux = capaciteMax ? points / capaciteMax : null

        return {
          date,
          points,
          taux,
          surcharge: capaciteMax !== null && points > capaciteMax,
          disponible90: capaciteMax === null || points < capaciteMax * 0.9,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
    const pic = pointsParDate.reduce((max, item) => Math.max(max, item.points), 0)
    const taux = capaciteMax ? pic / capaciteMax : null

    return {
      executant,
      points: pic,
      capaciteMax,
      taux,
      surcharge: pointsParDate.some((item) => item.surcharge),
      disponible90: capaciteMax === null || pointsParDate.every((item) => item.disponible90),
      pointsParDate,
    }
  })
}

export function cleMouvement(idLieu: string, date: string, idTypeMouvement: string) {
  return `${idLieu}-${date}-${idTypeMouvement}`
}
