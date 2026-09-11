-- Gestion des menages long sejour.
-- A executer dans Supabase SQL Editor apres les migrations planning_chambre, taches_chambres,
-- suivi_taches_chambres et planning_chambre_multi_executants.

CREATE TABLE IF NOT EXISTS public.sejour_chambre (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  type_sejour varchar(20) NOT NULL DEFAULT 'normal' CHECK (type_sejour IN ('normal', 'long_sejour')),
  frequence_menage_semaine integer CHECK (frequence_menage_semaine IN (1, 2)),
  jour_menage_1 integer CHECK (jour_menage_1 BETWEEN 0 AND 6),
  jour_menage_2 integer CHECK (jour_menage_2 BETWEEN 0 AND 6),
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_sejour_chambre_dates CHECK (date_fin >= date_debut),
  CONSTRAINT check_sejour_chambre_long_sejour_parametres CHECK (
    (
      type_sejour = 'normal'
      AND frequence_menage_semaine IS NULL
      AND jour_menage_1 IS NULL
      AND jour_menage_2 IS NULL
    )
    OR
    (
      type_sejour = 'long_sejour'
      AND frequence_menage_semaine IS NOT NULL
      AND jour_menage_1 IS NOT NULL
      AND (
        (frequence_menage_semaine = 1 AND jour_menage_2 IS NULL)
        OR
        (frequence_menage_semaine = 2 AND jour_menage_2 IS NOT NULL AND jour_menage_2 <> jour_menage_1)
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_sejour_chambre_lieu ON public.sejour_chambre(id_lieu);
CREATE INDEX IF NOT EXISTS idx_sejour_chambre_dates ON public.sejour_chambre(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_sejour_chambre_type ON public.sejour_chambre(type_sejour);
CREATE INDEX IF NOT EXISTS idx_sejour_chambre_actif ON public.sejour_chambre(est_actif);

ALTER TABLE public.planning_chambre
  ADD COLUMN IF NOT EXISTS id_sejour_chambre uuid REFERENCES public.sejour_chambre(id) ON DELETE SET NULL;

ALTER TABLE public.tache_chambre
  ADD COLUMN IF NOT EXISTS id_sejour_chambre uuid REFERENCES public.sejour_chambre(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_initiale date,
  ADD COLUMN IF NOT EXISTS date_realisation date,
  ADD COLUMN IF NOT EXISTS est_deplacee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS type_generation varchar(30) NOT NULL DEFAULT 'planning'
    CHECK (type_generation IN ('planning', 'long_sejour', 'manuel'));

UPDATE public.tache_chambre
SET
  date_initiale = COALESCE(date_initiale, date_mouvement),
  est_deplacee = COALESCE(date_execution <> COALESCE(date_initiale, date_mouvement), false)
WHERE date_initiale IS NULL
   OR est_deplacee IS DISTINCT FROM COALESCE(date_execution <> COALESCE(date_initiale, date_mouvement), false);

CREATE INDEX IF NOT EXISTS idx_planning_chambre_sejour ON public.planning_chambre(id_sejour_chambre);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_sejour ON public.tache_chambre(id_sejour_chambre);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_date_initiale ON public.tache_chambre(date_initiale);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_date_realisation ON public.tache_chambre(date_realisation);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_type_generation ON public.tache_chambre(type_generation);

CREATE UNIQUE INDEX IF NOT EXISTS unique_tache_chambre_long_sejour_occurrence
  ON public.tache_chambre(id_sejour_chambre, id_lieu, date_initiale, id_type_mouvement)
  WHERE type_generation = 'long_sejour';

CREATE TABLE IF NOT EXISTS public.historique_deplacement_tache_chambre (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_tache_chambre uuid NOT NULL REFERENCES public.tache_chambre(id) ON DELETE CASCADE,
  ancienne_date_execution date NOT NULL,
  nouvelle_date_execution date NOT NULL,
  modifie_par uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historique_deplacement_tache_chambre_tache
  ON public.historique_deplacement_tache_chambre(id_tache_chambre);

CREATE INDEX IF NOT EXISTS idx_historique_deplacement_tache_chambre_created_at
  ON public.historique_deplacement_tache_chambre(created_at);

INSERT INTO public.type_mouvement (nom, points, couleur)
VALUES ('MENAGE_LONG_SEJOUR', 1, '#db2777')
ON CONFLICT (nom) DO UPDATE
SET couleur = COALESCE(public.type_mouvement.couleur, EXCLUDED.couleur);

CREATE OR REPLACE FUNCTION public.valider_sejour_chambre()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_valider_sejour_chambre ON public.sejour_chambre;
CREATE TRIGGER trigger_valider_sejour_chambre
  BEFORE INSERT OR UPDATE ON public.sejour_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_sejour_chambre();

CREATE OR REPLACE FUNCTION public.marquer_deplacement_tache_chambre()
RETURNS trigger AS $$
BEGIN
  IF NEW.date_initiale IS NULL THEN
    NEW.date_initiale := NEW.date_mouvement;
  END IF;

  NEW.est_deplacee := NEW.date_execution IS DISTINCT FROM NEW.date_initiale;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_marquer_deplacement_tache_chambre ON public.tache_chambre;
CREATE TRIGGER trigger_marquer_deplacement_tache_chambre
  BEFORE INSERT OR UPDATE OF date_mouvement, date_execution, date_initiale ON public.tache_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.marquer_deplacement_tache_chambre();

CREATE OR REPLACE FUNCTION public.tracer_deplacement_tache_chambre()
RETURNS trigger AS $$
DECLARE
  utilisateur_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.date_execution IS DISTINCT FROM OLD.date_execution THEN
    SELECT id INTO utilisateur_id
    FROM public.utilisateurs
    WHERE id = auth.uid();

    INSERT INTO public.historique_deplacement_tache_chambre (
      id_tache_chambre,
      ancienne_date_execution,
      nouvelle_date_execution,
      modifie_par
    )
    VALUES (
      NEW.id,
      OLD.date_execution,
      NEW.date_execution,
      utilisateur_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_tracer_deplacement_tache_chambre ON public.tache_chambre;
CREATE TRIGGER trigger_tracer_deplacement_tache_chambre
  AFTER UPDATE OF date_execution ON public.tache_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.tracer_deplacement_tache_chambre();

CREATE OR REPLACE FUNCTION public.creer_tache_chambre_depuis_planning()
RETURNS trigger AS $$
DECLARE
  executant_defaut uuid;
  executant_a_affecter uuid;
  points_mouvement integer;
  urgence_tache text;
BEGIN
  SELECT COALESCE(l.id_executant_defaut, b.id_executant_defaut) INTO executant_defaut
  FROM public.lieux l
  LEFT JOIN public.batiments b ON b.id = l.id_batiment
  WHERE l.id = NEW.id_lieu;

  SELECT COALESCE(points, 0) INTO points_mouvement
  FROM public.type_mouvement
  WHERE id = NEW.id_type_mouvement;

  urgence_tache := CASE WHEN NEW.date <= CURRENT_DATE THEN 'haute' ELSE 'normale' END;

  IF NEW.id_executant IS NOT NULL THEN
    executant_a_affecter := NEW.id_executant;
  ELSIF executant_defaut IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.planning_executant pe
    JOIN public.type_planning tp ON tp.id = pe.id_type_planning
    WHERE pe.id_executant = executant_defaut
      AND pe.date = NEW.date
      AND lower(tp.nom) = 'travail'
  ) THEN
    executant_a_affecter := executant_defaut;
  ELSE
    executant_a_affecter := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tache_chambre (
      id_planning_chambre,
      id_sejour_chambre,
      id_lieu,
      id_type_mouvement,
      date_mouvement,
      date_initiale,
      date_execution,
      date_limite,
      id_executant,
      id_etat,
      points,
      urgence,
      motif_blocage,
      commentaire,
      type_generation
    )
    VALUES (
      NEW.id,
      NEW.id_sejour_chambre,
      NEW.id_lieu,
      NEW.id_type_mouvement,
      NEW.date,
      NEW.date,
      NEW.date,
      NEW.date,
      executant_a_affecter,
      NEW.id_etat,
      points_mouvement,
      urgence_tache,
      NEW.motif_blocage,
      NULL,
      'planning'
    )
    ON CONFLICT (id_planning_chambre) DO NOTHING;
  ELSE
    UPDATE public.tache_chambre
    SET
      id_sejour_chambre = NEW.id_sejour_chambre,
      id_lieu = NEW.id_lieu,
      id_type_mouvement = NEW.id_type_mouvement,
      date_mouvement = NEW.date,
      date_initiale = NEW.date,
      date_execution = NEW.date,
      date_limite = NEW.date,
      id_executant = executant_a_affecter,
      id_etat = NEW.id_etat,
      points = points_mouvement,
      urgence = urgence_tache,
      motif_blocage = NEW.motif_blocage,
      type_generation = 'planning'
    WHERE id_planning_chambre = NEW.id
      AND date_execution = OLD.date
      AND date_limite = OLD.date;

    IF NOT FOUND THEN
      INSERT INTO public.tache_chambre (
        id_planning_chambre,
        id_sejour_chambre,
        id_lieu,
        id_type_mouvement,
        date_mouvement,
        date_initiale,
        date_execution,
        date_limite,
        id_executant,
        id_etat,
        points,
        urgence,
        motif_blocage,
        commentaire,
        type_generation
      )
      VALUES (
        NEW.id,
        NEW.id_sejour_chambre,
        NEW.id_lieu,
        NEW.id_type_mouvement,
        NEW.date,
        NEW.date,
        NEW.date,
        NEW.date,
        executant_a_affecter,
        NEW.id_etat,
        points_mouvement,
        urgence_tache,
        NEW.motif_blocage,
        NULL,
        'planning'
      )
      ON CONFLICT (id_planning_chambre) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.sejour_chambre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historique_deplacement_tache_chambre ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture sejour chambre" ON public.sejour_chambre;
DROP POLICY IF EXISTS "Gestion sejour chambre" ON public.sejour_chambre;
DROP POLICY IF EXISTS "Lecture historique deplacement tache chambre" ON public.historique_deplacement_tache_chambre;
DROP POLICY IF EXISTS "Gestion historique deplacement tache chambre" ON public.historique_deplacement_tache_chambre;

CREATE POLICY "Lecture sejour chambre"
  ON public.sejour_chambre FOR SELECT TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Gestion sejour chambre"
  ON public.sejour_chambre FOR ALL TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()))
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Lecture historique deplacement tache chambre"
  ON public.historique_deplacement_tache_chambre FOR SELECT TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Gestion historique deplacement tache chambre"
  ON public.historique_deplacement_tache_chambre FOR ALL TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()))
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

SELECT pg_notify('pgrst', 'reload schema');
