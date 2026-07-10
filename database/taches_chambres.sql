CREATE TABLE IF NOT EXISTS public.tache_chambre (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_planning_chambre uuid REFERENCES public.planning_chambre(id) ON DELETE SET NULL,
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  id_type_mouvement uuid NOT NULL REFERENCES public.type_mouvement(id),
  date_mouvement date NOT NULL,
  date_execution date NOT NULL,
  date_limite date NOT NULL,
  id_executant uuid REFERENCES public.executant(id) ON DELETE SET NULL,
  id_etat uuid NOT NULL REFERENCES public.etat_mouvement(id),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  urgence varchar(20) NOT NULL DEFAULT 'normale' CHECK (urgence IN ('haute', 'normale', 'basse')),
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_tache_chambre_source UNIQUE (id_planning_chambre),
  CONSTRAINT check_tache_chambre_execution_limite CHECK (date_execution <= date_limite)
);

CREATE INDEX IF NOT EXISTS idx_tache_chambre_execution ON public.tache_chambre(date_execution);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_limite ON public.tache_chambre(date_limite);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_lieu ON public.tache_chambre(id_lieu);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_executant ON public.tache_chambre(id_executant);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_etat ON public.tache_chambre(id_etat);
CREATE INDEX IF NOT EXISTS idx_tache_chambre_planning ON public.tache_chambre(id_planning_chambre);

CREATE OR REPLACE FUNCTION public.valider_tache_chambre()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.date_execution > NEW.date_limite THEN
    RAISE EXCEPTION 'La date execution doit etre avant ou egale a la date limite.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_valider_tache_chambre ON public.tache_chambre;
CREATE TRIGGER trigger_valider_tache_chambre
  BEFORE INSERT OR UPDATE ON public.tache_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_tache_chambre();

ALTER TABLE public.tache_chambre ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture tache chambre" ON public.tache_chambre;
DROP POLICY IF EXISTS "Gestion tache chambre" ON public.tache_chambre;
DROP POLICY IF EXISTS "Modification tache chambre" ON public.tache_chambre;
DROP POLICY IF EXISTS "Suppression tache chambre" ON public.tache_chambre;

CREATE POLICY "Lecture tache chambre"
  ON public.tache_chambre FOR SELECT TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Gestion tache chambre"
  ON public.tache_chambre FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Modification tache chambre"
  ON public.tache_chambre FOR UPDATE TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()))
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Suppression tache chambre"
  ON public.tache_chambre FOR DELETE TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));
