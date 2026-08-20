-- Ajoute un executant par defaut specifique a certains lieux/chambres.
-- Priorite applicative attendue : defaut du lieu > defaut du batiment > non affecte.

ALTER TABLE public.lieux
  ADD COLUMN IF NOT EXISTS id_executant_defaut uuid REFERENCES public.executant(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lieux_id_executant_defaut
  ON public.lieux(id_executant_defaut);
