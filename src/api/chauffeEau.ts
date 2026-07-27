import { supabase } from '../lib/supabase'
import type { Lieu } from './lieux'
import type { PlanningChambre } from './planningChambre'

export type EtatChauffeEau = 'ON' | 'OFF'
export type TypeAnomalieChauffeEau = 'CRITIQUE_OFF_OCCUPE' | 'ENERGETIQUE_ON_VIDE' | 'CONTROLE_MANQUANT'
export type StatutAnomalieChauffeEau = 'a_faire' | 'en_cours' | 'terminee' | 'validee' | 'refusee' | 'reprise' | 'annulee'

export type ChauffeEau = {
  id: string
  code: string
  nom: string
  description: string | null
  est_actif: boolean
  created_at: string
  updated_at: string
}

export type ChauffeEauLieu = {
  id: string
  id_chauffe_eau: string
  id_lieu: string
  lieu?: Lieu | null
}

export type ChauffeEauReleve = {
  id: string
  id_chauffe_eau: string
  date_releve: string
  heure_demarrage: string | null
  temperature_debut: number | null
  heure_debranchement: string | null
  temperature_fin: number | null
  heure_controle_fin_matin: string | null
  temperature_fin_matin: number | null
  etat_constate: EtatChauffeEau
  etat_attendu: EtatChauffeEau
  conforme: boolean
  id_utilisateur: string | null
  commentaire: string | null
  created_at: string
  updated_at: string
}

export type ChauffeEauAnomalie = {
  id: string
  id_chauffe_eau: string
  id_releve: string | null
  date_anomalie: string
  type_anomalie: TypeAnomalieChauffeEau
  statut: StatutAnomalieChauffeEau
  message: string
  created_at: string
  updated_at: string
}

export type ControleChauffeEau = {
  chauffeEau: ChauffeEau
  chambres: Lieu[]
  chambresOccupees: Lieu[]
  chambresArrivee: Lieu[]
  chambresDepart: Lieu[]
  etatAttendu: EtatChauffeEau
  releve: ChauffeEauReleve | null
  anomalies: ChauffeEauAnomalie[]
  controleManquant: boolean
  conforme: boolean
  actionAFaire: string
}

export type ChauffeEauPayload = {
  code: string
  nom: string
  description: string | null
  est_actif: boolean
}

export type ReleveChauffeEauPayload = {
  id_chauffe_eau: string
  date_releve: string
  heure_demarrage: string | null
  temperature_debut: number | null
  heure_debranchement: string | null
  temperature_fin: number | null
  heure_controle_fin_matin: string | null
  temperature_fin_matin: number | null
  etat_constate: EtatChauffeEau
  etat_attendu: EtatChauffeEau
  conforme: boolean
  id_utilisateur: string | null
  commentaire: string | null
}

export type StatistiquesChauffeEau = {
  nonConformes: number
  allumesInutilement: number
  eteintsAlorsOccupe: number
  controlesManquants: number
}

const selectLieu = 'id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)'
const selectChauffeEau = 'id,code,nom,description,est_actif,created_at,updated_at'
const selectChauffeEauLieu = `id,id_chauffe_eau,id_lieu,lieu:lieux(${selectLieu})`
const selectReleve = 'id,id_chauffe_eau,date_releve,heure_demarrage,temperature_debut,heure_debranchement,temperature_fin,heure_controle_fin_matin,temperature_fin_matin,etat_constate,etat_attendu,conforme,id_utilisateur,commentaire,created_at,updated_at'
const selectAnomalie = 'id,id_chauffe_eau,id_releve,date_anomalie,type_anomalie,statut,message,created_at,updated_at'
const selectPlanning =
  'id,id_lieu,date,id_type_mouvement,id_executant,id_etat,lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),type_mouvement(id,nom,points),etat:etat_mouvement(id,nom),executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max))'

