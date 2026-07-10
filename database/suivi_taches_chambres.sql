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
