CREATE TABLE IF NOT EXISTS public.domaine_executant (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(100) NOT NULL UNIQUE,
  capacite_max integer,
  CONSTRAINT check_domaine_executant_capacite_positive CHECK (
    capacite_max IS NULL OR capacite_max > 0
  )
);

CREATE TABLE IF NOT EXISTS public.executant (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(100) NOT NULL,
  id_domaine uuid NOT NULL REFERENCES public.domaine_executant(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domaine_executant_nom
  ON public.domaine_executant(nom);

CREATE INDEX IF NOT EXISTS idx_executant_nom
  ON public.executant(nom);

CREATE INDEX IF NOT EXISTS idx_executant_id_domaine
  ON public.executant(id_domaine);

INSERT INTO public.domaine_executant (nom, capacite_max)
VALUES
  ('femme de chambre', 7),
  ('fille de salle', 8),
  ('maintenancier', NULL)
ON CONFLICT (nom) DO UPDATE
SET capacite_max = EXCLUDED.capacite_max;

ALTER TABLE public.domaine_executant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executant ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.peut_gerer_executants(utilisateur_id uuid)
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
          AND domaines_autorises && ARRAY['chambres', 'salles']::public.domaine_operation[]
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE POLICY "Les utilisateurs authentifies peuvent voir les domaines executants"
  ON public.domaine_executant
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Seuls les admins peuvent creer des domaines executants"
  ON public.domaine_executant
  FOR INSERT
  TO authenticated
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent modifier les domaines executants"
  ON public.domaine_executant
  FOR UPDATE
  TO authenticated
  USING (public.est_admin(auth.uid()))
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent supprimer les domaines executants"
  ON public.domaine_executant
  FOR DELETE
  TO authenticated
  USING (public.est_admin(auth.uid()));

CREATE POLICY "Les utilisateurs authentifies peuvent voir les executants"
  ON public.executant
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins et coordinateurs chambres salles peuvent creer les executants"
  ON public.executant
  FOR INSERT
  TO authenticated
  WITH CHECK (public.peut_gerer_executants(auth.uid()));

CREATE POLICY "Admins et coordinateurs chambres salles peuvent modifier les executants"
  ON public.executant
  FOR UPDATE
  TO authenticated
  USING (public.peut_gerer_executants(auth.uid()))
  WITH CHECK (public.peut_gerer_executants(auth.uid()));

CREATE POLICY "Seuls les admins peuvent supprimer les executants"
  ON public.executant
  FOR DELETE
  TO authenticated
  USING (public.est_admin(auth.uid()));
