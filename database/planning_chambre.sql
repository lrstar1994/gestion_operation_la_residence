CREATE TABLE IF NOT EXISTS public.type_mouvement (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(50) NOT NULL UNIQUE,
  points integer NOT NULL DEFAULT 0,
  CONSTRAINT check_type_mouvement_points_positifs CHECK (points >= 0)
);

CREATE TABLE IF NOT EXISTS public.etat_mouvement (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.planning_chambre (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  date date NOT NULL,
  id_type_mouvement uuid NOT NULL REFERENCES public.type_mouvement(id),
  id_executant uuid REFERENCES public.executant(id) ON DELETE SET NULL,
  id_etat uuid NOT NULL REFERENCES public.etat_mouvement(id),
  CONSTRAINT unique_mouvement_chambre_jour UNIQUE (id_lieu, date, id_type_mouvement)
);

CREATE TABLE IF NOT EXISTS public.template_planning_chambre (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(100) NOT NULL UNIQUE,
  description text
);

CREATE TABLE IF NOT EXISTS public.template_planning_chambre_item (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_template uuid NOT NULL REFERENCES public.template_planning_chambre(id) ON DELETE CASCADE,
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  jour_semaine integer NOT NULL CHECK (jour_semaine BETWEEN 0 AND 6), -- 0 = dimanche
  id_type_mouvement uuid NOT NULL REFERENCES public.type_mouvement(id),
  id_executant uuid REFERENCES public.executant(id) ON DELETE SET NULL,
  CONSTRAINT unique_template_chambre_jour_type UNIQUE (id_template, id_lieu, jour_semaine, id_type_mouvement)
);

CREATE INDEX IF NOT EXISTS idx_planning_chambre_date ON public.planning_chambre(date);
CREATE INDEX IF NOT EXISTS idx_planning_chambre_lieu ON public.planning_chambre(id_lieu);
CREATE INDEX IF NOT EXISTS idx_planning_chambre_executant ON public.planning_chambre(id_executant);
CREATE INDEX IF NOT EXISTS idx_planning_chambre_type ON public.planning_chambre(id_type_mouvement);
CREATE INDEX IF NOT EXISTS idx_planning_chambre_etat ON public.planning_chambre(id_etat);
CREATE INDEX IF NOT EXISTS idx_template_planning_chambre_item_template ON public.template_planning_chambre_item(id_template);

INSERT INTO public.type_mouvement (nom, points)
VALUES
  ('DEPART', 3),
  ('RECOUCHE', 4),
  ('ARRIVEE', 1)
ON CONFLICT (nom) DO UPDATE
SET points = EXCLUDED.points;

INSERT INTO public.etat_mouvement (nom)
VALUES
  ('A_FAIRE'),
  ('AFFECTE'),
  ('EN_COURS'),
  ('BLOQUE'),
  ('ANNULEE'),
  ('TERMINE')
ON CONFLICT (nom) DO NOTHING;

CREATE OR REPLACE FUNCTION public.peut_gerer_planning_chambre(utilisateur_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND statut = 1
      AND (
        role = 'admin'
        OR (role = 'coordinateur' AND 'chambres' = ANY(domaines_autorises))
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.valider_planning_chambre()
RETURNS trigger AS $$
DECLARE
  categorie_code text;
  etat_affecte_id uuid;
BEGIN
  SELECT lower(trim(c.code))
  INTO categorie_code
  FROM public.lieux l
  JOIN public.categories_lieu c ON c.id = l.id_categorie
  WHERE l.id = NEW.id_lieu;

  IF categorie_code NOT IN ('chambre', 'chambres') THEN
    RAISE EXCEPTION 'Le planning chambre ne peut concerner que des lieux de categorie chambre.';
  END IF;

  IF NEW.id_etat IS NULL THEN
    SELECT id INTO etat_affecte_id
    FROM public.etat_mouvement
    WHERE nom = 'AFFECTE';

    NEW.id_etat := etat_affecte_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_valider_planning_chambre ON public.planning_chambre;

CREATE TRIGGER trigger_valider_planning_chambre
  BEFORE INSERT OR UPDATE ON public.planning_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_planning_chambre();

ALTER TABLE public.type_mouvement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etat_mouvement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_chambre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_planning_chambre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_planning_chambre_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture type mouvement" ON public.type_mouvement;
DROP POLICY IF EXISTS "Admin insert type mouvement" ON public.type_mouvement;
DROP POLICY IF EXISTS "Admin update type mouvement" ON public.type_mouvement;
DROP POLICY IF EXISTS "Admin delete type mouvement" ON public.type_mouvement;
DROP POLICY IF EXISTS "Lecture etat mouvement" ON public.etat_mouvement;
DROP POLICY IF EXISTS "Admin insert etat mouvement" ON public.etat_mouvement;
DROP POLICY IF EXISTS "Admin update etat mouvement" ON public.etat_mouvement;
DROP POLICY IF EXISTS "Admin delete etat mouvement" ON public.etat_mouvement;
DROP POLICY IF EXISTS "Lecture planning chambre" ON public.planning_chambre;
DROP POLICY IF EXISTS "Gestion planning chambre" ON public.planning_chambre;
DROP POLICY IF EXISTS "Suppression planning chambre" ON public.planning_chambre;
DROP POLICY IF EXISTS "Modification planning chambre" ON public.planning_chambre;
DROP POLICY IF EXISTS "Lecture template planning chambre" ON public.template_planning_chambre;
DROP POLICY IF EXISTS "Gestion template planning chambre" ON public.template_planning_chambre;
DROP POLICY IF EXISTS "Suppression template planning chambre" ON public.template_planning_chambre;
DROP POLICY IF EXISTS "Modification template planning chambre" ON public.template_planning_chambre;
DROP POLICY IF EXISTS "Lecture template planning chambre item" ON public.template_planning_chambre_item;
DROP POLICY IF EXISTS "Gestion template planning chambre item" ON public.template_planning_chambre_item;
DROP POLICY IF EXISTS "Suppression template planning chambre item" ON public.template_planning_chambre_item;
DROP POLICY IF EXISTS "Modification template planning chambre item" ON public.template_planning_chambre_item;

CREATE POLICY "Lecture type mouvement"
  ON public.type_mouvement FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert type mouvement"
  ON public.type_mouvement FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));
CREATE POLICY "Admin update type mouvement"
  ON public.type_mouvement FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));
