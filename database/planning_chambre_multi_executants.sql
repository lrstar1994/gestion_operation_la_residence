-- Permet d'affecter plusieurs executants a un mouvement chambre et a un travail chambre.
-- Les colonnes historiques id_executant restent en place pour compatibilite.

CREATE TABLE IF NOT EXISTS public.planning_chambre_executant (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_planning_chambre uuid NOT NULL REFERENCES public.planning_chambre(id) ON DELETE CASCADE,
  id_executant uuid NOT NULL REFERENCES public.executant(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_planning_chambre_executant UNIQUE (id_planning_chambre, id_executant)
);

CREATE INDEX IF NOT EXISTS idx_planning_chambre_executant_planning
  ON public.planning_chambre_executant(id_planning_chambre);

CREATE INDEX IF NOT EXISTS idx_planning_chambre_executant_executant
  ON public.planning_chambre_executant(id_executant);

CREATE TABLE IF NOT EXISTS public.tache_chambre_executant (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_tache_chambre uuid NOT NULL REFERENCES public.tache_chambre(id) ON DELETE CASCADE,
  id_executant uuid NOT NULL REFERENCES public.executant(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unique_tache_chambre_executant UNIQUE (id_tache_chambre, id_executant)
);

CREATE INDEX IF NOT EXISTS idx_tache_chambre_executant_tache
  ON public.tache_chambre_executant(id_tache_chambre);

CREATE INDEX IF NOT EXISTS idx_tache_chambre_executant_executant
  ON public.tache_chambre_executant(id_executant);

INSERT INTO public.planning_chambre_executant (id_planning_chambre, id_executant)
SELECT id, id_executant
FROM public.planning_chambre
WHERE id_executant IS NOT NULL
ON CONFLICT (id_planning_chambre, id_executant) DO NOTHING;

INSERT INTO public.tache_chambre_executant (id_tache_chambre, id_executant)
SELECT id, id_executant
FROM public.tache_chambre
WHERE id_executant IS NOT NULL
ON CONFLICT (id_tache_chambre, id_executant) DO NOTHING;

INSERT INTO public.tache_chambre_executant (id_tache_chambre, id_executant)
SELECT tc.id, pce.id_executant
FROM public.tache_chambre tc
JOIN public.planning_chambre_executant pce ON pce.id_planning_chambre = tc.id_planning_chambre
ON CONFLICT (id_tache_chambre, id_executant) DO NOTHING;

ALTER TABLE public.planning_chambre_executant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tache_chambre_executant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture executants planning chambre" ON public.planning_chambre_executant;
DROP POLICY IF EXISTS "Gestion executants planning chambre" ON public.planning_chambre_executant;
DROP POLICY IF EXISTS "Lecture executants tache chambre" ON public.tache_chambre_executant;
DROP POLICY IF EXISTS "Gestion executants tache chambre" ON public.tache_chambre_executant;

CREATE POLICY "Lecture executants planning chambre"
  ON public.planning_chambre_executant FOR SELECT TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Gestion executants planning chambre"
  ON public.planning_chambre_executant FOR ALL TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()))
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Lecture executants tache chambre"
  ON public.tache_chambre_executant FOR SELECT TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Gestion executants tache chambre"
  ON public.tache_chambre_executant FOR ALL TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()))
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_planning_chambre_executant_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id_executant IS NOT NULL THEN
    INSERT INTO public.planning_chambre_executant (id_planning_chambre, id_executant)
    VALUES (NEW.id, NEW.id_executant)
    ON CONFLICT (id_planning_chambre, id_executant) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_planning_chambre_executant_principal ON public.planning_chambre;
CREATE TRIGGER trigger_sync_planning_chambre_executant_principal
  AFTER INSERT OR UPDATE OF id_executant ON public.planning_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_planning_chambre_executant_principal();

CREATE OR REPLACE FUNCTION public.sync_tache_chambre_executant_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id_executant IS NOT NULL THEN
    INSERT INTO public.tache_chambre_executant (id_tache_chambre, id_executant)
    VALUES (NEW.id, NEW.id_executant)
    ON CONFLICT (id_tache_chambre, id_executant) DO NOTHING;
  END IF;

  IF NEW.id_planning_chambre IS NOT NULL THEN
    INSERT INTO public.tache_chambre_executant (id_tache_chambre, id_executant)
    SELECT NEW.id, pce.id_executant
    FROM public.planning_chambre_executant pce
    WHERE pce.id_planning_chambre = NEW.id_planning_chambre
    ON CONFLICT (id_tache_chambre, id_executant) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_tache_chambre_executant_principal ON public.tache_chambre;
CREATE TRIGGER trigger_sync_tache_chambre_executant_principal
  AFTER INSERT OR UPDATE OF id_executant, id_planning_chambre ON public.tache_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tache_chambre_executant_principal();
