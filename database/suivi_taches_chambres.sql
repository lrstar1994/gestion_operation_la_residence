ALTER TABLE public.tache_chambre
  ADD COLUMN IF NOT EXISTS motif_blocage text;

CREATE TABLE IF NOT EXISTS public.historique_etat_tache_chambre (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_tache_chambre uuid NOT NULL REFERENCES public.tache_chambre(id) ON DELETE CASCADE,
  ancien_id_etat uuid REFERENCES public.etat_mouvement(id) ON DELETE SET NULL,
  nouveau_id_etat uuid NOT NULL REFERENCES public.etat_mouvement(id) ON DELETE CASCADE,
  motif text,
  modifie_par uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historique_etat_tache_chambre_tache
  ON public.historique_etat_tache_chambre(id_tache_chambre);

CREATE INDEX IF NOT EXISTS idx_historique_etat_tache_chambre_created_at
  ON public.historique_etat_tache_chambre(created_at);

CREATE INDEX IF NOT EXISTS idx_tache_chambre_motif_blocage
  ON public.tache_chambre(motif_blocage) WHERE motif_blocage IS NOT NULL;

CREATE OR REPLACE FUNCTION public.valider_suivi_tache_chambre()
RETURNS trigger AS $$
DECLARE
  nouveau_etat text;
BEGIN
  SELECT nom INTO nouveau_etat
  FROM public.etat_mouvement
  WHERE id = NEW.id_etat;

  IF nouveau_etat = 'BLOQUE' AND NULLIF(trim(COALESCE(NEW.motif_blocage, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Le motif est obligatoire pour bloquer une tâche chambre';
  END IF;

  IF nouveau_etat <> 'BLOQUE' THEN
    NEW.motif_blocage := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.tracer_etat_tache_chambre()
RETURNS trigger AS $$
DECLARE
  utilisateur_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.id_etat IS DISTINCT FROM OLD.id_etat OR NEW.motif_blocage IS DISTINCT FROM OLD.motif_blocage THEN
    SELECT id INTO utilisateur_id
    FROM public.utilisateurs
    WHERE id = auth.uid();

    INSERT INTO public.historique_etat_tache_chambre (
      id_tache_chambre,
      ancien_id_etat,
      nouveau_id_etat,
      motif,
      modifie_par
    )
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.id_etat END,
      NEW.id_etat,
      NEW.motif_blocage,
      utilisateur_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_valider_suivi_tache_chambre ON public.tache_chambre;
CREATE TRIGGER trigger_valider_suivi_tache_chambre
  BEFORE INSERT OR UPDATE OF id_etat, motif_blocage ON public.tache_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_suivi_tache_chambre();

DROP TRIGGER IF EXISTS trigger_tracer_etat_tache_chambre ON public.tache_chambre;
CREATE TRIGGER trigger_tracer_etat_tache_chambre
  AFTER INSERT OR UPDATE OF id_etat, motif_blocage ON public.tache_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.tracer_etat_tache_chambre();

ALTER TABLE public.historique_etat_tache_chambre ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture historique etat tache chambre" ON public.historique_etat_tache_chambre;
DROP POLICY IF EXISTS "Insertion historique etat tache chambre" ON public.historique_etat_tache_chambre;
DROP POLICY IF EXISTS "Suppression historique etat tache chambre" ON public.historique_etat_tache_chambre;

CREATE POLICY "Lecture historique etat tache chambre"
  ON public.historique_etat_tache_chambre FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Insertion historique etat tache chambre"
  ON public.historique_etat_tache_chambre FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Suppression historique etat tache chambre"
  ON public.historique_etat_tache_chambre FOR DELETE TO authenticated
  USING (public.est_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.creer_tache_chambre_depuis_planning()
RETURNS trigger AS $$
DECLARE
  executant_defaut uuid;
  points_mouvement integer;
  urgence_tache text;
BEGIN
  SELECT b.id_executant_defaut INTO executant_defaut
  FROM public.lieux l
  LEFT JOIN public.batiments b ON b.id = l.id_batiment
  WHERE l.id = NEW.id_lieu;

  SELECT COALESCE(points, 0) INTO points_mouvement
  FROM public.type_mouvement
  WHERE id = NEW.id_type_mouvement;

  urgence_tache := CASE WHEN NEW.date <= CURRENT_DATE THEN 'haute' ELSE 'normale' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tache_chambre (
      id_planning_chambre,
      id_lieu,
      id_type_mouvement,
      date_mouvement,
      date_execution,
      date_limite,
      id_executant,
      id_etat,
      points,
      urgence,
      motif_blocage,
      commentaire
    )
    VALUES (
      NEW.id,
      NEW.id_lieu,
      NEW.id_type_mouvement,
      NEW.date,
      NEW.date,
      NEW.date,
      COALESCE(NEW.id_executant, executant_defaut),
      NEW.id_etat,
      points_mouvement,
      urgence_tache,
      NEW.motif_blocage,
      NULL
    )
    ON CONFLICT (id_planning_chambre) DO NOTHING;
  ELSE
    UPDATE public.tache_chambre
    SET
      id_lieu = NEW.id_lieu,
      id_type_mouvement = NEW.id_type_mouvement,
      date_mouvement = NEW.date,
      date_execution = NEW.date,
      date_limite = NEW.date,
      id_executant = COALESCE(NEW.id_executant, executant_defaut),
      id_etat = NEW.id_etat,
      points = points_mouvement,
      urgence = urgence_tache,
      motif_blocage = NEW.motif_blocage
    WHERE id_planning_chambre = NEW.id
      AND date_execution = OLD.date
      AND date_limite = OLD.date;

    IF NOT FOUND THEN
      INSERT INTO public.tache_chambre (
        id_planning_chambre,
        id_lieu,
        id_type_mouvement,
        date_mouvement,
        date_execution,
        date_limite,
        id_executant,
        id_etat,
        points,
        urgence,
        motif_blocage,
        commentaire
      )
      VALUES (
        NEW.id,
        NEW.id_lieu,
        NEW.id_type_mouvement,
        NEW.date,
        NEW.date,
        NEW.date,
        COALESCE(NEW.id_executant, executant_defaut),
        NEW.id_etat,
        points_mouvement,
        urgence_tache,
        NEW.motif_blocage,
        NULL
      )
      ON CONFLICT (id_planning_chambre) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_creer_tache_chambre_depuis_planning ON public.planning_chambre;
CREATE TRIGGER trigger_creer_tache_chambre_depuis_planning
  AFTER INSERT OR UPDATE OF id_lieu, date, id_type_mouvement, id_executant, id_etat, motif_blocage ON public.planning_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.creer_tache_chambre_depuis_planning();
