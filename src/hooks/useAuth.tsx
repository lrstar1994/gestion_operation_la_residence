import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import {
  connecterUtilisateur,
  deconnecterUtilisateur,
  recupererProfil,
  recupererSession,
  type DomaineOperation,
  type ProfilUtilisateur,
} from '../api/auth'
import { supabase } from '../lib/supabase'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profil: ProfilUtilisateur | null
  chargement: boolean
  connecter: (email: string, motDePasse: string) => Promise<void>
  deconnecter: () => Promise<void>
  rafraichirProfil: () => Promise<void>
  estAdmin: () => boolean
  peutAccederAuDomaine: (domaine: DomaineOperation) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profil, setProfil] = useState<ProfilUtilisateur | null>(null)
  const [chargement, setChargement] = useState(true)

  const chargerProfil = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfil(null)
      return
    }

    const profilUtilisateur = await recupererProfil(userId)
    setProfil(profilUtilisateur)
  }, [])

  const rafraichirProfil = useCallback(async () => {
    await chargerProfil(user?.id)
  }, [chargerProfil, user?.id])

  useEffect(() => {
    let actif = true

    async function initialiserAuth() {
      try {
        const sessionInitiale = await recupererSession()

        if (!actif) {
          return
        }

        setSession(sessionInitiale)
        setUser(sessionInitiale?.user ?? null)
        await chargerProfil(sessionInitiale?.user.id)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Session impossible a charger.')
      } finally {
        if (actif) {
          setChargement(false)
        }
      }
    }

    void initialiserAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nouvelleSession) => {
      setSession(nouvelleSession)
      setUser(nouvelleSession?.user ?? null)
      void chargerProfil(nouvelleSession?.user.id).catch((error) => {
        setProfil(null)
        toast.error(error instanceof Error ? error.message : 'Profil impossible a charger.')
      })
    })

    return () => {
      actif = false
      subscription.unsubscribe()
    }
  }, [chargerProfil])

  const connecter = useCallback(async (email: string, motDePasse: string) => {
    const resultat = await connecterUtilisateur({ email, motDePasse })
    setSession(resultat.session)
    setUser(resultat.user)
    setProfil(resultat.profil)
  }, [])

  const deconnecter = useCallback(async () => {
    await deconnecterUtilisateur()
    setSession(null)
    setUser(null)
    setProfil(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profil,
      chargement,
      connecter,
      deconnecter,
      rafraichirProfil,
      estAdmin: () => profil?.role === 'admin' && profil.statut === 1,
      peutAccederAuDomaine: (domaine) =>
        profil?.statut === 1 &&
        (profil.role === 'admin' || profil.domaines_autorises.includes(domaine)),
    }),
    [chargement, connecter, deconnecter, profil, rafraichirProfil, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth doit etre utilise dans AuthProvider.')
  }

  return context
}
