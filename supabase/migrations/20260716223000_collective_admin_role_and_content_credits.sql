-- Expone "colectivo" como tipo administrativo sin introducir un séptimo
-- valor en profiles.role: internamente sigue siendo promoter + collective.
-- También agrega créditos múltiples para álbumes y podcasts, de modo que el
-- contenido pertenezca al perfil que lo publica y aparezca en cada artista
-- etiquetado.

CREATE OR REPLACE FUNCTION public.set_user_role(
  p_user_id UUID,
  p_role TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_role TEXT;
  v_previous_organizer_type TEXT;
  v_stored_role TEXT;
  v_organizer_type TEXT;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_role NOT IN ('citizen','artist','promoter','collective','club','sello','admin') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  v_stored_role := CASE WHEN p_role = 'collective' THEN 'promoter' ELSE p_role END;
  v_organizer_type := CASE
    WHEN p_role = 'collective' THEN 'collective'
    WHEN p_role = 'promoter' THEN 'promoter'
    WHEN p_role = 'club' THEN 'club'
    ELSE NULL
  END;

  IF p_user_id = auth.uid() AND v_stored_role <> 'admin' THEN
    RAISE EXCEPTION 'self_admin_demotion_blocked';
  END IF;

  SELECT role, organizer_type
    INTO v_previous_role, v_previous_organizer_type
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  UPDATE public.profiles
  SET role = v_stored_role,
      organizer_type = v_organizer_type
  WHERE id = p_user_id;

  -- Los triggers crean las fichas que falten. Si ya existían, sincronizamos
  -- su tipo para que Colonia y el perfil público reflejen el cambio al instante.
  IF v_stored_role IN ('promoter', 'club') THEN
    PERFORM public.provision_organizer_profile_for(p_user_id);
    UPDATE public.organizers
    SET type = CASE
      WHEN v_stored_role = 'club' THEN 'club'
      WHEN v_organizer_type = 'collective' THEN 'collective'
      ELSE 'promoter'
    END
    WHERE owner_id = p_user_id;
  END IF;

  IF v_stored_role IN ('artist', 'sello', 'club')
     OR (v_stored_role = 'promoter' AND v_organizer_type = 'collective') THEN
    PERFORM public.provision_artist_profile_for(p_user_id);
    UPDATE public.artists
    SET type = CASE
      WHEN v_stored_role = 'sello' THEN 'label'
      WHEN v_stored_role = 'club' THEN 'club'
      WHEN v_stored_role = 'promoter' THEN 'collective'
      ELSE 'artist'
    END
    WHERE user_id = p_user_id;
  END IF;

  PERFORM public.log_admin_action(
    'user.role_update',
    'profiles',
    p_user_id,
    p_user_id,
    jsonb_build_object(
      'previous_role', v_previous_role,
      'previous_organizer_type', v_previous_organizer_type,
      'new_role', v_stored_role,
      'new_organizer_type', v_organizer_type,
      'admin_selection', p_role,
      'reason', NULLIF(left(COALESCE(p_reason, ''), 500), '')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT) TO authenticated;

-- La solicitud guarda collective en form_data y promoter en requested_role.
-- Al aprobarla hay que conservar esa distinción y pasar el alias público al
-- RPC anterior; de otro modo la aprobación lo degradaría a promotor común.
CREATE OR REPLACE FUNCTION public.process_role_request_admin(
  p_request_id UUID,
  p_action TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS public.role_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.role_requests;
  v_updated public.role_requests;
  v_status TEXT;
  v_reason TEXT;
  v_admin_role TEXT;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'invalid_role_request_action'; END IF;

  SELECT * INTO v_request
  FROM public.role_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'role_request_not_found'; END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'role_request_already_reviewed'; END IF;

  IF p_action = 'approve' THEN
    v_admin_role := CASE
      WHEN v_request.requested_role = 'promoter'
       AND v_request.form_data->>'organizer_type' = 'collective'
      THEN 'collective'
      ELSE v_request.requested_role
    END;
    PERFORM public.set_user_role(v_request.user_id, v_admin_role, 'Solicitud de rol aprobada');
    v_status := 'approved';
    v_reason := NULL;
  ELSE
    v_status := 'rejected';
    v_reason := NULLIF(left(COALESCE(p_rejection_reason, ''), 500), '');
  END IF;

  UPDATE public.role_requests
  SET status = v_status,
      reviewed_at = NOW(),
      rejection_reason = v_reason
  WHERE id = p_request_id
  RETURNING * INTO v_updated;

  PERFORM public.log_admin_action(
    CASE WHEN p_action = 'approve' THEN 'role_request.approve' ELSE 'role_request.reject' END,
    'role_requests',
    p_request_id,
    v_request.user_id,
    jsonb_build_object('requested_role', v_request.requested_role, 'admin_role', v_admin_role, 'reason', v_reason)
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.process_role_request_admin(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_role_request_admin(UUID, TEXT, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.album_artist_credits (
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  credited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, artist_id)
);

CREATE TABLE IF NOT EXISTS public.podcast_artist_credits (
  podcast_id UUID NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  credited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (podcast_id, artist_id)
);

CREATE INDEX IF NOT EXISTS album_artist_credits_artist_idx
  ON public.album_artist_credits(artist_id);
CREATE INDEX IF NOT EXISTS podcast_artist_credits_artist_idx
  ON public.podcast_artist_credits(artist_id);

INSERT INTO public.album_artist_credits (album_id, artist_id, credited_by)
SELECT id, artist_id, uploaded_by FROM public.albums WHERE artist_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.podcast_artist_credits (podcast_id, artist_id, credited_by)
SELECT id, artist_id, uploaded_by FROM public.podcasts WHERE artist_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.album_artist_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_artist_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "album_credits_public_read" ON public.album_artist_credits;
CREATE POLICY "album_credits_public_read" ON public.album_artist_credits
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "podcast_credits_public_read" ON public.podcast_artist_credits;
CREATE POLICY "podcast_credits_public_read" ON public.podcast_artist_credits
  FOR SELECT USING (true);

GRANT SELECT ON public.album_artist_credits, public.podcast_artist_credits TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_album_artist_credits(
  p_album_id UUID,
  p_artist_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_artist_id UUID;
BEGIN
  SELECT artist_id INTO v_primary_artist_id
  FROM public.albums
  WHERE id = p_album_id
    AND (
      uploaded_by = auth.uid()
      OR public.is_current_user_admin()
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;

  DELETE FROM public.album_artist_credits WHERE album_id = p_album_id;
  INSERT INTO public.album_artist_credits (album_id, artist_id, credited_by)
  SELECT p_album_id, artist_id, auth.uid()
  FROM (
    SELECT DISTINCT unnest(array_append(COALESCE(p_artist_ids, '{}'::UUID[]), v_primary_artist_id)) AS artist_id
  ) credits
  WHERE artist_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_podcast_artist_credits(
  p_podcast_id UUID,
  p_artist_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_artist_id UUID;
BEGIN
  SELECT artist_id INTO v_primary_artist_id
  FROM public.podcasts
  WHERE id = p_podcast_id
    AND (
      uploaded_by = auth.uid()
      OR public.is_current_user_admin()
    )
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;

  DELETE FROM public.podcast_artist_credits WHERE podcast_id = p_podcast_id;
  INSERT INTO public.podcast_artist_credits (podcast_id, artist_id, credited_by)
  SELECT p_podcast_id, artist_id, auth.uid()
  FROM (
    SELECT DISTINCT unnest(array_append(COALESCE(p_artist_ids, '{}'::UUID[]), v_primary_artist_id)) AS artist_id
  ) credits
  WHERE artist_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_album_artist_credits(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_podcast_artist_credits(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_album_artist_credits(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_podcast_artist_credits(UUID, UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
