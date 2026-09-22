-- Ajoute le mouvement d'indisponibilite chambre "EN TRAVAUX".
-- A executer dans l'environnement TEST uniquement, apres database/type_mouvement_couleur.sql.

INSERT INTO public.type_mouvement (nom, points, couleur)
VALUES ('EN TRAVAUX', 0, '#7c3aed')
ON CONFLICT (nom) DO UPDATE
SET
  points = 0,
  couleur = EXCLUDED.couleur;

SELECT pg_notify('pgrst', 'reload schema');
