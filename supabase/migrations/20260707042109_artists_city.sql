-- POLYFAUNA — la ficha publica de Artists & Labels tambien muestra la
-- ciudad del artista (visible en la vista de detalle, junto al genero).
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS city TEXT;

-- El auto-provisioning (trigger profiles -> artists) debe copiar la
-- ciudad del perfil tambien al crear la ficha por primera vez.
CREATE OR REPLACE FUNCTION public.provision_artist_profile_for(p_profile_id UUID)
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

  IF NOT (
    v_profile.role = 'artist'
    OR v_profile.role = 'sello'
    OR (v_profile.role = 'promoter' AND v_profile.organizer_type = 'collective')
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.artists WHERE user_id = p_profile_id) THEN
    RETURN;
  END IF;

  v_type := CASE
    WHEN v_profile.role = 'sello' THEN 'label'
    WHEN v_profile.role = 'promoter' THEN 'collective'
    ELSE 'artist'
  END;

  v_base_slug := COALESCE(
    NULLIF(regexp_replace(regexp_replace(lower(trim(v_profile.display_name)), '[^a-z0-9\s-]', '', 'g'), '\s+', '-', 'g'), ''),
    'artista-' || substr(p_profile_id::text, 1, 8)
  );
  v_slug := v_base_slug;
  WHILE EXISTS (SELECT 1 FROM public.artists WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  END LOOP;

  INSERT INTO public.artists (name, slug, type, bio, image_url, social_links, city, user_id)
  VALUES (
    COALESCE(v_profile.display_name, 'Artista'),
    v_slug,
    v_type,
    v_profile.bio,
    v_profile.avatar_url,
    COALESCE(v_profile.social_links, '{}'::jsonb),
    v_profile.city,
    p_profile_id
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