CREATE POLICY "Admin delete type mouvement"
  ON public.type_mouvement FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));

CREATE POLICY "Lecture etat mouvement"
  ON public.etat_mouvement FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert etat mouvement"
  ON public.etat_mouvement FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));
CREATE POLICY "Admin update etat mouvement"
  ON public.etat_mouvement FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));
CREATE POLICY "Admin delete etat mouvement"
  ON public.etat_mouvement FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));

CREATE POLICY "Lecture planning chambre"
  ON public.planning_chambre FOR SELECT TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));
CREATE POLICY "Gestion planning chambre"
  ON public.planning_chambre FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));
CREATE POLICY "Suppression planning chambre"
  ON public.planning_chambre FOR DELETE TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));
CREATE POLICY "Modification planning chambre"
  ON public.planning_chambre FOR UPDATE TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()))
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Lecture template planning chambre"
  ON public.template_planning_chambre FOR SELECT TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));
CREATE POLICY "Gestion template planning chambre"
  ON public.template_planning_chambre FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));
CREATE POLICY "Suppression template planning chambre"
  ON public.template_planning_chambre FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));
CREATE POLICY "Modification template planning chambre"
  ON public.template_planning_chambre FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Lecture template planning chambre item"
  ON public.template_planning_chambre_item FOR SELECT TO authenticated USING (public.peut_gerer_planning_chambre(auth.uid()));
CREATE POLICY "Gestion template planning chambre item"
  ON public.template_planning_chambre_item FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));
CREATE POLICY "Suppression template planning chambre item"
  ON public.template_planning_chambre_item FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));
CREATE POLICY "Modification template planning chambre item"
  ON public.template_planning_chambre_item FOR UPDATE TO authenticated USING (public.est_admin(auth.uid())) WITH CHECK (public.est_admin(auth.uid()));
