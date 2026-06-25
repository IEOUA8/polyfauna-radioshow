-- POLYFAUNA - Fase 7.6: telemetria anonima de capacidad y embudo
--
-- Registra eventos ligeros de uso para medir usuarios activos, escucha,
-- seleccion de contenido, eventos y checkout sin almacenar PII.

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'session_heartbeat',
      'route_view',
      'stream_start',
      'media_start',
      'event_view',
      'checkout_start',
      'checkout_ready',
      'ticket_claimed',
      'checkout_error'
    )
  ),
  route TEXT CHECK (char_length(route) <= 300),
  referrer TEXT CHECK (char_length(referrer) <= 300),
  release TEXT CHECK (char_length(release) <= 120),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(properties::text) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_created_at_idx
  ON public.usage_events(created_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_name_created_at_idx
  ON public.usage_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_session_created_at_idx
  ON public.usage_events(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_user_created_at_idx
  ON public.usage_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_events_admin_read ON public.usage_events;
CREATE POLICY usage_events_admin_read ON public.usage_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );

REVOKE ALL ON public.usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
