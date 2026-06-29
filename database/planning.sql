CREATE TABLE IF NOT EXISTS public.type_planning (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(50) NOT NULL UNIQUE,
  couleur varchar(20) NOT NULL DEFAULT '#64748b'
);

CREATE TABLE IF NOT EXISTS public.planning_executant (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_executant uuid NOT NULL REFERENCES public.executant(id) ON DELETE CASCADE,
  id_type_planning uuid NOT NULL REFERENCES public.type_planning(id) ON DELETE RESTRICT,
  date date NOT NULL,
  heure_debut time,
  heure_fin time,
  CONSTRAINT unique_planning_executant_jour UNIQUE (id_executant, date)
);

CREATE INDEX IF NOT EXISTS idx_type_planning_nom
  ON public.type_planning(nom);

CREATE INDEX IF NOT EXISTS idx_planning_executant_date
  ON public.planning_executant(date);

CREATE INDEX IF NOT EXISTS idx_planning_executant_executant
  ON public.planning_executant(id_executant);

CREATE INDEX IF NOT EXISTS idx_planning_executant_type
  ON public.planning_executant(id_type_planning);

INSERT INTO public.type_planning (nom, couleur)
VALUES
  ('travail', '#16a34a'),
  ('conge', '#2563eb'),
  ('off', '#9333ea'),
  ('absent', '#dc2626')
ON CONFLICT (nom) DO UPDATE
SET couleur = EXCLUDED.couleur;

CREATE OR REPLACE FUNCTION public.valider_planning_executant()
RETURNS trigger AS $$
DECLARE
  type_nom text;
BEGIN
  SELECT lower(nom)
  INTO type_nom
  FROM public.type_planning
  WHERE id = NEW.id_type_planning;

  IF type_nom = 'travail' THEN
    IF NEW.heure_debut IS NULL OR NEW.heure_fin IS NULL THEN
      RAISE EXCEPTION 'Les horaires sont obligatoires pour un planning de type travail.';
    END IF;

    IF NEW.heure_fin <= NEW.heure_debut THEN
      RAISE EXCEPTION 'L''heure de fin doit etre superieure a l''heure de debut.';
    END IF;
  ELSE
    NEW.heure_debut := NULL;
    NEW.heure_fin := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_valider_planning_executant ON public.planning_executant;

CREATE TRIGGER trigger_valider_planning_executant
  BEFORE INSERT OR UPDATE ON public.planning_executant
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_planning_executant();

ALTER TABLE public.type_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_executant ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.peut_voir_executant(utilisateur_id uuid, executant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs u
    JOIN public.executant e ON e.id = executant_id
    JOIN public.domaine_executant de ON de.id = e.id_domaine
    WHERE u.id = utilisateur_id
      AND u.statut = 1
      AND (
        u.role = 'admin'
        OR (
          u.role = 'coordinateur'
          AND (
            (de.nom ILIKE '%chambre%' AND 'chambres' = ANY(u.domaines_autorises))
            OR (de.nom ILIKE '%salle%' AND 'salles' = ANY(u.domaines_autorises))
            OR (de.nom ILIKE '%maintenance%' AND 'maintenance' = ANY(u.domaines_autorises))
          )
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "Les utilisateurs authentifies peuvent voir les types planning"
  ON public.type_planning;
DROP POLICY IF EXISTS "Seuls les admins peuvent creer les types planning"
  ON public.type_planning;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier les types planning"
  ON public.type_planning;
DROP POLICY IF EXISTS "Seuls les admins peuvent supprimer les types planning"
  ON public.type_planning;

DROP POLICY IF EXISTS "Les utilisateurs autorises peuvent voir le planning"
  ON public.planning_executant;
DROP POLICY IF EXISTS "Seuls les admins peuvent creer le planning"
  ON public.planning_executant;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier le planning"
  ON public.planning_executant;
DROP POLICY IF EXISTS "Seuls les admins peuvent supprimer le planning"
  ON public.planning_executant;

CREATE POLICY "Les utilisateurs authentifies peuvent voir les types planning"
  ON public.type_planning
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Seuls les admins peuvent creer les types planning"
  ON public.type_planning
  FOR INSERT
  TO authenticated
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent modifier les types planning"
  ON public.type_planning
  FOR UPDATE
  TO authenticated
  USING (public.est_admin(auth.uid()))
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent supprimer les types planning"
  ON public.type_planning
  FOR DELETE
  TO authenticated
  USING (public.est_admin(auth.uid()));

CREATE POLICY "Les utilisateurs autorises peuvent voir le planning"
  ON public.planning_executant
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Seuls les admins peuvent creer le planning"
  ON public.planning_executant
  FOR INSERT
  TO authenticated
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent modifier le planning"
  ON public.planning_executant
  FOR UPDATE
  TO authenticated
  USING (public.est_admin(auth.uid()))
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent supprimer le planning"
  ON public.planning_executant
  FOR DELETE
  TO authenticated
  USING (public.est_admin(auth.uid()));
