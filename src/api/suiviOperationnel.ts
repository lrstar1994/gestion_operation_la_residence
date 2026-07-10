import { supabase } from '../lib/supabase'
import type { EtatMouvement, PlanningChambre } from './planningChambre'
import type { TacheChambre, TacheChambrePayload, UrgenceTacheChambre } from './tachesChambres'

export type HistoriqueEtatTacheChambre = {
  id: string
  id_tache_chambre: string
  ancien_id_etat: string | null
  nouveau_id_etat: string
  motif: string | null
  modifie_par: string | null
  created_at: string
  ancien_etat?: EtatMouvement | null
  nouveau_etat?: EtatMouvement | null
}

const selectSuiviTacheChambre =
  'id,id_planning_chambre,id_lieu,id_type_mouvement,date_mouvement,date_execution,date_limite,id_executant,id_etat,points,urgence,commentaire,motif_blocage,created_at,updated_at,' +
  'planning_chambre:id_planning_chambre(id,id_lieu,date,id_type_mouvement,id_executant,id_etat,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))),' +
  'lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),' +
  'type_mouvement(id,nom,points),' +
  'executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max)),' +
  'etat:etat_mouvement(id,nom)'

const selectHistoriqueTacheChambre =
  'id,id_tache_chambre,ancien_id_etat,nouveau_id_etat,motif,modifie_par,created_at,ancien_etat:etat_mouvement!historique_etat_tache_chambre_ancien_id_etat_fkey(id,nom),nouveau_etat:etat_mouvement!historique_etat_tache_chambre_nouveau_id_etat_fkey(id,nom)'

const selectPlanningChambreSuivi =
  'id,id_lieu,date,id_type_mouvement,id_executant,id_etat,motif_blocage,updated_at,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))'

export async function listerTachesChambresSuivi(date: string) {
  await synchroniserTachesChambresDepuisPlanning(date)

  const { data, error } = await supabase
    .from('tache_chambre')
    .select(selectSuiviTacheChambre)
    .eq('date_execution', date)
    .order('updated_at', { ascending: false })
    .returns<TacheChambre[]>()

  if (error) throw error
  return data
}

export async function synchroniserTachesChambresDepuisPlanning(date: string) {
  const { data: mouvements, error: mouvementsError } = await supabase
    .from('planning_chambre')
    .select(selectPlanningChambreSuivi)
    .eq('date', date)
    .returns<PlanningChambre[]>()

  if (mouvementsError) throw mouvementsError
  if (mouvements.length === 0) return []

  const idsMouvements = mouvements.map((mouvement) => mouvement.id)
  const { data: tachesExistantes, error: tachesError } = await supabase
    .from('tache_chambre')
    .select('id_planning_chambre')
    .in('id_planning_chambre', idsMouvements)
    .returns<Array<{ id_planning_chambre: string | null }>>()

  if (tachesError) throw tachesError

  const mouvementsDejaProgrammes = new Set(tachesExistantes.map((tache) => tache.id_planning_chambre).filter(Boolean))
  const payloads = mouvements
    .filter((mouvement) => !mouvementsDejaProgrammes.has(mouvement.id))
    .map<TacheChambrePayload>((mouvement) => ({
      id_planning_chambre: mouvement.id,
      id_lieu: mouvement.id_lieu,
      id_type_mouvement: mouvement.id_type_mouvement,
      date_mouvement: mouvement.date,
      date_execution: mouvement.date,
      date_limite: mouvement.date,
      id_executant: mouvement.id_executant || mouvement.lieu?.batiment?.id_executant_defaut || null,
      id_etat: mouvement.id_etat,
      points: mouvement.type_mouvement?.points || 0,
      urgence: urgenceDepuisDate(mouvement.date),
      commentaire: null,
      motif_blocage: mouvement.motif_blocage || null,
    }))

  if (payloads.length === 0) return []

  const { data, error } = await supabase
    .from('tache_chambre')
    .insert(payloads)
    .select(selectSuiviTacheChambre)
    .returns<TacheChambre[]>()

  if (error) throw error
  return data
}

export async function changerEtatTacheChambre(id: string, idEtat: string, motifBlocage: string | null) {
  const { data, error } = await supabase
    .from('tache_chambre')
    .update({ id_etat: idEtat, motif_blocage: motifBlocage })
    .eq('id', id)
    .select(selectSuiviTacheChambre)
    .single<TacheChambre>()

  if (error) throw error
  return data
}

export async function listerHistoriqueEtatTacheChambre(idTacheChambre: string) {
  const { data, error } = await supabase
    .from('historique_etat_tache_chambre')
    .select(selectHistoriqueTacheChambre)
    .eq('id_tache_chambre', idTacheChambre)
    .order('created_at', { ascending: false })
    .returns<HistoriqueEtatTacheChambre[]>()

  if (error) throw error
  return data
}

export async function compterTachesChambresBloquees(date: string) {
  await synchroniserTachesChambresDepuisPlanning(date)

  const { count, error } = await supabase
    .from('tache_chambre')
    .select('id,etat:etat_mouvement!inner(nom)', { count: 'exact', head: true })
    .eq('date_execution', date)
    .eq('etat.nom', 'BLOQUE')

  if (error) throw error
  return count || 0
}

export const listerMouvementsSuivi = listerTachesChambresSuivi
export const compterMouvementsBloques = compterTachesChambresBloquees

function urgenceDepuisDate(date: string): UrgenceTacheChambre {
  const aujourdHui = formatDateInput(new Date())
  return date <= aujourdHui ? 'haute' : 'normale'
}

function formatDateInput(date: Date) {
  const annee = date.getFullYear()
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}
