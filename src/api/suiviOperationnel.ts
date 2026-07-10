import { supabase } from '../lib/supabase'
import type { EtatMouvement } from './planningChambre'
import type { TacheChambre } from './tachesChambres'

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

export async function listerTachesChambresSuivi(date: string) {
  const { data, error } = await supabase
    .from('tache_chambre')
    .select(selectSuiviTacheChambre)
    .eq('date_execution', date)
    .order('updated_at', { ascending: false })
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
