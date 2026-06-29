create type public.domaine_operation as enum (
    'maintenance',
    'chambres',
    'salles'
);

create type public.role_utilisateur as enum (
    'admin',
    'coordinateur'
);

create table public.utilisateurs (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    nom text not null,
    role public.role_utilisateur not null default 'coordinateur',
    domaines_autorises public.domaine_operation[] not null default '{}',
    statut integer not null default 0, -- 1 = actif, 0 = inactif
    CONSTRAINT check_coordinateur_domaines CHECK (
    (role = 'admin' AND array_length(domaines_autorises, 1) IS NULL) OR
    (role = 'coordinateur' AND (statut = 0 OR array_length(domaines_autorises, 1) > 0))
  )
);

-- Index pour accélérer les recherches
CREATE INDEX idx_utilisateurs_email ON public.utilisateurs(email);
CREATE INDEX idx_utilisateurs_role ON public.utilisateurs(role);
CREATE INDEX idx_utilisateurs_statut ON public.utilisateurs(statut);

-- Fonction qui s'exécute après l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer l'utilisateur dans la table 'utilisateurs' avec statut inactif (0)
  INSERT INTO public.utilisateurs (id, email, nom, role, statut)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Utilisateur'),
    'coordinateur',  -- Par défaut, le rôle est coordinateur (attente validation)
    0  -- Statut inactif (en attente)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger sur auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- Activer RLS
ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;

-- Fonction non recursive utilisee par les policies RLS.
-- Elle evite de relire public.utilisateurs directement dans une policy de public.utilisateurs.
CREATE OR REPLACE FUNCTION public.est_admin(utilisateur_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.utilisateurs
    WHERE id = utilisateur_id
      AND role = 'admin'
      AND statut = 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 1. Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Les utilisateurs peuvent voir leur propre profil"
  ON public.utilisateurs
  FOR SELECT
  USING (auth.uid() = id);

-- 2. Les admins peuvent voir tous les utilisateurs
CREATE POLICY "Les admins peuvent voir tous les utilisateurs"
  ON public.utilisateurs
  FOR SELECT
  USING (public.est_admin(auth.uid()));

-- 3. Les admins peuvent modifier tous les utilisateurs
CREATE POLICY "Les admins peuvent modifier les utilisateurs"
  ON public.utilisateurs
  FOR UPDATE
  USING (public.est_admin(auth.uid()))
  WITH CHECK (public.est_admin(auth.uid()));

-- 4. Seuls les admins peuvent supprimer des utilisateurs
CREATE POLICY "Seuls les admins peuvent supprimer des utilisateurs"
  ON public.utilisateurs
  FOR DELETE
  USING (public.est_admin(auth.uid()));