export async function listerControleChauffeEau(date: string) {
  const [chauffeEaux, liaisons, releves, anomalies, planning] = await Promise.all([
    listerChauffeEaux(),
    listerChauffeEauLiaisons(),
    listerRelevesChauffeEau(date),
    listerAnomaliesChauffeEau(date),
    listerPlanningOccupation(date),
  ])

  const relevesParChauffe = new Map(releves.map((releve) => [releve.id_chauffe_eau, releve]))
  const anomaliesParChauffe = grouperPar(anomalies, (anomalie) => anomalie.id_chauffe_eau)
  const planningParLieu = grouperPar(planning, (mouvement) => mouvement.id_lieu)

  return chauffeEaux
    .filter((item) => item.est_actif)
    .map<ControleChauffeEau>((chauffeEau) => {
      const chambres = liaisons.filter((liaison) => liaison.id_chauffe_eau === chauffeEau.id).map((liaison) => liaison.lieu).filter(Boolean) as Lieu[]
      const occupation = calculerOccupation(chambres, planningParLieu, date)
      const etatAttendu: EtatChauffeEau = occupation.chambresOccupees.length > 0 || occupation.chambresArrivee.length > 0 ? 'ON' : 'OFF'
      const releve = relevesParChauffe.get(chauffeEau.id) || null
      const anomaliesChauffe = anomaliesParChauffe.get(chauffeEau.id) || []
      const controleManquant = !releve
      const conforme = releve ? releve.etat_constate === etatAttendu : false

      return {
        chauffeEau,
        chambres,
        ...occupation,
        etatAttendu,
        releve,
        anomalies: anomaliesChauffe,
        controleManquant,
        conforme,
        actionAFaire: actionAFaire(etatAttendu, releve?.etat_constate || null, controleManquant),
      }
    })
}

export async function listerChauffeEaux() {
  const { data, error } = await supabase
    .from('chauffe_eau')
    .select(selectChauffeEau)
    .order('code', { ascending: true })
    .returns<ChauffeEau[]>()

  if (error) throw error
  return data
}

export async function enregistrerChauffeEau(payload: ChauffeEauPayload, id?: string) {
  const requete = id
    ? supabase.from('chauffe_eau').update(payload).eq('id', id)
    : supabase.from('chauffe_eau').insert(payload)

  const { data, error } = await requete
    .select(selectChauffeEau)
    .single<ChauffeEau>()

  if (error) throw error
  return data
}

export async function supprimerChauffeEau(id: string) {
  const { error } = await supabase.from('chauffe_eau').delete().eq('id', id)
  if (error) throw error
}

export async function listerChauffeEauLiaisons() {
  const { data, error } = await supabase
    .from('chauffe_eau_lieu')
    .select(selectChauffeEauLieu)
    .returns<ChauffeEauLieu[]>()

  if (error) throw error
  return data
}

export async function remplacerChambresChauffeEau(idChauffeEau: string, idsLieux: string[]) {
  const { error: suppressionError } = await supabase.from('chauffe_eau_lieu').delete().eq('id_chauffe_eau', idChauffeEau)
  if (suppressionError) throw suppressionError

  if (idsLieux.length === 0) return []

  const { data, error } = await supabase
    .from('chauffe_eau_lieu')
    .insert(idsLieux.map((idLieu) => ({ id_chauffe_eau: idChauffeEau, id_lieu: idLieu })))
    .select(selectChauffeEauLieu)
    .returns<ChauffeEauLieu[]>()

  if (error) throw error
  return data
}

export async function enregistrerReleveChauffeEau(payload: ReleveChauffeEauPayload) {
  const { data, error } = await supabase
    .from('chauffe_eau_releve')
    .upsert(payload, { onConflict: 'id_chauffe_eau,date_releve' })
    .select(selectReleve)
    .single<ChauffeEauReleve>()

  if (error) throw error

  await genererAnomalieDepuisReleve(data)
  return data
}

export async function listerRelevesChauffeEau(date: string) {
  const { data, error } = await supabase
    .from('chauffe_eau_releve')
    .select(selectReleve)
    .eq('date_releve', date)
    .returns<ChauffeEauReleve[]>()

  if (error) throw error
  return data
}

export async function listerAnomaliesChauffeEau(date: string) {
  const { data, error } = await supabase
    .from('chauffe_eau_anomalie')
    .select(selectAnomalie)
    .eq('date_anomalie', date)
    .neq('statut', 'annulee')
    .returns<ChauffeEauAnomalie[]>()

  if (error) throw error
  return data
}

export async function modifierStatutAnomalieChauffeEau(id: string, statut: StatutAnomalieChauffeEau) {
  const { data, error } = await supabase
    .from('chauffe_eau_anomalie')
    .update({ statut })
    .eq('id', id)
    .select(selectAnomalie)
    .single<ChauffeEauAnomalie>()

  if (error) throw error
  return data
}

