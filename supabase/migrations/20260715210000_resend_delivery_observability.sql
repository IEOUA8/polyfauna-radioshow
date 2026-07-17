-- Resend delivery observability.
-- Stores only operational metadata: no recipient address, subject or body.

CREATE TABLE IF NOT EXISTS public.email_delivery_events (
  svix_id         TEXT PRIMARY KEY,
  resend_email_id TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  category        TEXT,
  entity_id       TEXT,
  reason          TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_delivery_events_email_time_idx
  ON public.email_delivery_events (resend_email_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS email_delivery_events_entity_time_idx
  ON public.email_delivery_events (category, entity_id, occurred_at DESC)
  WHERE entity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_delivery_status (
  resend_email_id   TEXT PRIMARY KEY,
  latest_event_type TEXT NOT NULL,
  latest_event_at   TIMESTAMPTZ NOT NULL,
  category          TEXT,
  entity_id         TEXT,
  reason            TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_delivery_status_entity_idx
  ON public.email_delivery_status (category, entity_id)
  WHERE entity_id IS NOT NULL;

ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_delivery_status ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_delivery_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.email_delivery_status FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_delivery_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_delivery_status TO service_role;

COMMENT ON TABLE public.email_delivery_events IS
  'Minimal, append-only Resend webhook events. Deliberately excludes recipient, subject and email body.';
COMMENT ON TABLE public.email_delivery_status IS
  'Latest known Resend delivery state per provider email id.';

CREATE OR REPLACE FUNCTION public.record_resend_email_event(
  p_svix_id TEXT,
  p_resend_email_id TEXT,
  p_event_type TEXT,
  p_occurred_at TIMESTAMPTZ,
  p_category TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_occurred_at TIMESTAMPTZ := COALESCE(p_occurred_at, now());
BEGIN
  IF NULLIF(trim(p_svix_id), '') IS NULL
     OR NULLIF(trim(p_resend_email_id), '') IS NULL
     OR NULLIF(trim(p_event_type), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_resend_event';
  END IF;

  INSERT INTO public.email_delivery_events (
    svix_id, resend_email_id, event_type, category, entity_id, reason, occurred_at
  ) VALUES (
    trim(p_svix_id),
    trim(p_resend_email_id),
    trim(p_event_type),
    NULLIF(left(trim(COALESCE(p_category, '')), 80), ''),
    NULLIF(left(trim(COALESCE(p_entity_id, '')), 256), ''),
    NULLIF(left(trim(COALESCE(p_reason, '')), 1000), ''),
    v_occurred_at
  )
  ON CONFLICT (svix_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.email_delivery_status (
    resend_email_id, latest_event_type, latest_event_at, category, entity_id, reason, updated_at
  ) VALUES (
    trim(p_resend_email_id),
    trim(p_event_type),
    v_occurred_at,
    NULLIF(left(trim(COALESCE(p_category, '')), 80), ''),
    NULLIF(left(trim(COALESCE(p_entity_id, '')), 256), ''),
    NULLIF(left(trim(COALESCE(p_reason, '')), 1000), ''),
    now()
  )
  ON CONFLICT (resend_email_id) DO UPDATE SET
    latest_event_type = EXCLUDED.latest_event_type,
    latest_event_at = EXCLUDED.latest_event_at,
    category = COALESCE(EXCLUDED.category, email_delivery_status.category),
    entity_id = COALESCE(EXCLUDED.entity_id, email_delivery_status.entity_id),
    reason = EXCLUDED.reason,
    updated_at = now()
  WHERE EXCLUDED.latest_event_at >= email_delivery_status.latest_event_at;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.record_resend_email_event(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_resend_email_event(TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT)
  TO service_role;
