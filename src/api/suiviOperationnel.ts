import { supabase } from '../lib/supabase'
import type { EtatMouvement, PlanningChambre } from './planningChambre'

export type HistoriqueEtatMouvement = {
  id: string
  id_planning_chambre: string
  ancien_id_etat: string | null
  nouveau_id_etat: string
  motif: string | null
  modifie_par: string | null
  created_at: string
  ancien_etat?: EtatMouvement | null
  nouveau_etat?: EtatMouvement | null
}

const selectSuivi =
  'id,id_lieu,date,id_type_mouvement,id_executant,id_etat,motif_blocage,updated_at,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))'

const selectHistorique =
  'id,id_planning_chambre,ancien_id_etat,nouveau_id_etat,motif,modifie_par,created_at,ancien_etat:etat_mouvement!historique_etat_mouvement_ancien_id_etat_fkey(id,nom),nouveau_etat:etat_mouvement!historique_etat_mouvement_nouveau_id_etat_fkey(id,nom)'

export async function listerMouvementsSuivi(date: string) {
  const { data, error } = await supabase
    .from('planning_chambre')
    .select(selectSuivi)
    .eq('date', date)
    .order('updated_at', { ascending: false })
    .returns<PlanningChambre[]>()

  if (error) throw error
  return data
}

export async function changerEtatMouvement(id: string, idEtat: string, motifBlocage: string | null) {
  const { data, error } = await supabase
    .from('planning_chambre')
    .update({ id_etat: idEtat, motif_blocage: motifBlocage })
    .eq('id', id)
    .select(selectSuivi)
    .single<PlanningChambre>()

  if (error) throw error
  return data
}

export async function listerHistoriqueEtatMouvement(idPlanningChambre: string) {
  const { data, error } = await supabase
    .from('historique_etat_mouvement')
    .select(selectHistorique)
    .eq('id_planning_chambre', idPlanningChambre)
    .order('created_at', { ascending: false })
    .returns<HistoriqueEtatMouvement[]>()

  if (error) throw error
  return data
}

export async function compterMouvementsBloques(date: string) {
  const { count, error } = await supabase
    .from('planning_chambre')
    .select('id,etat:etat_mouvement!inner(nom)', { count: 'exact', head: true })
    .eq('date', date)
    .eq('etat.nom', 'BLOQUE')

  if (error) throw error
  return count || 0
}