export async function statistiquesChauffeEau(date: string): Promise<StatistiquesChauffeEau> {
  const controles = await listerControleChauffeEau(date)

  return {
    nonConformes: controles.filter((item) => item.releve && !item.conforme).length,
    allumesInutilement: controles.filter((item) => item.releve?.etat_constate === 'ON' && item.etatAttendu === 'OFF').length,
    eteintsAlorsOccupe: controles.filter((item) => item.releve?.etat_constate === 'OFF' && item.etatAttendu === 'ON').length,
    controlesManquants: controles.filter((item) => item.controleManquant).length,
  }
}

async function listerPlanningOccupation(date: string) {
  const dateDebut = ajouterJours(date, -365)
  const { data, error } = await supabase
    .from('planning_chambre')
    .select(selectPlanning)
    .gte('date', dateDebut)
    .lte('date', date)
    .order('date', { ascending: true })
    .returns<PlanningChambre[]>()

  if (error) throw error
  return data
}

async function genererAnomalieDepuisReleve(releve: ChauffeEauReleve) {
  if (releve.etat_constate === releve.etat_attendu) return

  const type: TypeAnomalieChauffeEau = releve.etat_attendu === 'ON' ? 'CRITIQUE_OFF_OCCUPE' : 'ENERGETIQUE_ON_VIDE'
  const message = releve.etat_attendu === 'ON'
    ? 'Chauffe-eau OFF alors qu’au moins une chambre concernée est occupée ou en arrivée.'
    : 'Chauffe-eau ON alors que toutes les chambres concernées sont vides.'

  const { error } = await supabase
    .from('chauffe_eau_anomalie')
    .upsert({
      id_chauffe_eau: releve.id_chauffe_eau,
      id_releve: releve.id,
      date_anomalie: releve.date_releve,
      type_anomalie: type,
      statut: 'a_faire',
      message,
    }, { onConflict: 'id_chauffe_eau,date_anomalie,type_anomalie' })

  if (error) throw error
}

function calculerOccupation(chambres: Lieu[], planningParLieu: Map<string, PlanningChambre[]>, date: string) {
  const chambresOccupees: Lieu[] = []
  const chambresArrivee: Lieu[] = []
  const chambresDepart: Lieu[] = []

  chambres.forEach((chambre) => {
    const mouvements = planningParLieu.get(chambre.id) || []
    const arriveeDuJour = mouvements.some((mouvement) => mouvement.date === date && estType(mouvement, 'ARRIVEE'))
    const departDuJour = mouvements.some((mouvement) => mouvement.date === date && estType(mouvement, 'DEPART'))

    if (arriveeDuJour) chambresArrivee.push(chambre)
    if (departDuJour) chambresDepart.push(chambre)

    const dernierMouvement = mouvements
      .filter((mouvement) => estType(mouvement, 'ARRIVEE') || estType(mouvement, 'DEPART'))
      .sort((a, b) => b.date.localeCompare(a.date))[0]

    if ((dernierMouvement && estType(dernierMouvement, 'ARRIVEE')) || arriveeDuJour) {
      chambresOccupees.push(chambre)
    }

    if (departDuJour && !arriveeDuJour) {
      const index = chambresOccupees.findIndex((item) => item.id === chambre.id)
      if (index >= 0) chambresOccupees.splice(index, 1)
    }
  })

  return { chambresOccupees, chambresArrivee, chambresDepart }
}

function actionAFaire(etatAttendu: EtatChauffeEau, etatConstate: EtatChauffeEau | null, controleManquant: boolean) {
  if (controleManquant) return 'Faire le releve du jour'
  if (etatConstate === etatAttendu) return 'Aucune action'
  return etatAttendu === 'ON' ? 'Allumer immediatement' : 'Eteindre pour eviter une consommation inutile'
}

function estType(mouvement: PlanningChambre, type: 'ARRIVEE' | 'DEPART') {
  return normaliserTexte(mouvement.type_mouvement?.nom || '').includes(type.toLowerCase())
}

function grouperPar<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>()
  items.forEach((item) => {
    const key = getKey(item)
    map.set(key, [...(map.get(key) || []), item])
  })
  return map
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
