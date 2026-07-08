-- POLYFAUNA — vincula automaticamente un evento con la ficha publica de
-- Colonia (organizers) de su propio dueno via event_organizers
-- (role_in_event='owner'). Sin esto, un evento creado por un promotor/club
-- con ficha en organizers nunca aparecia en el tab "Eventos" de su propio
-- perfil publico — solo el puente de co-organizacion (add_event_co_promoter)
-- poblaba event_organizers, nunca el dueno original del evento.

CREATE OR REPLACE FUNCTION public.sync_event_owner_organizer(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_organizer_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.events WHERE id = p_event_id;
  IF v_owner_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_organizer_id FROM public.organizers WHERE owner_id = v_owner_id;
  IF v_organizer_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.event_organizers (event_id, organizer_id, role_in_event)
  VALUES (p_event_id, v_organizer_id, 'owner')
  ON CONFLICT (event_id, organizer_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_event_owner_organizer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_event_owner_organizer(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_sync_owner_organizer ON public.events;
CREATE TRIGGER events_sync_owner_organizer
  AFTER INSERT OR UPDATE OF owner_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_event_owner_organizer();

REVOKE ALL ON FUNCTION public.sync_event_owner_organizer(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sync_event_owner_organizer() FROM PUBLIC, anon, authenticated;

-- El caso inverso: si un evento ya existia antes de que su dueno tuviera
-- ficha en organizers (ej. Movaiva, creado antes de esta fase), la
-- provision de la ficha debe re-sincronizar tambien sus eventos existentes.
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
  v_organizer_id UUID;
  r RECORD;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF NOT (v_profile.role = 'promoter' OR v_profile.role = 'club') THEN
    RETURN;
  END IF;

  SELECT id INTO v_organizer_id FROM public.organizers WHERE owner_id = p_profile_id;

  IF v_organizer_id IS NULL THEN
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
    )
    RETURNING id INTO v_organizer_id;
  END IF;

  FOR r IN SELECT id FROM public.events WHERE owner_id = p_profile_id LOOP
    PERFORM public.sync_event_owner_organizer(r.id);
  END LOOP;
END;
$$;

-- Backfill: eventos existentes cuyo dueno ya tiene ficha en organizers
-- (incluye MOVAIVA FESTIVAL).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.events WHERE owner_id IS NOT NULL LOOP
    PERFORM public.sync_event_owner_organizer(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
