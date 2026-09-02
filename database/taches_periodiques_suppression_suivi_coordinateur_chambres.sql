-- Autorise la vraie suppression des echeances de taches periodiques dans le suivi
-- pour l'admin et les coordinateurs du domaine chambres.
-- Le referentiel tache_periodique reste supprimable par admin uniquement.

CREATE OR REPLACE FUNCTION public.peut_supprimer_planning_tache_periodique(utilisateur_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND statut = 1
      AND (
        role = 'admin'
        OR (
          role = 'coordinateur'
          AND 'chambres' = ANY(domaines_autorises)
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "Suppression planning tache periodique" ON public.tache_periodique_planning;

CREATE POLICY "Suppression planning tache periodique"
  ON public.tache_periodique_planning FOR DELETE TO authenticated
  USING (public.peut_supprimer_planning_tache_periodique(auth.uid()));
