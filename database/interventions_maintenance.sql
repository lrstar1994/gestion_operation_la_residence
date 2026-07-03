CREATE TABLE IF NOT EXISTS public.type_intervention_maintenance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(100) NOT NULL UNIQUE,
  est_actif boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.intervention_maintenance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titre varchar(200) NOT NULL,
  description text,
  travail_a_faire text,
  id_type_intervention uuid NOT NULL REFERENCES public.type_intervention_maintenance(id),
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  date_intervention date NOT NULL,
  heure_debut time,
  date_fin date,
  heure_fin time,
  priorite varchar(20) NOT NULL DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'urgente')),
  id_executant uuid REFERENCES public.executant(id) ON DELETE SET NULL,
  id_etat uuid NOT NULL REFERENCES public.etat_mouvement(id),
  commentaire_fermeture text,
  date_fermeture timestamptz,
  est_actif boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_intervention (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_intervention uuid NOT NULL REFERENCES public.intervention_maintenance(id) ON DELETE CASCADE,
  url_storage text NOT NULL,
  nom_fichier varchar(255) NOT NULL,
  type_photo varchar(20) NOT NULL CHECK (type_photo IN ('avant', 'apres', 'progression', 'anomalie', 'detail')),
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commentaire_intervention (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_intervention uuid NOT NULL REFERENCES public.intervention_maintenance(id) ON DELETE CASCADE,
  id_utilisateur uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  commentaire text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_maintenance_lieu ON public.intervention_maintenance(id_lieu);
CREATE INDEX IF NOT EXISTS idx_intervention_maintenance_etat ON public.intervention_maintenance(id_etat);
CREATE INDEX IF NOT EXISTS idx_intervention_maintenance_priorite ON public.intervention_maintenance(priorite);
CREATE INDEX IF NOT EXISTS idx_intervention_maintenance_type ON public.intervention_maintenance(id_type_intervention);
CREATE INDEX IF NOT EXISTS idx_intervention_maintenance_date ON public.intervention_maintenance(date_intervention);
CREATE INDEX IF NOT EXISTS idx_photo_intervention_intervention ON public.photo_intervention(id_intervention);
CREATE INDEX IF NOT EXISTS idx_photo_intervention_type ON public.photo_intervention(type_photo);
CREATE INDEX IF NOT EXISTS idx_commentaire_intervention_intervention ON public.commentaire_intervention(id_intervention);

INSERT INTO public.type_intervention_maintenance (nom)
VALUES
  ('Electricite'),
  ('Plomberie'),
  ('Menuiserie'),
  ('Metallerie'),
  ('Peinture'),
  ('Maconnerie'),
  ('Carrelage'),
  ('Jardin / Exterieur'),
  ('Nettoyage technique'),
  ('Autre')
ON CONFLICT (nom) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('interventions', 'interventions', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE OR REPLACE FUNCTION public.peut_gerer_interventions_maintenance(utilisateur_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND statut = 1
      AND (
        role = 'admin'
        OR (role = 'coordinateur' AND 'maintenance' = ANY(domaines_autorises))
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.valider_intervention_maintenance()
RETURNS trigger AS $$
DECLARE
  etat_termine_id uuid;
  photos_apres integer;
BEGIN
  NEW.updated_at := now();

  SELECT id INTO etat_termine_id
  FROM public.etat_mouvement
  WHERE nom = 'TERMINE';

  IF NEW.id_etat = etat_termine_id THEN
    SELECT count(*)
    INTO photos_apres
    FROM public.photo_intervention
    WHERE id_intervention = NEW.id
      AND type_photo = 'apres';

    IF photos_apres = 0 THEN
      RAISE EXCEPTION 'Impossible de fermer une intervention sans photo apres.';
    END IF;

    IF NEW.date_fermeture IS NULL THEN
      NEW.date_fermeture := now();
    END IF;
  ELSE
    NEW.date_fermeture := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_valider_intervention_maintenance ON public.intervention_maintenance;
CREATE TRIGGER trigger_valider_intervention_maintenance
  BEFORE UPDATE ON public.intervention_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_intervention_maintenance();

CREATE OR REPLACE FUNCTION public.empecher_modification_photos_intervention_fermee()
RETURNS trigger AS $$
DECLARE
  etat_intervention text;
BEGIN
  SELECT e.nom
  INTO etat_intervention
  FROM public.intervention_maintenance i
  JOIN public.etat_mouvement e ON e.id = i.id_etat
  WHERE i.id = COALESCE(NEW.id_intervention, OLD.id_intervention);

  IF etat_intervention = 'TERMINE' THEN
    RAISE EXCEPTION 'Les photos sont verrouillees apres fermeture.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_verrouiller_photos_intervention ON public.photo_intervention;
CREATE TRIGGER trigger_verrouiller_photos_intervention
  BEFORE INSERT OR UPDATE OR DELETE ON public.photo_intervention
  FOR EACH ROW
  EXECUTE FUNCTION public.empecher_modification_photos_intervention_fermee();

ALTER TABLE public.intervention_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.type_intervention_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_intervention ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commentaire_intervention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture types intervention maintenance" ON public.type_intervention_maintenance;
DROP POLICY IF EXISTS "Gestion types intervention maintenance" ON public.type_intervention_maintenance;
DROP POLICY IF EXISTS "Modification types intervention maintenance" ON public.type_intervention_maintenance;
DROP POLICY IF EXISTS "Suppression types intervention maintenance" ON public.type_intervention_maintenance;
DROP POLICY IF EXISTS "Lecture interventions maintenance" ON public.intervention_maintenance;
DROP POLICY IF EXISTS "Gestion interventions maintenance" ON public.intervention_maintenance;
DROP POLICY IF EXISTS "Modification interventions maintenance" ON public.intervention_maintenance;
DROP POLICY IF EXISTS "Suppression interventions maintenance" ON public.intervention_maintenance;
DROP POLICY IF EXISTS "Lecture photos intervention" ON public.photo_intervention;
DROP POLICY IF EXISTS "Gestion photos intervention" ON public.photo_intervention;
DROP POLICY IF EXISTS "Modification photos intervention" ON public.photo_intervention;
DROP POLICY IF EXISTS "Suppression photos intervention" ON public.photo_intervention;
DROP POLICY IF EXISTS "Lecture commentaires intervention" ON public.commentaire_intervention;
DROP POLICY IF EXISTS "Gestion commentaires intervention" ON public.commentaire_intervention;

CREATE POLICY "Lecture types intervention maintenance"
  ON public.type_intervention_maintenance FOR SELECT TO authenticated
  USING (public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Gestion types intervention maintenance"
  ON public.type_intervention_maintenance FOR INSERT TO authenticated
  WITH CHECK (public.est_admin(auth.uid()));
CREATE POLICY "Modification types intervention maintenance"
  ON public.type_intervention_maintenance FOR UPDATE TO authenticated
  USING (public.est_admin(auth.uid()))
  WITH CHECK (public.est_admin(auth.uid()));
CREATE POLICY "Suppression types intervention maintenance"
  ON public.type_intervention_maintenance FOR DELETE TO authenticated
  USING (public.est_admin(auth.uid()));

CREATE POLICY "Lecture interventions maintenance"
  ON public.intervention_maintenance FOR SELECT TO authenticated
  USING (public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Gestion interventions maintenance"
  ON public.intervention_maintenance FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Modification interventions maintenance"
  ON public.intervention_maintenance FOR UPDATE TO authenticated
  USING (public.peut_gerer_interventions_maintenance(auth.uid()))
  WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Suppression interventions maintenance"
  ON public.intervention_maintenance FOR DELETE TO authenticated
  USING (public.est_admin(auth.uid()));

CREATE POLICY "Lecture photos intervention"
  ON public.photo_intervention FOR SELECT TO authenticated
  USING (public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Gestion photos intervention"
  ON public.photo_intervention FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Modification photos intervention"
  ON public.photo_intervention FOR UPDATE TO authenticated
  USING (public.peut_gerer_interventions_maintenance(auth.uid()))
  WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Suppression photos intervention"
  ON public.photo_intervention FOR DELETE TO authenticated
  USING (public.peut_gerer_interventions_maintenance(auth.uid()));

CREATE POLICY "Lecture commentaires intervention"
  ON public.commentaire_intervention FOR SELECT TO authenticated
  USING (public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Gestion commentaires intervention"
  ON public.commentaire_intervention FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));

DROP POLICY IF EXISTS "Lecture storage interventions" ON storage.objects;
DROP POLICY IF EXISTS "Upload storage interventions" ON storage.objects;
DROP POLICY IF EXISTS "Modification storage interventions" ON storage.objects;
DROP POLICY IF EXISTS "Suppression storage interventions" ON storage.objects;

CREATE POLICY "Lecture storage interventions"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'interventions' AND public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Upload storage interventions"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'interventions' AND public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Modification storage interventions"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'interventions' AND public.peut_gerer_interventions_maintenance(auth.uid()))
  WITH CHECK (bucket_id = 'interventions' AND public.peut_gerer_interventions_maintenance(auth.uid()));
CREATE POLICY "Suppression storage interventions"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'interventions' AND public.peut_gerer_interventions_maintenance(auth.uid()));
