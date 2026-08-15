-- Ordonnancement manuel des interventions de maintenance.
-- A executer dans Supabase SQL Editor apres interventions_maintenance.sql.

ALTER TABLE public.intervention_maintenance
  ADD COLUMN IF NOT EXISTS ordre_realisation integer,
  ADD COLUMN IF NOT EXISTS position_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS position_updated_by uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.historique_ordre_intervention_maintenance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_intervention uuid REFERENCES public.intervention_maintenance(id) ON DELETE CASCADE,
  id_type_intervention uuid REFERENCES public.type_intervention_maintenance(id) ON DELETE SET NULL,
  ancienne_position integer,
  nouvelle_position integer,
  modifie_par uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intervention_maintenance_ordre_type
  ON public.intervention_maintenance(id_type_intervention, ordre_realisation);

CREATE INDEX IF NOT EXISTS idx_intervention_maintenance_ordre_etat
  ON public.intervention_maintenance(id_type_intervention, id_etat, ordre_realisation);

CREATE INDEX IF NOT EXISTS idx_historique_ordre_intervention_intervention
  ON public.historique_ordre_intervention_maintenance(id_intervention, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_historique_ordre_intervention_type
  ON public.historique_ordre_intervention_maintenance(id_type_intervention, created_at DESC);

WITH etats_file AS (
  SELECT id
  FROM public.etat_mouvement
  WHERE nom IN ('AFFECTE', 'BLOQUE')
),
interventions_a_positionner AS (
  SELECT
    intervention.id,
    row_number() OVER (
      PARTITION BY intervention.id_type_intervention
      ORDER BY intervention.date_intervention ASC, intervention.heure_debut ASC NULLS LAST, intervention.created_at ASC
    ) AS position
  FROM public.intervention_maintenance intervention
  WHERE intervention.est_actif = true
    AND intervention.ordre_realisation IS NULL
    AND intervention.id_etat IN (SELECT id FROM etats_file)
    AND NOT EXISTS (
      SELECT 1
      FROM public.intervention_maintenance deja_positionnee
      WHERE deja_positionnee.ordre_realisation IS NOT NULL
    )
)
UPDATE public.intervention_maintenance intervention
SET ordre_realisation = interventions_a_positionner.position
FROM interventions_a_positionner
WHERE intervention.id = interventions_a_positionner.id;

CREATE OR REPLACE FUNCTION public.nettoyer_ordre_intervention_maintenance()
RETURNS trigger AS $$
DECLARE
  etat_nom text;
BEGIN
  IF NEW.id_type_intervention IS DISTINCT FROM OLD.id_type_intervention THEN
    NEW.ordre_realisation := NULL;
  END IF;

  SELECT nom INTO etat_nom
  FROM public.etat_mouvement
  WHERE id = NEW.id_etat;

  IF etat_nom NOT IN ('AFFECTE', 'BLOQUE') THEN
    NEW.ordre_realisation := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_nettoyer_ordre_intervention_maintenance ON public.intervention_maintenance;
CREATE TRIGGER trigger_nettoyer_ordre_intervention_maintenance
  BEFORE UPDATE OF id_etat, id_type_intervention ON public.intervention_maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.nettoyer_ordre_intervention_maintenance();

CREATE OR REPLACE FUNCTION public.reordonner_interventions_maintenance(
  p_id_type_intervention uuid,
  p_interventions uuid[]
)
RETURNS void AS $$
DECLARE
  intervention_item record;
  ancienne_position integer;
  nouvelle_position integer;
  utilisateur_id uuid := auth.uid();
BEGIN
  IF NOT public.peut_gerer_interventions_maintenance(utilisateur_id) THEN
    RAISE EXCEPTION 'Acces refuse.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_id_type_intervention::text));

  FOR intervention_item IN
    SELECT intervention.id, intervention.ordre_realisation
    FROM public.intervention_maintenance intervention
    JOIN public.etat_mouvement etat ON etat.id = intervention.id_etat
    WHERE intervention.id_type_intervention = p_id_type_intervention
      AND intervention.est_actif = true
      AND etat.nom IN ('AFFECTE', 'BLOQUE')
      AND NOT (intervention.id = ANY(p_interventions))
      AND intervention.ordre_realisation IS NOT NULL
    FOR UPDATE
  LOOP
    ancienne_position := intervention_item.ordre_realisation;

    UPDATE public.intervention_maintenance
    SET ordre_realisation = NULL,
        position_updated_at = now(),
        position_updated_by = utilisateur_id
    WHERE id = intervention_item.id;

    INSERT INTO public.historique_ordre_intervention_maintenance (
      id_intervention,
      id_type_intervention,
      ancienne_position,
      nouvelle_position,
      modifie_par
    )
    VALUES (
      intervention_item.id,
      p_id_type_intervention,
      ancienne_position,
      NULL,
      utilisateur_id
    );
  END LOOP;

  FOR intervention_item IN
    SELECT intervention.id, intervention.ordre_realisation, ordre.position
    FROM unnest(p_interventions) WITH ORDINALITY AS ordre(id, position)
    JOIN public.intervention_maintenance intervention ON intervention.id = ordre.id
    JOIN public.etat_mouvement etat ON etat.id = intervention.id_etat
    WHERE intervention.id_type_intervention = p_id_type_intervention
      AND intervention.est_actif = true
      AND etat.nom IN ('AFFECTE', 'BLOQUE')
    ORDER BY ordre.position
    FOR UPDATE OF intervention
  LOOP
    ancienne_position := intervention_item.ordre_realisation;
    nouvelle_position := intervention_item.position;

    IF ancienne_position IS DISTINCT FROM nouvelle_position THEN
      UPDATE public.intervention_maintenance
      SET ordre_realisation = nouvelle_position,
          position_updated_at = now(),
          position_updated_by = utilisateur_id
      WHERE id = intervention_item.id;

      INSERT INTO public.historique_ordre_intervention_maintenance (
        id_intervention,
        id_type_intervention,
        ancienne_position,
        nouvelle_position,
        modifie_par
      )
      VALUES (
        intervention_item.id,
        p_id_type_intervention,
        ancienne_position,
        nouvelle_position,
        utilisateur_id
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.historique_ordre_intervention_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture historique ordre intervention maintenance" ON public.historique_ordre_intervention_maintenance;
DROP POLICY IF EXISTS "Insertion historique ordre intervention maintenance" ON public.historique_ordre_intervention_maintenance;
DROP POLICY IF EXISTS "Suppression historique ordre intervention maintenance" ON public.historique_ordre_intervention_maintenance;

CREATE POLICY "Lecture historique ordre intervention maintenance"
  ON public.historique_ordre_intervention_maintenance FOR SELECT TO authenticated
  USING (public.peut_gerer_interventions_maintenance(auth.uid()));

CREATE POLICY "Insertion historique ordre intervention maintenance"
  ON public.historique_ordre_intervention_maintenance FOR INSERT TO authenticated
  WITH CHECK (public.peut_gerer_interventions_maintenance(auth.uid()));

CREATE POLICY "Suppression historique ordre intervention maintenance"
  ON public.historique_ordre_intervention_maintenance FOR DELETE TO authenticated
  USING (public.est_admin(auth.uid()));
