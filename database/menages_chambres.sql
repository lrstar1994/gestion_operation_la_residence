-- Module menages chambres
-- A executer dans Supabase pour ajouter le mouvement manuel de menage.

INSERT INTO public.type_mouvement (nom, points)
VALUES ('MENAGE', 2)
ON CONFLICT (nom) DO UPDATE
SET points = EXCLUDED.points;
