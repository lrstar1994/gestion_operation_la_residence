-- Evolutions de l'outil Travail chambres > Programmer.
-- A executer apres taches_periodiques.sql, taches_chambres.sql et long_sejour_menages.sql.

ALTER TABLE public.tache_periodique_planning
  ADD COLUMN IF NOT EXISTS date_execution date;

UPDATE public.tache_periodique_planning
SET date_execution = date_echeance
WHERE date_execution IS NULL;

ALTER TABLE public.tache_chambre
  ADD COLUMN IF NOT EXISTS date_initiale date,
  ADD COLUMN IF NOT EXISTS date_realisation date,
  ADD COLUMN IF NOT EXISTS est_deplacee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS type_generation varchar(30) NOT NULL DEFAULT 'planning'
    CHECK (type_generation IN ('planning', 'long_sejour', 'manuel'));

UPDATE public.tache_chambre
SET date_initiale = COALESCE(date_initiale, date_mouvement)
WHERE date_initiale IS NULL;

CREATE INDEX IF NOT EXISTS idx_tache_periodique_planning_execution
  ON public.tache_periodique_planning(date_execution);

CREATE UNIQUE INDEX IF NOT EXISTS unique_tache_chambre_manuelle_jour
  ON public.tache_chambre(id_lieu, id_type_mouvement, date_execution)
  WHERE type_generation = 'manuel';

CREATE OR REPLACE FUNCTION public.initialiser_tache_periodique_planning()
RETURNS trigger AS $$
DECLARE
  etat_a_faire_id uuid;
BEGIN
  IF NEW.id_etat IS NULL THEN
    SELECT id INTO etat_a_faire_id FROM public.etat_mouvement WHERE nom = 'A_FAIRE';
    NEW.id_etat := etat_a_faire_id;
  END IF;

  IF NEW.date_echeance_originale IS NULL THEN
    NEW.date_echeance_originale := NEW.date_echeance;
  END IF;

  IF NEW.date_execution IS NULL THEN
    NEW.date_execution := NEW.date_echeance;
  END IF;

  IF NEW.est_reportee = true AND NULLIF(trim(COALESCE(NEW.motif_report, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Un motif est obligatoire pour reporter une tache.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

SELECT pg_notify('pgrst', 'reload schema');
