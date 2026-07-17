-- PolyFauna UX: radio sets, Organismo unificado y ciclo de vida de Ticket Vault.

-- 1. Los sets de radio son programación en vivo, no contenido guardable.
CREATE TABLE IF NOT EXISTS public.radio_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  host_name TEXT,
  description TEXT,
  artwork_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT radio_sets_valid_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS radio_sets_active_window_idx
  ON public.radio_sets (starts_at DESC, ends_at DESC);

CREATE TABLE IF NOT EXISTS public.radio_set_likes (
  set_id UUID NOT NULL REFERENCES public.radio_sets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (set_id, user_id)
);

ALTER TABLE public.radio_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_set_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radio_sets_public_read" ON public.radio_sets;
CREATE POLICY "radio_sets_public_read" ON public.radio_sets
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "radio_sets_admin_insert" ON public.radio_sets;
CREATE POLICY "radio_sets_admin_insert" ON public.radio_sets
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
DROP POLICY IF EXISTS "radio_sets_admin_update" ON public.radio_sets;
CREATE POLICY "radio_sets_admin_update" ON public.radio_sets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
DROP POLICY IF EXISTS "radio_sets_admin_delete" ON public.radio_sets;
CREATE POLICY "radio_sets_admin_delete" ON public.radio_sets
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "radio_set_likes_read_own" ON public.radio_set_likes;
CREATE POLICY "radio_set_likes_read_own" ON public.radio_set_likes
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "radio_set_likes_insert_own" ON public.radio_set_likes;
CREATE POLICY "radio_set_likes_insert_own" ON public.radio_set_likes
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "radio_set_likes_delete_own" ON public.radio_set_likes;
CREATE POLICY "radio_set_likes_delete_own" ON public.radio_set_likes
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.update_radio_set_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.radio_sets SET likes_count = likes_count + 1, updated_at = now() WHERE id = NEW.set_id;
  ELSE
    UPDATE public.radio_sets SET likes_count = GREATEST(likes_count - 1, 0), updated_at = now() WHERE id = OLD.set_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS radio_set_likes_count ON public.radio_set_likes;
CREATE TRIGGER radio_set_likes_count
  AFTER INSERT OR DELETE ON public.radio_set_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_radio_set_likes_count();

-- 2. Una sola fuente para el corazón de podcasts: user_favorites.
INSERT INTO public.user_favorites (user_id, item_type, item_id, created_at)
SELECT user_id, 'podcast', podcast_id, created_at FROM public.user_likes
ON CONFLICT (user_id, item_type, item_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_podcast_favorite_to_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.item_type, OLD.item_type) <> 'podcast' THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_likes (user_id, podcast_id, created_at)
    VALUES (NEW.user_id, NEW.item_id, NEW.created_at)
    ON CONFLICT (user_id, podcast_id) DO NOTHING;
  ELSE
    DELETE FROM public.user_likes WHERE user_id = OLD.user_id AND podcast_id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_podcast_favorite_to_like ON public.user_favorites;
CREATE TRIGGER sync_podcast_favorite_to_like
  AFTER INSERT OR DELETE ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.sync_podcast_favorite_to_like();

CREATE OR REPLACE FUNCTION public.sync_podcast_like_to_favorite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_favorites (user_id, item_type, item_id, created_at)
    VALUES (NEW.user_id, 'podcast', NEW.podcast_id, NEW.created_at)
    ON CONFLICT (user_id, item_type, item_id) DO NOTHING;
  ELSE
    DELETE FROM public.user_favorites
    WHERE user_id = OLD.user_id AND item_type = 'podcast' AND item_id = OLD.podcast_id;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_podcast_like_to_favorite ON public.user_likes;
CREATE TRIGGER sync_podcast_like_to_favorite
  AFTER INSERT OR DELETE ON public.user_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_podcast_like_to_favorite();

-- 3. Respuestas del administrador a preguntas del programa.
ALTER TABLE public.show_questions
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- 4. Ticket Vault mantiene el registro, pero permite ocultarlo únicamente
-- después de uso y de que el evento haya terminado.
ALTER TABLE public.user_tickets
  ADD COLUMN IF NOT EXISTS hidden_from_vault_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS user_tickets_visible_vault_idx
  ON public.user_tickets (user_id, created_at DESC)
  WHERE hidden_from_vault_at IS NULL;

CREATE OR REPLACE FUNCTION public.hide_used_expired_ticket(p_ticket_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.user_tickets%ROWTYPE;
  v_event_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_ticket FROM public.user_tickets
  WHERE id = p_ticket_id AND user_id = (SELECT auth.uid())
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket no encontrado'; END IF;
  IF v_ticket.status <> 'used' THEN
    RAISE EXCEPTION 'El ticket solo se puede eliminar después de ser usado';
  END IF;
  SELECT COALESCE(ends_at, date) INTO v_event_end FROM public.events WHERE id = v_ticket.event_id;
  IF v_event_end IS NULL OR v_event_end >= now() THEN
    RAISE EXCEPTION 'El ticket solo se puede eliminar cuando el evento haya finalizado';
  END IF;
  UPDATE public.user_tickets SET hidden_from_vault_at = now() WHERE id = p_ticket_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.hide_used_expired_ticket(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hide_used_expired_ticket(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
