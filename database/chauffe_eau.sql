CREATE TABLE IF NOT EXISTS public.chauffe_eau_action (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  id_planning_chambre uuid REFERENCES public.planning_chambre(id) ON DELETE SET NULL,
  date_action date NOT NULL,
  type_action varchar(20) NOT NULL CHECK (type_action IN ('ALLUMER', 'ETEINDRE')),
  etat varchar(20) NOT NULL DEFAULT 'A_FAIRE' CHECK (etat IN ('A_FAIRE', 'TERMINE', 'BLOQUE')),
  commentaire text,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_chauffe_eau_action UNIQUE (id_lieu, date_action, type_action)
);

CREATE INDEX IF NOT EXISTS idx_chauffe_eau_action_date ON public.chauffe_eau_action(date_action);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_action_lieu ON public.chauffe_eau_action(id_lieu);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_action_etat ON public.chauffe_eau_action(etat);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_action_type ON public.chauffe_eau_action(type_action);

CREATE OR REPLACE FUNCTION public.valider_chauffe_eau_action()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.etat = 'BLOQUE' AND NULLIF(trim(COALESCE(NEW.commentaire, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un commentaire est obligatoire pour bloquer une action chauffe-eau.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_valider_chauffe_eau_action ON public.chauffe_eau_action;
CREATE TRIGGER trigger_valider_chauffe_eau_action
  BEFORE INSERT OR UPDATE ON public.chauffe_eau_action
  FOR EACH ROW
  EXECUTE FUNCTION public.valider_chauffe_eau_action();

CREATE OR REPLACE FUNCTION public.creer_chauffe_eau_depuis_planning()
RETURNS trigger AS $$
DECLARE
  type_nom text;
  action_date date;
  action_type text;
BEGIN
  SELECT upper(nom) INTO type_nom
  FROM public.type_mouvement
  WHERE id = NEW.id_type_mouvement;

  IF type_nom LIKE '%ARRIVEE%' THEN
    action_date := NEW.date - 1;
    action_type := 'ALLUMER';
  ELSIF type_nom LIKE '%DEPART%' THEN
    action_date := NEW.date;
    action_type := 'ETEINDRE';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.chauffe_eau_action (
    id_lieu,
    id_planning_chambre,
    date_action,
    type_action,
    etat,
    commentaire
  )
  VALUES (
    NEW.id_lieu,
    NEW.id,
    action_date,
    action_type,
    'A_FAIRE',
    NULL
  )
  ON CONFLICT (id_lieu, date_action, type_action) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_creer_chauffe_eau_depuis_planning ON public.planning_chambre;
CREATE TRIGGER trigger_creer_chauffe_eau_depuis_planning
  AFTER INSERT OR UPDATE OF id_lieu, date, id_type_mouvement ON public.planning_chambre
  FOR EACH ROW
  EXECUTE FUNCTION public.creer_chauffe_eau_depuis_planning();

ALTER TABLE public.chauffe_eau_action ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture chauffe eau" ON public.chauffe_eau_action;
DROP POLICY IF EXISTS "Insertion chauffe eau" ON public.chauffe_eau_action;
DROP POLICY IF EXISTS "Modification chauffe eau" ON public.chauffe_eau_action;
DROP POLICY IF EXISTS "Suppression chauffe eau" ON public.chauffe_eau_action;

CREATE POLICY "Lecture chauffe eau"
  ON public.chauffe_eau_action FOR SELECT TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Insertion chauffe eau"
  ON public.chauffe_eau_action FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Modification chauffe eau"
  ON public.chauffe_eau_action FOR UPDATE TO authenticated
  USING (public.peut_gerer_planning_chambre(auth.uid()))
  WITH CHECK (public.peut_gerer_planning_chambre(auth.uid()));

CREATE POLICY "Suppression chauffe eau"
  ON public.chauffe_eau_action FOR DELETE TO authenticated
  USING (public.est_admin(auth.uid()));
