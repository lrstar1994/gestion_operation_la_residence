CREATE TABLE IF NOT EXISTS public.type_intervention_maintenance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(100) NOT NULL UNIQUE,
  est_actif boolean DEFAULT true
);

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

INSERT INTO public.type_intervention_maintenance (nom)
VALUES
  ('Tapisserie'),
  ('Capitonnage'),
  ('Finition meubles')
ON CONFLICT (nom) DO NOTHING;

ALTER TABLE public.intervention_maintenance
ADD COLUMN IF NOT EXISTS id_type_intervention uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'intervention_maintenance'
      AND column_name = 'type_intervention'
  ) THEN
    EXECUTE $sql$
      UPDATE public.intervention_maintenance intervention
      SET id_type_intervention = type_ref.id
      FROM public.type_intervention_maintenance type_ref
      WHERE intervention.id_type_intervention IS NULL
        AND type_ref.nom = COALESCE(intervention.type_intervention, 'Autre')
    $sql$;
  END IF;
END;
$$;

UPDATE public.intervention_maintenance intervention
SET id_type_intervention = type_ref.id
FROM public.type_intervention_maintenance type_ref
WHERE intervention.id_type_intervention IS NULL
  AND type_ref.nom = 'Autre';

ALTER TABLE public.intervention_maintenance
ALTER COLUMN id_type_intervention SET NOT NULL;

ALTER TABLE public.intervention_maintenance
DROP CONSTRAINT IF EXISTS intervention_maintenance_id_type_intervention_fkey;

ALTER TABLE public.intervention_maintenance
ADD CONSTRAINT intervention_maintenance_id_type_intervention_fkey
FOREIGN KEY (id_type_intervention)
REFERENCES public.type_intervention_maintenance(id);

DROP INDEX IF EXISTS public.idx_intervention_maintenance_type;

CREATE INDEX IF NOT EXISTS idx_intervention_maintenance_type
ON public.intervention_maintenance(id_type_intervention);

ALTER TABLE public.intervention_maintenance
DROP CONSTRAINT IF EXISTS check_type_intervention_maintenance;

ALTER TABLE public.intervention_maintenance
DROP COLUMN IF EXISTS type_intervention;

ALTER TABLE public.type_intervention_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture types intervention maintenance" ON public.type_intervention_maintenance;
DROP POLICY IF EXISTS "Gestion types intervention maintenance" ON public.type_intervention_maintenance;
DROP POLICY IF EXISTS "Modification types intervention maintenance" ON public.type_intervention_maintenance;
DROP POLICY IF EXISTS "Suppression types intervention maintenance" ON public.type_intervention_maintenance;

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
