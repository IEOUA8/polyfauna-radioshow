-- Visibilidad controlada por el creador, separada de la moderacion admin.
-- Efectivo en publico = is_public (admin) AND creator_is_public (propietario).

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['podcasts', 'albums', 'events'] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS creator_is_public BOOLEAN NOT NULL DEFAULT true,
         ADD COLUMN IF NOT EXISTS creator_visibility_changed_at TIMESTAMPTZ',
      target_table
    );
  END LOOP;
END $$;

-- Los eventos entran tambien a la capa de moderacion administrativa.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibility_reason TEXT,
  ADD COLUMN IF NOT EXISTS visibility_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visibility_changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.content_visibility_audit
  DROP CONSTRAINT IF EXISTS content_visibility_audit_entity_type_check;
ALTER TABLE public.content_visibility_audit
  ADD CONSTRAINT content_visibility_audit_entity_type_check
  CHECK (entity_type IN (
    'artists', 'organizers', 'podcasts', 'blog_articles', 'interviews', 'albums', 'events'
  ));

DROP TRIGGER IF EXISTS guard_public_visibility ON public.events;
CREATE TRIGGER guard_public_visibility
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_public_visibility_fields();

-- Actualiza la RPC de moderacion para aceptar tambien eventos.
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
    'artists', 'organizers', 'podcasts', 'blog_articles', 'interviews', 'albums', 'events'
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

CREATE TABLE IF NOT EXISTS public.creator_visibility_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('podcasts', 'albums', 'events')),
  entity_id    UUID NOT NULL,
  is_public    BOOLEAN NOT NULL,
  changed_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_visibility_audit_entity_idx
  ON public.creator_visibility_audit(entity_type, entity_id, created_at DESC);

ALTER TABLE public.creator_visibility_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_visibility_audit_access" ON public.creator_visibility_audit;
CREATE POLICY "creator_visibility_audit_access" ON public.creator_visibility_audit
  FOR SELECT TO authenticated
  USING (
    changed_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.set_creator_visibility(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_is_public BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  owns_entity BOOLEAN := false;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesion'
      USING ERRCODE = '42501';
  END IF;

  CASE p_entity_type
    WHEN 'podcasts' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.podcasts
        WHERE id = p_entity_id AND uploaded_by = (SELECT auth.uid())
      ) INTO owns_entity;
    WHEN 'albums' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.albums
        WHERE id = p_entity_id AND uploaded_by = (SELECT auth.uid())
      ) INTO owns_entity;
    WHEN 'events' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.events
        WHERE id = p_entity_id AND owner_id = (SELECT auth.uid())
      ) INTO owns_entity;
    ELSE
      RAISE EXCEPTION 'Tipo de entidad no permitido: %', p_entity_type
        USING ERRCODE = '22023';
  END CASE;

  IF NOT owns_entity THEN
    RAISE EXCEPTION 'Solo el creador puede cambiar esta visibilidad'
      USING ERRCODE = '42501';
  END IF;

  EXECUTE format(
    'UPDATE public.%I AS target
        SET creator_is_public = $1,
            creator_visibility_changed_at = NOW()
      WHERE target.id = $2
      RETURNING to_jsonb(target)',
    p_entity_type
  )
  INTO result
  USING p_is_public, p_entity_id;

  INSERT INTO public.creator_visibility_audit (
    entity_type, entity_id, is_public, changed_by
  ) VALUES (
    p_entity_type, p_entity_id, p_is_public, (SELECT auth.uid())
  );

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_creator_visibility(TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_creator_visibility(TEXT, UUID, BOOLEAN) TO authenticated;

-- Conserva el acceso al detalle del evento para quienes ya tienen ticket,
-- aunque el organizador retire el evento de la cartelera publica.
CREATE OR REPLACE FUNCTION public.current_user_has_event_ticket(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tickets
    WHERE event_id = p_event_id
      AND user_id = (SELECT auth.uid())
      AND status NOT IN ('cancelled', 'refunded')
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_event_ticket(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_event_ticket(UUID) TO anon, authenticated;

-- Envuelve la compra gratuita vigente para que un UUID conocido no permita
-- adquirir tickets después de que el creador o un admin oculte el evento.
ALTER FUNCTION public.purchase_ticket(UUID, TEXT)
  RENAME TO purchase_ticket_visibility_impl;

REVOKE ALL ON FUNCTION public.purchase_ticket_visibility_impl(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_ticket(
  p_event_id UUID,
  p_ticket_type TEXT DEFAULT 'General'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  available BOOLEAN;
BEGIN
  SELECT event.is_public AND event.creator_is_public
  INTO available
  FROM public.events AS event
  WHERE event.id = p_event_id;

  IF NOT COALESCE(available, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El evento no esta disponible',
      'code', 'UNAVAILABLE'
    );
  END IF;

  RETURN public.purchase_ticket_visibility_impl(p_event_id, p_ticket_type);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_ticket(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) TO authenticated;

-- Lectura efectiva: ambas capas deben permitir publicacion. Propietarios,
-- co-promotores y admins conservan acceso operativo a los registros ocultos.
DROP POLICY IF EXISTS "podcasts_visible_read" ON public.podcasts;
CREATE POLICY "podcasts_visible_read" ON public.podcasts
  FOR SELECT USING (
    (is_public AND creator_is_public)
    OR uploaded_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "albums_visible_read" ON public.albums;
CREATE POLICY "albums_visible_read" ON public.albums
  FOR SELECT USING (
    (is_public AND creator_is_public)
    OR uploaded_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "tracks_visible_read" ON public.tracks;
CREATE POLICY "tracks_visible_read" ON public.tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = tracks.album_id
        AND albums.is_public
        AND albums.creator_is_public
    )
    OR EXISTS (
      SELECT 1 FROM public.albums
      WHERE albums.id = tracks.album_id AND albums.uploaded_by = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "events_visible_read" ON public.events;
CREATE POLICY "events_visible_read" ON public.events
  FOR SELECT USING (
    (
      status IN ('published', 'upcoming', 'live')
      AND is_public
      AND creator_is_public
    )
    OR (SELECT auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.event_co_promoters
      WHERE event_id = events.id
        AND promoter_id = (SELECT auth.uid())
        AND status = 'active'
    )
    OR public.current_user_has_event_ticket(events.id)
  );

NOTIFY pgrst, 'reload schema';
