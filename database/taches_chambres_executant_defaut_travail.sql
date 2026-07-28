-- Corrige l'affectation automatique du travail chambre.
-- L'executant par defaut du batiment est utilise seulement s'il est en planning TRAVAIL
-- sur la date du mouvement. Sinon le travail reste Non affecte.

CREATE OR REPLACE FUNCTION public.creer_tache_chambre_depuis_planning()
RETURNS trigger AS $$
DECLARE
  executant_defaut uuid;
  executant_a_affecter uuid;
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
      executant_a_affecter,
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
      id_executant = executant_a_affecter,
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
        executant_a_affecter,
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

-- Realigne les travaux generes automatiquement qui n'ont pas ete deplaces manuellement.
UPDATE public.tache_chambre tc
SET id_executant = CASE
  WHEN pc.id_executant IS NOT NULL THEN pc.id_executant
  WHEN b.id_executant_defaut IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.planning_executant pe
    JOIN public.type_planning tp ON tp.id = pe.id_type_planning
    WHERE pe.id_executant = b.id_executant_defaut
      AND pe.date = pc.date
      AND lower(tp.nom) = 'travail'
  ) THEN b.id_executant_defaut
  ELSE NULL
END
FROM public.planning_chambre pc
JOIN public.lieux l ON l.id = pc.id_lieu
LEFT JOIN public.batiments b ON b.id = l.id_batiment
WHERE tc.id_planning_chambre = pc.id
  AND tc.date_execution = pc.date
  AND tc.date_limite = pc.date;

SELECT pg_notify('pgrst', 'reload schema');
