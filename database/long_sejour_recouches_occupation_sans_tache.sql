-- Les recouches d'un long sejour restent des mouvements hoteliers dans planning_chambre,
-- mais elles ne doivent pas creer de travail quotidien dans tache_chambre.
-- A executer apres database/long_sejour_menages.sql.

CREATE OR REPLACE FUNCTION public.creer_tache_chambre_depuis_planning()
RETURNS trigger AS $$
DECLARE
  executant_defaut uuid;
  executant_a_affecter uuid;
  points_mouvement integer;
  urgence_tache text;
  est_recouche_long_sejour boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.type_mouvement tm
    JOIN public.sejour_chambre sc ON sc.id = NEW.id_sejour_chambre
    WHERE tm.id = NEW.id_type_mouvement
      AND upper(trim(tm.nom)) = 'RECOUCHE'
      AND sc.type_sejour = 'long_sejour'
      AND sc.est_actif = true
  )
  INTO est_recouche_long_sejour;

  IF est_recouche_long_sejour THEN
    DELETE FROM public.tache_chambre tc
    WHERE tc.id_planning_chambre = NEW.id
      AND tc.type_generation = 'planning'
      AND tc.date_realisation IS NULL;

    RETURN NEW;
  END IF;

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

-- Nettoie uniquement les travaux auto non realises qui auraient ete crees a tort
-- depuis une recouche de long sejour. Les mouvements hoteliers restent inchanges.
DELETE FROM public.tache_chambre tc
USING public.planning_chambre pc
JOIN public.type_mouvement tm ON tm.id = pc.id_type_mouvement
JOIN public.sejour_chambre sc ON sc.id = pc.id_sejour_chambre
WHERE tc.id_planning_chambre = pc.id
  AND tc.type_generation = 'planning'
  AND tc.date_realisation IS NULL
  AND upper(trim(tm.nom)) = 'RECOUCHE'
  AND sc.type_sejour = 'long_sejour';

SELECT pg_notify('pgrst', 'reload schema');
