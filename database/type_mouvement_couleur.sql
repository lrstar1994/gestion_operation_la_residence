-- Ajoute une couleur personnalisable aux types de mouvement.
-- A executer apres database/planning_chambre.sql.

ALTER TABLE public.type_mouvement
  ADD COLUMN IF NOT EXISTS couleur varchar(20) NOT NULL DEFAULT '#64748b';

UPDATE public.type_mouvement
SET couleur = CASE
  WHEN upper(nom) LIKE '%DEPART%' THEN '#e11d48'
  WHEN upper(nom) LIKE '%ARRIVEE%' THEN '#16a34a'
  WHEN upper(nom) LIKE '%RECOUCHE%' THEN '#0284c7'
  WHEN upper(nom) LIKE '%MENAGE%' THEN '#0f766e'
  ELSE couleur
END;

SELECT pg_notify('pgrst', 'reload schema');
