-- POLYFAUNA — notifica dentro de la plataforma al vincular un co-promotor.
-- El correo lo envía la Edge Function notify-co-promoter-linked (llamada
-- desde el frontend tras esta RPC); esta notificación in-app es atómica con
-- el vínculo mismo, para que nunca quede vinculado sin notificar.

CREATE OR REPLACE FUNCTION public.add_event_co_promoter(p_event_id UUID, p_email TEXT)
RETURNS public.event_co_promoters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_target_id UUID;
  v_target_role TEXT;
  v_owner_name TEXT;
  v_row public.event_co_promoters;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF v_event.owner_id <> auth.uid() AND NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id INTO v_target_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_target_id = v_event.owner_id THEN
    RAISE EXCEPTION 'cannot_link_owner';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = v_target_id;
  IF v_target_role IS NULL OR v_target_role NOT IN ('promoter', 'club') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  INSERT INTO public.event_co_promoters (event_id, promoter_id, added_by)
  VALUES (p_event_id, v_target_id, auth.uid())
  ON CONFLICT (event_id, promoter_id)
  DO UPDATE SET status = 'active', added_by = EXCLUDED.added_by
  RETURNING * INTO v_row;

  SELECT display_name INTO v_owner_name FROM public.profiles WHERE id = auth.uid();

  PERFORM public.create_notification(
    'event',
    'Te vincularon como co-promotor',
    COALESCE(v_owner_name, 'Un organizador') || ' te agregó como co-promotor de "' || v_event.title || '". Ya puedes venderlo y emitir tickets manuales desde tu panel.',
    v_event.image_url,
    'events',
    v_target_id
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_event_co_promoter(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_event_co_promoter(UUID, TEXT) TO authenticated;
