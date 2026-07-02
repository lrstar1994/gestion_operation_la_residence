import { supabase } from '../lib/supabase'
import type { Executant } from './executants'
import type { Lieu } from './lieux'
import type { EtatMouvement } from './planningChambre'

export type PrioriteIntervention = 'basse' | 'normale' | 'urgente'
export type TypePhotoIntervention = 'avant' | 'apres' | 'progression' | 'anomalie' | 'detail'

export type PhotoIntervention = {
  id: string
  id_intervention: string
  url_storage: string
  nom_fichier: string
  type_photo: TypePhotoIntervention
  commentaire: string | null
  created_at: string
}

export type CommentaireIntervention = {
  id: string
  id_intervention: string
  id_utilisateur: string | null
  commentaire: string
  created_at: string
  utilisateur?: {
    id: string
    nom: string
    email: string
  } | null
}

export type InterventionMaintenance = {
  id: string
  titre: string
  description: string | null
  travail_a_faire: string | null
  id_lieu: string
  date_intervention: string
  heure_debut: string | null
  date_fin: string | null
  heure_fin: string | null
  priorite: PrioriteIntervention
  id_executant: string | null
  id_etat: string
  commentaire_fermeture: string | null
  date_fermeture: string | null
  est_actif: boolean
  created_at: string
  updated_at: string
  lieu?: Lieu | null
  executant?: Executant | null
  etat?: EtatMouvement | null
  photos?: PhotoIntervention[]
  commentaires?: CommentaireIntervention[]
}

export type InterventionPayload = {
  titre: string
  description: string | null
  travail_a_faire: string | null
  id_lieu: string
  date_intervention: string
  heure_debut: string | null
  date_fin: string | null
  heure_fin: string | null
  priorite: PrioriteIntervention
  id_executant: string | null
  id_etat: string
  commentaire_fermeture?: string | null
  date_fermeture?: string | null
  est_actif: boolean
}

export type PhotoPayload = {
  id_intervention: string
  url_storage: string
  nom_fichier: string
  type_photo: TypePhotoIntervention
  commentaire: string | null
}

const bucketInterventions = 'interventions'
const selectPhoto = 'id,id_intervention,url_storage,nom_fichier,type_photo,commentaire,created_at'
const selectCommentaire = 'id,id_intervention,id_utilisateur,commentaire,created_at,utilisateur:utilisateurs(id,nom,email)'
const selectIntervention =
  `id,titre,description,travail_a_faire,id_lieu,date_intervention,heure_debut,date_fin,heure_fin,priorite,id_executant,id_etat,commentaire_fermeture,date_fermeture,est_actif,created_at,updated_at,` +
  `lieu:lieux(id,nom,code,id_batiment,id_categorie,numero,est_actif,batiment:batiments(id,code,nom,id_executant_defaut),categorie:categories_lieu(id,code,nom)),` +
  `executant:executant(id,nom,id_domaine,domaine:domaine_executant(id,nom,capacite_max)),` +
  `etat:etat_mouvement(id,nom),photos:photo_intervention(${selectPhoto}),commentaires:commentaire_intervention(${selectCommentaire})`

export async function listerInterventionsMaintenance() {
  const { data, error } = await supabase
    .from('intervention_maintenance')
    .select(selectIntervention)
    .eq('est_actif', true)
    .order('date_intervention', { ascending: false })
    .returns<InterventionMaintenance[]>()

  if (error) throw error
  return normaliserInterventions(data)
}

export async function creerInterventionMaintenance(payload: InterventionPayload) {
  const { data, error } = await supabase
    .from('intervention_maintenance')
    .insert(payload)
    .select(selectIntervention)
    .single<InterventionMaintenance>()

  if (error) throw error
  return normaliserIntervention(data)
}

export async function modifierInterventionMaintenance(id: string, payload: Partial<InterventionPayload>) {
  const { data, error } = await supabase
    .from('intervention_maintenance')
    .update(payload)
    .eq('id', id)
    .select(selectIntervention)
    .single<InterventionMaintenance>()

  if (error) throw error
  return normaliserIntervention(data)
}

