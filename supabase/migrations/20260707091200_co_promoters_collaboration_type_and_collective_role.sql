-- Distinción co-organizador vs. revendedor de boletas.
-- Ver POLYFAUNA_EVENTOS_ORGANIZADORES_MASTER.md, sección 3.3.
--
-- NOTA: el documento original también proponía agregar 'collective' como
-- valor nuevo de profiles.role. Se descartó: src/contexts/AuthContext.jsx
-- ya implementa un mecanismo completo y en producción para colectivos vía
-- profiles.organizer_type = 'collective' con role = 'promoter', que ya
-- tiene paridad total en toda la RLS existente (events_insert_access,
-- issue_courtesy_ticket, event_covers_organizer_insert, etc.) porque su
-- role sigue siendo 'promoter'. Agregar un role='collective' distinto
-- hubiera creado un segundo mecanismo paralelo sin esa paridad, requiriendo
-- duplicar ~8 chequeos de rol en frontend y RLS. Se mantiene solo el
-- mecanismo existente.

ALTER TABLE public.event_co_promoters
  ADD COLUMN IF NOT EXISTS collaboration_type TEXT NOT NULL DEFAULT 'ticket_reseller'
    CHECK (collaboration_type IN ('co_organizer', 'ticket_reseller'));

-- Se elimina explícitamente la firma anterior (UUID, TEXT) antes de crear la
-- de 3 parámetros: si ambas coexistieran, una llamada legacy con solo
-- (p_event_id, p_email) sería ambigua entre las dos funciones y PostgREST
-- fallaría con "function name is not unique".
DROP FUNCTION IF EXISTS public.add_event_co_promoter(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.add_event_co_promoter(
  p_event_id UUID,
  p_email TEXT,
  p_collaboration_type TEXT DEFAULT 'ticket_reseller'
)
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

  IF p_collaboration_type NOT IN ('co_organizer', 'ticket_reseller') THEN
    RAISE EXCEPTION 'invalid_collaboration_type';
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

  INSERT INTO public.event_co_promoters (event_id, promoter_id, added_by, collaboration_type)
  VALUES (p_event_id, v_target_id, auth.uid(), p_collaboration_type)
  ON CONFLICT (event_id, promoter_id)
  DO UPDATE SET
    status = 'active',
    added_by = EXCLUDED.added_by,
    collaboration_type = EXCLUDED.collaboration_type
  RETURNING * INTO v_row;

  -- Puente hacia la capa pública: SOLO si el vínculo es de organización
  -- real, nunca para reventa de boletas.
  IF p_collaboration_type = 'co_organizer' THEN
    INSERT INTO public.event_organizers (event_id, organizer_id, role_in_event)
    SELECT p_event_id, o.id, 'co-organizer'
    FROM public.organizers o
    WHERE o.owner_id = v_target_id
    ON CONFLICT (event_id, organizer_id) DO NOTHING;
  END IF;

  SELECT display_name INTO v_owner_name FROM public.profiles WHERE id = auth.uid();

  PERFORM public.create_notification(
    'event',
    CASE WHEN p_collaboration_type = 'co_organizer'
      THEN 'Te vincularon como co-organizador'
      ELSE 'Te vincularon como co-promotor de boletas' END,
    COALESCE(v_owner_name, 'Un organizador') || ' te agregó a "' || v_event.title || '".',
    v_event.image_url,
    'events',
    v_target_id
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_event_co_promoter(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_event_co_promoter(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
