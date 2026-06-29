ALTER TABLE public.planning_chambre
  ADD COLUMN IF NOT EXISTS motif_blocage text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.historique_etat_mouvement (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_planning_chambre uuid NOT NULL REFERENCES public.planning_chambre(id) ON DELETE CASCADE,
  ancien_id_etat uuid REFERENCES public.etat_mouvement(id) ON DELETE SET NULL,
  nouveau_id_etat uuid NOT NULL REFERENCES public.etat_mouvement(id) ON DELETE RESTRICT,
  motif text,
  modifie_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historique_etat_mouvement_planning
  ON public.historique_etat_mouvement(id_planning_chambre);
CREATE INDEX IF NOT EXISTS idx_historique_etat_mouvement_created_at
  ON public.historique_etat_mouvement(created_at);
CREATE INDEX IF NOT EXISTS idx_planning_chambre_motif_blocage
  ON public.planning_chambre(motif_blocage) WHERE motif_blocage IS NOT NULL;

CREATE OR REPLACE FUNCTION public.valider_suivi_planning_chambre()
RETURNS trigger AS $$
DECLARE
  nouveau_etat text;
BEGIN
  SELECT nom INTO nouveau_etat
  FROM public.etat_mouvement
  WHERE id = NEW.id_etat;

  IF nouveau_etat = 'BLOQUE' AND NULLIF(trim(COALESCE(NEW.motif_blocage, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un motif est obligatoire pour marquer un mouvement comme bloque.';
  END IF;

  IF nouveau_etat <> 'BLOQUE' THEN
    NEW.motif_blocage := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.tracer_etat_planning_chambre()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.id_etat IS DISTINCT FROM NEW.id_etat THEN
    INSERT INTO public.historique_etat_mouvement (
      id_planning_chambre,
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
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_valider_suivi_planning_chambre ON public.planning_chambre;
CREATE TRIGGER trigger_valider_suivi_planning_chambre
  BEFORE INSERT OR UPDATE OF id_etat, motif_blocage ON public.planning_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_suivi_planning_chambre();

DROP TRIGGER IF EXISTS trigger_tracer_etat_planning_chambre ON public.planning_chambre;
CREATE TRIGGER trigger_tracer_etat_planning_chambre
  AFTER INSERT OR UPDATE OF id_etat ON public.planning_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.tracer_etat_planning_chambre();

ALTER TABLE public.historique_etat_mouvement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture historique etat mouvement" ON public.historique_etat_mouvement;
DROP POLICY IF EXISTS "Insertion historique etat mouvement" ON public.historique_etat_mouvement;
DROP POLICY IF EXISTS "Suppression historique etat mouvement" ON public.historique_etat_mouvement;

CREATE POLICY "Lecture historique etat mouvement"
  ON public.historique_etat_mouvement FOR SELECT TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Insertion historique etat mouvement"
  ON public.historique_etat_mouvement FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Suppression historique etat mouvement"
  ON public.historique_etat_mouvement FOR DELETE TO authenticated
  USING (public.est_admin(auth.uid()));
