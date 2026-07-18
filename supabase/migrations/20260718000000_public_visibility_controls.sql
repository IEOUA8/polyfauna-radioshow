-- Moderacion reversible de perfiles y contenidos publicos.
-- Los registros existentes permanecen visibles; ocultar nunca elimina datos.

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'artists', 'organizers', 'podcasts', 'blog_articles', 'interviews', 'albums'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
         ADD COLUMN IF NOT EXISTS visibility_reason TEXT,
         ADD COLUMN IF NOT EXISTS visibility_changed_at TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS visibility_changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL',
      target_table
    );
  END LOOP;
END $$;

-- PostgreSQL expande a.* al crear una vista; se recrea para exponer las
-- nuevas columnas de visibilidad agregadas a artists.
CREATE OR REPLACE VIEW public.artists_public
WITH (security_invoker = true) AS
SELECT a.*
FROM public.artists a
LEFT JOIN public.profiles p ON p.id = a.user_id
WHERE p.role IS NULL OR p.role NOT IN ('promoter', 'club');

GRANT SELECT ON public.artists_public TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.content_visibility_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN (
    'artists', 'organizers', 'podcasts', 'blog_articles', 'interviews', 'albums'
  )),
  entity_id    UUID NOT NULL,
  is_public    BOOLEAN NOT NULL,
  reason       TEXT,
  changed_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_visibility_audit_entity_idx
  ON public.content_visibility_audit(entity_type, entity_id, created_at DESC);

ALTER TABLE public.content_visibility_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visibility_audit_admin_read" ON public.content_visibility_audit;
CREATE POLICY "visibility_audit_admin_read" ON public.content_visibility_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- La lectura publica solo recibe elementos visibles. El admin conserva acceso
-- a todo para poder restaurarlo desde el panel. Los propietarios autenticados
-- conservan lectura de su propio registro oculto, pero el trigger inferior les
-- impide cambiar el estado de moderacion.
DROP POLICY IF EXISTS "artists_public_read" ON public.artists;
DROP POLICY IF EXISTS "artists_visible_read" ON public.artists;
CREATE POLICY "artists_visible_read" ON public.artists
  FOR SELECT USING (
    is_public
    OR user_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "organizers_public_read" ON public.organizers;
DROP POLICY IF EXISTS "organizers_visible_read" ON public.organizers;
CREATE POLICY "organizers_visible_read" ON public.organizers
  FOR SELECT USING (
    is_public
    OR owner_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "podcasts_public_read" ON public.podcasts;
DROP POLICY IF EXISTS "podcasts_visible_read" ON public.podcasts;
CREATE POLICY "podcasts_visible_read" ON public.podcasts
  FOR SELECT USING (
    is_public
    OR uploaded_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "blog_articles_public_read" ON public.blog_articles;
DROP POLICY IF EXISTS "blog_articles_visible_read" ON public.blog_articles;
CREATE POLICY "blog_articles_visible_read" ON public.blog_articles
  FOR SELECT USING (
    is_public
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "interviews_public_read" ON public.interviews;
DROP POLICY IF EXISTS "interviews_visible_read" ON public.interviews;
CREATE POLICY "interviews_visible_read" ON public.interviews
  FOR SELECT USING (
    is_public
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "albums_public_read" ON public.albums;
DROP POLICY IF EXISTS "albums_visible_read" ON public.albums;
CREATE POLICY "albums_visible_read" ON public.albums
  FOR SELECT USING (
    is_public
    OR uploaded_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "tracks_public_read" ON public.tracks;
DROP POLICY IF EXISTS "tracks_visible_read" ON public.tracks;
CREATE POLICY "tracks_visible_read" ON public.tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = tracks.album_id AND albums.is_public
    )
    OR EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = tracks.album_id AND albums.uploaded_by = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- La tarjeta rotatoria del panel derecho debe respetar la moderacion incluso
-- cuando quien navega es un admin (que por RLS puede leer tambien ocultos).
CREATE OR REPLACE FUNCTION public.get_rotating_artists(p_limit INT DEFAULT 8)
RETURNS TABLE (id UUID, name TEXT, slug TEXT, image_url TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id, a.name, a.slug, a.image_url
  FROM public.artists_public a
  WHERE a.is_public
  ORDER BY md5(a.id::text || (floor(extract(epoch FROM now()) / 1500))::text)
  LIMIT p_limit;
$$;

-- Evita que un propietario penalizado se vuelva a publicar mediante una
-- llamada directa a la API. Solo admin (o service_role) puede tocar estos
-- cuatro campos, aun cuando otras policies permitan editar el contenido.
CREATE OR REPLACE FUNCTION public.guard_public_visibility_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(NEW.is_public, NEW.visibility_reason, NEW.visibility_changed_at, NEW.visibility_changed_by)
       IS DISTINCT FROM
     ROW(OLD.is_public, OLD.visibility_reason, OLD.visibility_changed_at, OLD.visibility_changed_by)
    AND COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar la visibilidad publica'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'artists', 'organizers', 'podcasts', 'blog_articles', 'interviews', 'albums'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_public_visibility ON public.%I', target_table);
    EXECUTE format(
      'CREATE TRIGGER guard_public_visibility
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.guard_public_visibility_fields()',
      target_table
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_public_visibility(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_is_public BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  clean_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar la visibilidad publica'
      USING ERRCODE = '42501';
  END IF;

  IF p_entity_type NOT IN (
    'artists', 'organizers', 'podcasts', 'blog_articles', 'interviews', 'albums'
  ) THEN
    RAISE EXCEPTION 'Tipo de entidad no permitido: %', p_entity_type
      USING ERRCODE = '22023';
  END IF;

  IF NOT p_is_public AND clean_reason IS NULL THEN
    RAISE EXCEPTION 'Debes registrar el motivo para ocultar el elemento'
      USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'UPDATE public.%I AS target
        SET is_public = $1,
            visibility_reason = $2,
            visibility_changed_at = NOW(),
            visibility_changed_by = $3
      WHERE target.id = $4
      RETURNING to_jsonb(target)',
    p_entity_type
  )
  INTO result
  USING p_is_public, clean_reason, (SELECT auth.uid()), p_entity_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'No se encontro el elemento solicitado'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.content_visibility_audit (
    entity_type, entity_id, is_public, reason, changed_by
  ) VALUES (
    p_entity_type, p_entity_id, p_is_public, clean_reason, (SELECT auth.uid())
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_public_visibility(TEXT, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_public_visibility(TEXT, UUID, BOOLEAN, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
