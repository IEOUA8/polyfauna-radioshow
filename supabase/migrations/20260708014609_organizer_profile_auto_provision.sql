-- POLYFAUNA — auto-provisiona la ficha publica de Colonia (organizers) al
-- aprobar rol promoter/club, mismo patron que ya existe para Artists &
-- Labels (ver 20260707004654_artist_label_content_linkage.sql). Sin esto,
-- una cuenta promoter/club nunca tenia fila en organizers y Colonia se
-- veia vacia aunque el rol ya estuviera aprobado.

ALTER TABLE public.organizers
  DROP CONSTRAINT IF EXISTS organizers_owner_id_unique;
ALTER TABLE public.organizers
  ADD CONSTRAINT organizers_owner_id_unique UNIQUE (owner_id);

CREATE OR REPLACE FUNCTION public.provision_organizer_profile_for(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_type TEXT;
  v_base_slug TEXT;
  v_slug TEXT;
  v_suffix INT := 0;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF NOT (v_profile.role = 'promoter' OR v_profile.role = 'club') THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizers WHERE owner_id = p_profile_id) THEN
    RETURN;
  END IF;

  v_type := CASE
    WHEN v_profile.role = 'club' THEN 'club'
    WHEN v_profile.organizer_type = 'collective' THEN 'collective'
    ELSE 'promoter'
  END;

  v_base_slug := COALESCE(
    NULLIF(regexp_replace(regexp_replace(lower(trim(v_profile.display_name)), '[^a-z0-9\s-]', '', 'g'), '\s+', '-', 'g'), ''),
    'organizador-' || substr(p_profile_id::text, 1, 8)
  );
  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizers WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  INSERT INTO public.organizers (name, slug, type, bio, image_url, city, social_links, owner_id)
  VALUES (
    COALESCE(v_profile.display_name, 'Organizador'),
    v_slug,
    v_type,
    v_profile.bio,
    v_profile.avatar_url,
    v_profile.city,
    COALESCE(v_profile.social_links, '{}'::jsonb),
    p_profile_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_ensure_organizer_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_organizer_profile_for(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_organizer_profile ON public.profiles;
CREATE TRIGGER profiles_ensure_organizer_profile
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_ensure_organizer_profile();

REVOKE ALL ON FUNCTION public.provision_organizer_profile_for(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_ensure_organizer_profile() FROM PUBLIC, anon, authenticated;

-- Backfill: cuentas promoter/club ya aprobadas antes de este cambio (incluye
-- a los 3 promotores existentes hoy sin fila en organizers).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles
    WHERE role IN ('promoter', 'club')
      AND id NOT IN (SELECT owner_id FROM public.organizers WHERE owner_id IS NOT NULL)
  LOOP
    PERFORM public.provision_organizer_profile_for(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