export async function supprimerInterventionMaintenance(id: string) {
  const { data: photos, error: photosError } = await supabase
    .from('photo_intervention')
    .select(selectPhoto)
    .eq('id_intervention', id)
    .returns<PhotoIntervention[]>()

  if (photosError) throw photosError

  if (photos.length > 0) {
    await supabase.storage.from(bucketInterventions).remove(photos.map((photo) => photo.url_storage))
  }

  const { error } = await supabase.from('intervention_maintenance').delete().eq('id', id)
  if (error) throw error
}

export async function ajouterCommentaireIntervention(idIntervention: string, commentaire: string) {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('commentaire_intervention')
    .insert({
      id_intervention: idIntervention,
      id_utilisateur: userData.user?.id ?? null,
      commentaire,
    })
    .select(selectCommentaire)
    .single<CommentaireIntervention>()

  if (error) throw error
  return data
}

export async function ajouterPhotoIntervention(payload: PhotoPayload) {
  const { data, error } = await supabase
    .from('photo_intervention')
    .insert(payload)
    .select(selectPhoto)
    .single<PhotoIntervention>()

  if (error) throw error
  return data
}

export async function supprimerPhotoIntervention(photo: PhotoIntervention) {
  await supabase.storage.from(bucketInterventions).remove([photo.url_storage])

  const { error } = await supabase
    .from('photo_intervention')
    .delete()
    .eq('id', photo.id)

  if (error) throw error
}

export async function uploadPhotosIntervention(
  idIntervention: string,
  typePhoto: TypePhotoIntervention,
  fichiers: File[],
  commentaire: string | null,
) {
  const photos: PhotoIntervention[] = []

  for (const fichier of fichiers) {
    const compresse = await compresserImage(fichier)
    const nomFichier = `${crypto.randomUUID()}_${nettoyerNomFichier(fichier.name).replace(/\.[^.]+$/, '')}_compressed.jpg`
    const chemin = `${idIntervention}/${typePhoto}/${nomFichier}`
    const { error: uploadError } = await supabase.storage
      .from(bucketInterventions)
      .upload(chemin, compresse, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (uploadError) throw uploadError

    photos.push(await ajouterPhotoIntervention({
      id_intervention: idIntervention,
      url_storage: chemin,
      nom_fichier: nomFichier,
      type_photo: typePhoto,
      commentaire,
    }))
  }

  return photos
}

export function urlPubliquePhoto(chemin: string) {
  return supabase.storage.from(bucketInterventions).getPublicUrl(chemin).data.publicUrl
}

export function compterPhotosParType(photos: PhotoIntervention[] | undefined) {
  const compte: Record<TypePhotoIntervention, number> = {
    avant: 0,
    apres: 0,
    progression: 0,
    anomalie: 0,
    detail: 0,
  }

  photos?.forEach((photo) => {
    compte[photo.type_photo] += 1
  })

  return compte
}

async function compresserImage(fichier: File) {
  if (!fichier.type.startsWith('image/')) {
    throw new Error('Seules les images sont acceptees.')
  }

  const image = await chargerImage(fichier)
  const maxDimension = 1600
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const largeur = Math.max(1, Math.round(image.width * ratio))
  const hauteur = Math.max(1, Math.round(image.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const contexte = canvas.getContext('2d')

  if (!contexte) {
    throw new Error("Compression d'image impossible.")
  }

  contexte.drawImage(image, 0, 0, largeur, hauteur)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Compression d'image impossible."))
      else resolve(blob)
    }, 'image/jpeg', 0.76)
  })
}

function chargerImage(fichier: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(fichier)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image illisible.'))
    }
    image.src = url
  })
}

function nettoyerNomFichier(nom: string) {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function normaliserInterventions(interventions: InterventionMaintenance[]) {
  return interventions.map(normaliserIntervention)
}

function normaliserIntervention(intervention: InterventionMaintenance) {
  return {
    ...intervention,
    photos: [...(intervention.photos || [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    commentaires: [...(intervention.commentaires || [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }
}
