CREATE TABLE IF NOT EXISTS public.tache_periodique (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(100) NOT NULL,
  code varchar(50) UNIQUE,
  description text,
  id_categorie_lieu uuid REFERENCES public.categories_lieu(id),
  frequence_jours integer NOT NULL CHECK (frequence_jours > 0),
  priorite varchar(20) NOT NULL DEFAULT 'normale' CHECK (priorite IN ('haute', 'normale', 'basse')),
  niveau_lourdeur varchar(20) NOT NULL DEFAULT 'moyen' CHECK (niveau_lourdeur IN ('leger', 'moyen', 'lourd')),
  nature varchar(30) NOT NULL DEFAULT 'entretien' CHECK (nature IN ('obligatoire', 'entretien', 'opportuniste')),
  points_estimes integer NOT NULL CHECK (points_estimes >= 0),
  est_reportable boolean DEFAULT true,
  delai_alerte_jours integer DEFAULT 3 CHECK (delai_alerte_jours >= 0),
  est_actif boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.tache_periodique_planning (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_tache uuid NOT NULL REFERENCES public.tache_periodique(id) ON DELETE CASCADE,
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  id_executant uuid REFERENCES public.executant(id) ON DELETE SET NULL,
  date_realisation date,
  date_echeance date NOT NULL,
  date_echeance_originale date,
  id_etat uuid NOT NULL REFERENCES public.etat_mouvement(id),
  est_reportee boolean DEFAULT false,
  motif_report text,
  est_actif boolean DEFAULT true,
  CONSTRAINT unique_tache_lieu UNIQUE(id_tache, id_lieu)
);

CREATE TABLE IF NOT EXISTS public.tache_periodique_historique (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_tache uuid NOT NULL REFERENCES public.tache_periodique(id) ON DELETE CASCADE,
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  id_executant uuid REFERENCES public.executant(id) ON DELETE SET NULL,
  date_realisation date NOT NULL,
  duree_minutes integer CHECK (duree_minutes IS NULL OR duree_minutes >= 0),
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tache_periodique_actif ON public.tache_periodique(est_actif);
CREATE INDEX IF NOT EXISTS idx_tache_periodique_categorie_lieu ON public.tache_periodique(id_categorie_lieu);
CREATE INDEX IF NOT EXISTS idx_tache_periodique_planning_echeance ON public.tache_periodique_planning(date_echeance);
CREATE INDEX IF NOT EXISTS idx_tache_periodique_planning_etat ON public.tache_periodique_planning(id_etat);
CREATE INDEX IF NOT EXISTS idx_tache_periodique_planning_lieu ON public.tache_periodique_planning(id_lieu);
CREATE INDEX IF NOT EXISTS idx_tache_periodique_historique_tache_lieu ON public.tache_periodique_historique(id_tache, id_lieu);


UPDATE public.tache_periodique_planning tp
SET id_etat = (SELECT id FROM public.etat_mouvement WHERE nom = 'A_FAIRE')
WHERE id_etat = (SELECT id FROM public.etat_mouvement WHERE nom = 'AFFECTE');

CREATE OR REPLACE FUNCTION public.peut_gerer_taches_periodiques(utilisateur_id uuid)
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
          AND (
            'chambres' = ANY(domaines_autorises)
            OR 'salles' = ANY(domaines_autorises)
          )
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.initialiser_tache_periodique_planning()
RETURNS trigger AS $$
DECLARE
  etat_a_faire_id uuid;
BEGIN
  IF NEW.id_etat IS NULL THEN
    SELECT id INTO etat_a_faire_id FROM public.etat_mouvement WHERE nom = 'A_FAIRE';
    NEW.id_etat := etat_a_faire_id;
  END IF;

  IF NEW.date_echeance_originale IS NULL THEN
    NEW.date_echeance_originale := NEW.date_echeance;
  END IF;

  IF NEW.est_reportee = true AND NULLIF(trim(COALESCE(NEW.motif_report, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un motif est obligatoire pour reporter une tache.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_initialiser_tache_periodique_planning ON public.tache_periodique_planning;
CREATE TRIGGER trigger_initialiser_tache_periodique_planning
  BEFORE INSERT OR UPDATE ON public.tache_periodique_planning
  FOR EACH ROW
  EXECUTE FUNCTION public.initialiser_tache_periodique_planning();

ALTER TABLE public.tache_periodique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tache_periodique_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tache_periodique_historique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture tache periodique" ON public.tache_periodique;
DROP POLICY IF EXISTS "Gestion tache periodique" ON public.tache_periodique;
DROP POLICY IF EXISTS "Modification tache periodique" ON public.tache_periodique;
DROP POLICY IF EXISTS "Suppression tache periodique" ON public.tache_periodique;
DROP POLICY IF EXISTS "Lecture planning tache periodique" ON public.tache_periodique_planning;
DROP POLICY IF EXISTS "Gestion planning tache periodique" ON public.tache_periodique_planning;
DROP POLICY IF EXISTS "Modification planning tache periodique" ON public.tache_periodique_planning;
DROP POLICY IF EXISTS "Suppression planning tache periodique" ON public.tache_periodique_planning;
DROP POLICY IF EXISTS "Lecture historique tache periodique" ON public.tache_periodique_historique;
DROP POLICY IF EXISTS "Gestion historique tache periodique" ON public.tache_periodique_historique;

CREATE POLICY "Lecture tache periodique"
  ON public.tache_periodique FOR SELECT TO authenticated
  USING (public.peut_gerer_taches_periodiques(auth.uid()));
CREATE POLICY "Gestion tache periodique"
  ON public.tache_periodique FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));
CREATE POLICY "Modification tache periodique"
  ON public.tache_periodique FOR UPDATE TO authenticated
  USING (public.peut_gerer_taches_periodiques(auth.uid()))
  WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));
CREATE POLICY "Suppression tache periodique"
  ON public.tache_periodique FOR DELETE TO authenticated
  USING (public.est_admin(auth.uid()));

CREATE POLICY "Lecture planning tache periodique"
  ON public.tache_periodique_planning FOR SELECT TO authenticated
  USING (public.peut_gerer_taches_periodiques(auth.uid()));
CREATE POLICY "Gestion planning tache periodique"
  ON public.tache_periodique_planning FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));
CREATE POLICY "Modification planning tache periodique"
  ON public.tache_periodique_planning FOR UPDATE TO authenticated
  USING (public.peut_gerer_taches_periodiques(auth.uid()))
  WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));
CREATE POLICY "Suppression planning tache periodique"
  ON public.tache_periodique_planning FOR DELETE TO authenticated
  USING (public.est_admin(auth.uid()));

CREATE POLICY "Lecture historique tache periodique"
  ON public.tache_periodique_historique FOR SELECT TO authenticated
  USING (public.peut_gerer_taches_periodiques(auth.uid()));
CREATE POLICY "Gestion historique tache periodique"
  ON public.tache_periodique_historique FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_taches_periodiques(auth.uid()));
