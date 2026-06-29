import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export const DOMAINES = ['maintenance', 'chambres', 'salles'] as const
export const ROLES = ['admin', 'coordinateur'] as const

export type DomaineOperation = (typeof DOMAINES)[number]
export type RoleUtilisateur = (typeof ROLES)[number]

export type ProfilUtilisateur = {
  id: string
  email: string
  nom: string
  role: RoleUtilisateur
  domaines_autorises: DomaineOperation[]
  statut: number
}

export type ConnexionResultat = {
  session: Session
  user: User
  profil: ProfilUtilisateur
}

const selectUtilisateur = 'id,email,nom,role,domaines_autorises,statut'

export async function inscrireUtilisateur({
  nom,
  email,
  motDePasse,
}: {
  nom: string
  email: string
  motDePasse: string
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      data: { nom },
    },
  })

  if (error) {
    throw error
  }

  await supabase.auth.signOut()

  return data
}

export async function connecterUtilisateur({
  email,
  motDePasse,
}: {
  email: string
  motDePasse: string
}): Promise<ConnexionResultat> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse,
  })

  if (error) {
    throw error
  }

  if (!data.session || !data.user) {
    throw new Error('Connexion impossible.')
  }

  const profil = await recupererProfil(data.user.id)

  if (!profil) {
    await supabase.auth.signOut()
    throw new Error('Profil utilisateur introuvable.')
  }

  if (profil.statut !== 1) {
    await supabase.auth.signOut()
    throw new Error("Votre compte est en attente de validation par l'admin.")
  }

  return {
    session: data.session,
    user: data.user,
    profil,
  }
}

export async function deconnecterUtilisateur() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function recupererSession() {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export async function recupererProfil(userId: string) {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select(selectUtilisateur)
    .eq('id', userId)
    .maybeSingle<ProfilUtilisateur>()

  if (error) {
    throw error
  }

  return data
}

export async function listerUtilisateurs() {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select(selectUtilisateur)
    .order('nom', { ascending: true })
    .returns<ProfilUtilisateur[]>()

  if (error) {
    throw error
  }

  return data
}

export async function mettreAJourUtilisateur(
  id: string,
  valeurs: Partial<Pick<ProfilUtilisateur, 'role' | 'domaines_autorises' | 'statut'>>,
) {
  const updates = {
    ...valeurs,
    domaines_autorises: valeurs.role === 'admin' ? [] : valeurs.domaines_autorises,
  }

  const { data, error } = await supabase
    .from('utilisateurs')
    .update(updates)
    .eq('id', id)
    .select(selectUtilisateur)
    .single<ProfilUtilisateur>()

  if (error) {
    throw error
  }

  return data
}

export async function supprimerUtilisateur(id: string) {
  const { error } = await supabase.from('utilisateurs').delete().eq('id', id)

  if (error) {
    throw error
  }
}
