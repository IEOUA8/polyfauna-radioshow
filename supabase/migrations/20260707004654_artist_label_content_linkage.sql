-- POLYFAUNA — vincula cuentas de usuario con la ficha publica de
-- Artists & Labels, abre Albumes a artist/sello/club/colectivo (igual
-- que Podcasts) y agrega play_count a tracks.

-- ── 1. artists.user_id: vincula la fila publica con la cuenta ──────
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.artists
  DROP CONSTRAINT IF EXISTS artists_user_id_unique;
ALTER TABLE public.artists
  ADD CONSTRAINT artists_user_id_unique UNIQUE (user_id);

-- El dueño vinculado puede editar su propia ficha publica (bio, imagen,
-- generos, redes). El resto de escritura sigue siendo admin/service_role.
DROP POLICY IF EXISTS "artists_owner_update" ON public.artists;
CREATE POLICY "artists_owner_update" ON public.artists
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 2. albums.uploaded_by + RLS (mismo patron que podcasts) ────────
ALTER TABLE public.albums
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "albums_service_write" ON public.albums;

CREATE POLICY "albums_creator_insert" ON public.albums
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (
          role IN ('artist', 'club', 'sello', 'admin')
          OR (role = 'promoter' AND organizer_type = 'collective')
        )
    )
  );

CREATE POLICY "albums_owner_update" ON public.albums
  FOR UPDATE
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "albums_owner_delete" ON public.albums
  FOR DELETE
  USING (uploaded_by = auth.uid());

CREATE POLICY "albums_admin_all" ON public.albums
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "albums_service_all" ON public.albums
  FOR ALL
  USING (auth.role() = 'service_role');

-- ── 3. tracks: mismas policies de creador (tracks siempre van dentro
-- de un album, no tienen uploaded_by propio; se autorizan por el mismo
-- set de roles que puede subir contenido) ──────────────────────────
DROP POLICY IF EXISTS "tracks_service_write" ON public.tracks;

CREATE POLICY "tracks_creator_insert" ON public.tracks
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (
          role IN ('artist', 'club', 'sello', 'admin')
          OR (role = 'promoter' AND organizer_type = 'collective')
        )
    )
  );

CREATE POLICY "tracks_creator_update" ON public.tracks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = tracks.album_id AND albums.uploaded_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = tracks.album_id AND albums.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "tracks_creator_delete" ON public.tracks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = tracks.album_id AND albums.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "tracks_admin_all" ON public.tracks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "tracks_service_all" ON public.tracks
  FOR ALL
  USING (auth.role() = 'service_role');

-- ── 4. play_count en tracks, igual que ya existe en podcasts ───────
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_track_plays(p_track_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tracks SET play_count = play_count + 1 WHERE id = p_track_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_track_plays(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_track_plays(UUID) TO authenticated;

-- ── 5. Auto-provisionar la ficha publica al aprobar el rol ─────────
-- profiles (cuenta privada) y artists (ficha publica en Artists &
-- Labels) eran modelos completamente desconectados: aprobar un rol
-- solo actualizaba profiles.role, nunca creaba/vinculaba una fila en
-- artists. Este trigger crea esa fila automaticamente la primera vez
-- que el perfil califica (artist, sello, o promoter colectivo), sin
-- pisar ediciones posteriores que el propio dueno haga en su ficha.
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

CREATE OR REPLACE FUNCTION public.trg_ensure_artist_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.provision_artist_profile_for(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_artist_profile ON public.profiles;
CREATE TRIGGER profiles_ensure_artist_profile
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_ensure_artist_profile();

REVOKE ALL ON FUNCTION public.provision_artist_profile_for(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_ensure_artist_profile() FROM PUBLIC, anon, authenticated;

-- Backfill: cuentas que ya tenian el rol aprobado antes de este cambio.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles
    WHERE (role IN ('artist','sello') OR (role = 'promoter' AND organizer_type = 'collective'))
      AND id NOT IN (SELECT user_id FROM public.artists WHERE user_id IS NOT NULL)
  LOOP
    PERFORM public.provision_artist_profile_for(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
