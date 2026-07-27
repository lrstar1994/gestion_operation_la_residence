-- Supprime automatiquement le travail chambre programme quand son mouvement hotelier source est supprime.
-- A executer dans Supabase SQL Editor apres taches_chambres.sql.

DO $$
DECLARE
  contrainte_existante text;
BEGIN
  SELECT conname
  INTO contrainte_existante
  FROM pg_constraint
  WHERE conrelid = 'public.tache_chambre'::regclass
    AND contype = 'f'
    AND array_length(conkey, 1) = 1
    AND conkey[1] = (
      SELECT attnum
      FROM pg_attribute
      WHERE attrelid = 'public.tache_chambre'::regclass
        AND attname = 'id_planning_chambre'
    )
  LIMIT 1;

  IF contrainte_existante IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tache_chambre DROP CONSTRAINT %I', contrainte_existante);
  END IF;
END $$;

ALTER TABLE public.tache_chambre
  ADD CONSTRAINT tache_chambre_id_planning_chambre_fkey
  FOREIGN KEY (id_planning_chambre)
  REFERENCES public.planning_chambre(id)
  ON DELETE CASCADE;
