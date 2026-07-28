-- Nettoyage de l'ancien mecanisme chauffe-eau.
-- Le module actuel n'utilise plus public.chauffe_eau_action.
-- Sans ce nettoyage, l'ancien trigger peut bloquer les insertions dans planning_chambre.

DROP TRIGGER IF EXISTS trigger_creer_chauffe_eau_depuis_planning ON public.planning_chambre;
DROP FUNCTION IF EXISTS public.creer_chauffe_eau_depuis_planning();

-- Optionnel : a executer seulement si tu veux supprimer definitivement l'ancienne table.
-- DROP TABLE IF EXISTS public.chauffe_eau_action;

SELECT pg_notify('pgrst', 'reload schema');
