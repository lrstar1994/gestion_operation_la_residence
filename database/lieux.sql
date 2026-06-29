CREATE TABLE IF NOT EXISTS public.batiments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code varchar(10) NOT NULL UNIQUE,
  nom varchar(100) NOT NULL,
  id_executant_defaut uuid REFERENCES public.executant(id) ON DELETE SET NULL
);

ALTER TABLE public.batiments
  ADD COLUMN IF NOT EXISTS id_executant_defaut uuid REFERENCES public.executant(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.categories_lieu (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code varchar(20) NOT NULL UNIQUE,
  nom varchar(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.lieux (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom varchar(100) NOT NULL,
  code varchar(50) UNIQUE,
  id_batiment uuid REFERENCES public.batiments(id) ON DELETE SET NULL,
  id_categorie uuid NOT NULL REFERENCES public.categories_lieu(id),
  numero varchar(10),
  est_actif boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_lieux_id_batiment ON public.lieux(id_batiment);
CREATE INDEX IF NOT EXISTS idx_lieux_id_categorie ON public.lieux(id_categorie);
CREATE INDEX IF NOT EXISTS idx_lieux_numero ON public.lieux(numero);
CREATE INDEX IF NOT EXISTS idx_lieux_est_actif ON public.lieux(est_actif);
CREATE INDEX IF NOT EXISTS idx_batiments_code ON public.batiments(code);
CREATE INDEX IF NOT EXISTS idx_batiments_id_executant_defaut ON public.batiments(id_executant_defaut);
CREATE INDEX IF NOT EXISTS idx_categories_lieu_code ON public.categories_lieu(code);

ALTER TABLE public.batiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories_lieu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lieux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les utilisateurs authentifies peuvent voir les batiments" ON public.batiments;
DROP POLICY IF EXISTS "Seuls les admins peuvent creer les batiments" ON public.batiments;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier les batiments" ON public.batiments;
DROP POLICY IF EXISTS "Seuls les admins peuvent supprimer les batiments" ON public.batiments;

DROP POLICY IF EXISTS "Les utilisateurs authentifies peuvent voir les categories lieu" ON public.categories_lieu;
DROP POLICY IF EXISTS "Seuls les admins peuvent creer les categories lieu" ON public.categories_lieu;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier les categories lieu" ON public.categories_lieu;
DROP POLICY IF EXISTS "Seuls les admins peuvent supprimer les categories lieu" ON public.categories_lieu;

DROP POLICY IF EXISTS "Les utilisateurs authentifies peuvent voir les lieux" ON public.lieux;
DROP POLICY IF EXISTS "Seuls les admins peuvent creer les lieux" ON public.lieux;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier les lieux" ON public.lieux;
DROP POLICY IF EXISTS "Seuls les admins peuvent supprimer les lieux" ON public.lieux;

CREATE POLICY "Les utilisateurs authentifies peuvent voir les batiments"
  ON public.batiments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Seuls les admins peuvent creer les batiments"
  ON public.batiments FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent modifier les batiments"
  ON public.batiments FOR UPDATE TO authenticated
  USING (public.est_admin(auth.uid()))
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent supprimer les batiments"
  ON public.batiments FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));

CREATE POLICY "Les utilisateurs authentifies peuvent voir les categories lieu"
  ON public.categories_lieu FOR SELECT TO authenticated USING (true);

CREATE POLICY "Seuls les admins peuvent creer les categories lieu"
  ON public.categories_lieu FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent modifier les categories lieu"
  ON public.categories_lieu FOR UPDATE TO authenticated
  USING (public.est_admin(auth.uid()))
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent supprimer les categories lieu"
  ON public.categories_lieu FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));

CREATE POLICY "Les utilisateurs authentifies peuvent voir les lieux"
  ON public.lieux FOR SELECT TO authenticated USING (true);

CREATE POLICY "Seuls les admins peuvent creer les lieux"
  ON public.lieux FOR INSERT TO authenticated WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent modifier les lieux"
  ON public.lieux FOR UPDATE TO authenticated
  USING (public.est_admin(auth.uid()))
  WITH CHECK (public.est_admin(auth.uid()));

CREATE POLICY "Seuls les admins peuvent supprimer les lieux"
  ON public.lieux FOR DELETE TO authenticated USING (public.est_admin(auth.uid()));
