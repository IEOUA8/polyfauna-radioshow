-- POLYFAUNA — corrige un bug latente encontrado en auditoria: las politicas
-- albums_creator_insert/tracks_creator_insert (20260707004654) ya permiten
-- subir contenido a role='club', pero provision_artist_profile_for nunca
-- creaba una fila en artists para ese rol (solo artist/sello/promoter
-- colectivo). AlbumManager.jsx/PodcastManager.jsx resuelven "myArtist" con
-- artists.find(a => a.user_id === ownerId) y si no existe, guardan
-- artist_id: null en silencio (sin error, sin toast) — el contenido de un
-- club quedaria sin atribucion en el sitio publico. Hoy no hay cuentas
-- club creadas todavia, asi que no hay datos huerfanos que reparar.

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
    OR v_profile.role = 'club'
    OR (v_profile.role = 'promoter' AND v_profile.organizer_type = 'collective')
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.artists WHERE user_id = p_profile_id) THEN
    RETURN;
  END IF;

  v_type := CASE
    WHEN v_profile.role = 'sello' THEN 'label'
    WHEN v_profile.role = 'club' THEN 'club'
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

  INSERT INTO public.artists (name, slug, type, bio, image_url, social_links, user_id)
  VALUES (
    COALESCE(v_profile.display_name, 'Artista'),
    v_slug,
    v_type,
    v_profile.bio,
    v_profile.avatar_url,
    COALESCE(v_profile.social_links, '{}'::jsonb),
    p_profile_id
  );
END;
$$;

-- Backfill: por si ya existe alguna cuenta club aprobada sin fila en artists.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles
    WHERE role = 'club'
      AND id NOT IN (SELECT user_id FROM public.artists WHERE user_id IS NOT NULL)
  LOOP
    PERFORM public.provision_artist_profile_for(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
