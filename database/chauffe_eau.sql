CREATE TABLE IF NOT EXISTS public.chauffe_eau (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code varchar(80) NOT NULL UNIQUE,
  nom varchar(120) NOT NULL,
  description text,
  est_actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chauffe_eau_lieu (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_chauffe_eau uuid NOT NULL REFERENCES public.chauffe_eau(id) ON DELETE CASCADE,
  id_lieu uuid NOT NULL REFERENCES public.lieux(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_chauffe_eau_lieu UNIQUE (id_chauffe_eau, id_lieu)
);

CREATE TABLE IF NOT EXISTS public.chauffe_eau_releve (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_chauffe_eau uuid NOT NULL REFERENCES public.chauffe_eau(id) ON DELETE CASCADE,
  date_releve date NOT NULL,
  heure_demarrage time,
  temperature_debut numeric(5,2),
  heure_debranchement time,
  temperature_fin numeric(5,2),
  heure_controle_fin_matin time,
  temperature_fin_matin numeric(5,2),
  etat_constate varchar(10) NOT NULL CHECK (etat_constate IN ('ON', 'OFF')),
  etat_attendu varchar(10) NOT NULL CHECK (etat_attendu IN ('ON', 'OFF')),
  conforme boolean NOT NULL DEFAULT true,
  id_utilisateur uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_chauffe_eau_releve_jour UNIQUE (id_chauffe_eau, date_releve)
);

CREATE TABLE IF NOT EXISTS public.chauffe_eau_anomalie (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_chauffe_eau uuid NOT NULL REFERENCES public.chauffe_eau(id) ON DELETE CASCADE,
  id_releve uuid REFERENCES public.chauffe_eau_releve(id) ON DELETE SET NULL,
  date_anomalie date NOT NULL,
  type_anomalie varchar(40) NOT NULL CHECK (type_anomalie IN ('CRITIQUE_OFF_OCCUPE', 'ENERGETIQUE_ON_VIDE', 'CONTROLE_MANQUANT')),
  statut varchar(20) NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'terminee', 'validee', 'refusee', 'reprise', 'annulee')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_chauffe_eau_anomalie_jour UNIQUE (id_chauffe_eau, date_anomalie, type_anomalie)
);

CREATE TABLE IF NOT EXISTS public.history_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type varchar(80) NOT NULL,
  entity_id uuid,
  action varchar(80) NOT NULL,
  id_utilisateur uuid REFERENCES public.utilisateurs(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chauffe_eau_actif ON public.chauffe_eau(est_actif);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_lieu_chauffe ON public.chauffe_eau_lieu(id_chauffe_eau);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_lieu_lieu ON public.chauffe_eau_lieu(id_lieu);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_releve_date ON public.chauffe_eau_releve(date_releve);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_releve_conforme ON public.chauffe_eau_releve(conforme);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_anomalie_date ON public.chauffe_eau_anomalie(date_anomalie);
CREATE INDEX IF NOT EXISTS idx_chauffe_eau_anomalie_statut ON public.chauffe_eau_anomalie(statut);
CREATE INDEX IF NOT EXISTS idx_history_events_entity ON public.history_events(entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.peut_gerer_chauffe_eau(uid uuid)
RETURNS boolean AS $$
  SELECT public.est_admin(uid)
    OR EXISTS (
      SELECT 1
      FROM public.utilisateurs u
      WHERE u.id = uid
        AND u.statut = 1
        AND 'maintenance' = ANY(u.domaines_autorises)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_touch_chauffe_eau ON public.chauffe_eau;
CREATE TRIGGER trigger_touch_chauffe_eau
  BEFORE UPDATE ON public.chauffe_eau
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_chauffe_eau_releve ON public.chauffe_eau_releve;
CREATE TRIGGER trigger_touch_chauffe_eau_releve
  BEFORE UPDATE ON public.chauffe_eau_releve
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trigger_touch_chauffe_eau_anomalie ON public.chauffe_eau_anomalie;
CREATE TRIGGER trigger_touch_chauffe_eau_anomalie
  BEFORE UPDATE ON public.chauffe_eau_anomalie
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.tracer_chauffe_eau_event()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.history_events(entity_type, entity_id, action, id_utilisateur, details)
  VALUES (
    TG_TABLE_NAME,
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
    auth.uid(),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_history_chauffe_eau_releve ON public.chauffe_eau_releve;
CREATE TRIGGER trigger_history_chauffe_eau_releve
  AFTER INSERT OR UPDATE ON public.chauffe_eau_releve
  FOR EACH ROW EXECUTE FUNCTION public.tracer_chauffe_eau_event();

DROP TRIGGER IF EXISTS trigger_history_chauffe_eau_anomalie ON public.chauffe_eau_anomalie;
CREATE TRIGGER trigger_history_chauffe_eau_anomalie
  AFTER INSERT OR UPDATE ON public.chauffe_eau_anomalie
  FOR EACH ROW EXECUTE FUNCTION public.tracer_chauffe_eau_event();

ALTER TABLE public.chauffe_eau ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chauffe_eau_lieu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chauffe_eau_releve ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chauffe_eau_anomalie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture chauffe eau" ON public.chauffe_eau;
DROP POLICY IF EXISTS "Gestion chauffe eau" ON public.chauffe_eau;
DROP POLICY IF EXISTS "Lecture chauffe eau lieu" ON public.chauffe_eau_lieu;
DROP POLICY IF EXISTS "Gestion chauffe eau lieu" ON public.chauffe_eau_lieu;
DROP POLICY IF EXISTS "Lecture releves chauffe eau" ON public.chauffe_eau_releve;
DROP POLICY IF EXISTS "Gestion releves chauffe eau" ON public.chauffe_eau_releve;
DROP POLICY IF EXISTS "Lecture anomalies chauffe eau" ON public.chauffe_eau_anomalie;
DROP POLICY IF EXISTS "Gestion anomalies chauffe eau" ON public.chauffe_eau_anomalie;
DROP POLICY IF EXISTS "Lecture history events" ON public.history_events;
DROP POLICY IF EXISTS "Insertion history events" ON public.history_events;

CREATE POLICY "Lecture chauffe eau" ON public.chauffe_eau FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Gestion chauffe eau" ON public.chauffe_eau FOR ALL TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid())) WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Lecture chauffe eau lieu" ON public.chauffe_eau_lieu FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Gestion chauffe eau lieu" ON public.chauffe_eau_lieu FOR ALL TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid())) WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Lecture releves chauffe eau" ON public.chauffe_eau_releve FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Gestion releves chauffe eau" ON public.chauffe_eau_releve FOR ALL TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid())) WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Lecture anomalies chauffe eau" ON public.chauffe_eau_anomalie FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Gestion anomalies chauffe eau" ON public.chauffe_eau_anomalie FOR ALL TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid())) WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Lecture history events" ON public.history_events FOR SELECT TO authenticated USING (public.peut_gerer_chauffe_eau(auth.uid()));
CREATE POLICY "Insertion history events" ON public.history_events FOR INSERT TO authenticated WITH CHECK (public.peut_gerer_chauffe_eau(auth.uid()));

INSERT INTO public.chauffe_eau(code, nom, description)
VALUES
  ('Bat1_101_104', 'Bat1 101-104', 'Chauffe-eau chambres 101, 102, 103, 104'),
  ('Bat1_301_311', 'Bat1 301-311', 'Chauffe-eau chambres 301 et 311'),
  ('Bat1_302', 'Bat1 302', 'Chauffe-eau chambre 302'),
  ('Bat1_401_411', 'Bat1 401-411', 'Chauffe-eau chambres 401 et 411'),
  ('Bat1_402', 'Bat1 402', 'Chauffe-eau chambre 402'),
  ('Bat1_421', 'Bat1 421', 'Chambres a completer'),
  ('Bat1_423', 'Bat1 423', 'Chambres a completer'),
  ('Bat1_406_416', 'Bat1 406-416', 'Chauffe-eau chambres 406 et 416'),
  ('Bat6_global', 'Bat6 global', 'Toutes les chambres du batiment 6')
ON CONFLICT (code) DO UPDATE
SET nom = EXCLUDED.nom,
    description = EXCLUDED.description;

WITH mapping(code_chauffe, numero) AS (
  VALUES
    ('Bat1_101_104', '101'),
    ('Bat1_101_104', '102'),
    ('Bat1_101_104', '103'),
    ('Bat1_101_104', '104'),
    ('Bat1_301_311', '301'),
    ('Bat1_301_311', '311'),
    ('Bat1_302', '302'),
    ('Bat1_401_411', '401'),
    ('Bat1_401_411', '411'),
    ('Bat1_402', '402'),
    ('Bat1_406_416', '406'),
    ('Bat1_406_416', '416')
)
INSERT INTO public.chauffe_eau_lieu(id_chauffe_eau, id_lieu)
SELECT ce.id, l.id
FROM mapping m
JOIN public.chauffe_eau ce ON ce.code = m.code_chauffe
JOIN public.lieux l ON l.numero = m.numero
ON CONFLICT (id_chauffe_eau, id_lieu) DO NOTHING;

INSERT INTO public.chauffe_eau_lieu(id_chauffe_eau, id_lieu)
SELECT ce.id, l.id
FROM public.chauffe_eau ce
JOIN public.batiments b ON b.code IN ('BAT6', 'BAT 6') OR b.nom ILIKE '%BAT 6%'
JOIN public.lieux l ON l.id_batiment = b.id
JOIN public.categories_lieu c ON c.id = l.id_categorie
WHERE ce.code = 'Bat6_global'
  AND (lower(c.code) IN ('chambre', 'chambres') OR lower(c.nom) LIKE '%chambre%')
ON CONFLICT (id_chauffe_eau, id_lieu) DO NOTHING;
