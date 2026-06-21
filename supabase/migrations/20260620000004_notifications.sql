-- ============================================================
-- POLYFAUNA — Sistema de notificaciones
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = broadcast global
  type           TEXT        NOT NULL CHECK (type IN ('radio', 'podcast', 'event', 'blog', 'system', 'ticket')),
  title          TEXT        NOT NULL,
  body           TEXT,
  image_url      TEXT,
  action_section TEXT,
  action_id      UUID,
  read           BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_idx  ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve sus notificaciones + las globales (user_id = null)
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

-- Usuario puede marcar como leída su propia notificación
DROP POLICY IF EXISTS "notif_update_read" ON public.notifications;
CREATE POLICY "notif_update_read" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Solo admin puede insertar
DROP POLICY IF EXISTS "notif_admin_insert" ON public.notifications;
CREATE POLICY "notif_admin_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT ON public.notifications TO anon;

-- Función para crear notificaciones (usada por webhooks y admin)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_type         TEXT,
  p_title        TEXT,
  p_body         TEXT         DEFAULT NULL,
  p_image_url    TEXT         DEFAULT NULL,
  p_action_section TEXT       DEFAULT NULL,
  p_user_id      UUID         DEFAULT NULL
) RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.notifications (type, title, body, image_url, action_section, user_id)
  VALUES (p_type, p_title, p_body, p_image_url, p_action_section, p_user_id)
  RETURNING id;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;
