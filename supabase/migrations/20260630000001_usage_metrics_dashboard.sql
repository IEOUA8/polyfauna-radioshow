-- POLYFAUNA - Fase 7.7: tablero agregado de telemetria
--
-- Expone solo agregados a administradores. Los eventos crudos permanecen
-- protegidos y el navegador no necesita descargarlos para calcular metricas.

CREATE OR REPLACE FUNCTION public.get_usage_metrics(p_hours INTEGER DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hours INTEGER;
  v_since TIMESTAMPTZ;
  v_bucket TEXT;
  v_result JSONB;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_hours := CASE
    WHEN p_hours IN (1, 6, 24, 168, 720) THEN p_hours
    ELSE 24
  END;
  v_since := NOW() - make_interval(hours => v_hours);
  v_bucket := CASE WHEN v_hours <= 48 THEN 'hour' ELSE 'day' END;

  WITH filtered AS (
    SELECT event_name, session_id, user_id, release, properties, created_at
    FROM public.usage_events
    WHERE created_at >= v_since
  ),
  summary AS (
    SELECT jsonb_build_object(
      'sessions', COUNT(DISTINCT session_id),
      'authenticated_users', COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL),
      'live_starts', COUNT(*) FILTER (WHERE event_name = 'stream_start'),
      'media_starts', COUNT(*) FILTER (WHERE event_name = 'media_start'),
      'event_views', COUNT(*) FILTER (WHERE event_name = 'event_view'),
      'checkout_errors', COUNT(*) FILTER (WHERE event_name = 'checkout_error'),
      'total_events', COUNT(*)
    ) AS value
    FROM filtered
  ),
  funnel_counts AS (
    SELECT *
    FROM (VALUES
      (1, 'event_view'::TEXT),
      (2, 'checkout_start'::TEXT),
      (3, 'checkout_ready'::TEXT),
      (4, 'ticket_claimed'::TEXT)
    ) AS stages(position, event_name)
  ),
  funnel AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'event_name', stages.event_name,
        'count', COALESCE(counts.total, 0)
      )
      ORDER BY stages.position
    ) AS value
    FROM funnel_counts stages
    LEFT JOIN (
      SELECT event_name, COUNT(*) AS total
      FROM filtered
      WHERE event_name IN ('event_view', 'checkout_start', 'checkout_ready', 'ticket_claimed')
      GROUP BY event_name
    ) counts USING (event_name)
  ),
  bounds AS (
    SELECT
      date_trunc(v_bucket, v_since) AS first_bucket,
      date_trunc(v_bucket, NOW()) AS last_bucket,
      CASE WHEN v_bucket = 'hour' THEN INTERVAL '1 hour' ELSE INTERVAL '1 day' END AS step
  ),
  buckets AS (
    SELECT generate_series(first_bucket, last_bucket, step) AS bucket
    FROM bounds
  ),
  timeline_counts AS (
    SELECT
      date_trunc(v_bucket, created_at) AS bucket,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(*) FILTER (WHERE event_name IN ('stream_start', 'media_start')) AS plays,
      COUNT(*) FILTER (WHERE event_name = 'checkout_error') AS errors
    FROM filtered
    GROUP BY 1
  ),
  timeline AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'bucket', buckets.bucket,
        'sessions', COALESCE(timeline_counts.sessions, 0),
        'plays', COALESCE(timeline_counts.plays, 0),
        'errors', COALESCE(timeline_counts.errors, 0)
      )
      ORDER BY buckets.bucket
    ) AS value
    FROM buckets
    LEFT JOIN timeline_counts USING (bucket)
  ),
  checkout_error_groups AS (
    SELECT
      NULLIF(properties ->> 'event_id', '') AS event_id,
      COALESCE(NULLIF(properties ->> 'error_code', ''), 'unknown') AS error_code,
      COALESCE(NULLIF(release, ''), 'unknown') AS release,
      COUNT(*) AS total,
      MAX(created_at) AS latest_at
    FROM filtered
    WHERE event_name = 'checkout_error'
    GROUP BY 1, 2, 3
    ORDER BY total DESC, latest_at DESC
    LIMIT 10
  ),
  checkout_errors AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'event_id', event_id,
          'error_code', error_code,
          'release', release,
          'count', total,
          'latest_at', latest_at
        )
        ORDER BY total DESC, latest_at DESC
      ),
      '[]'::jsonb
    ) AS value
    FROM checkout_error_groups
  )
  SELECT jsonb_build_object(
    'hours', v_hours,
    'generated_at', NOW(),
    'summary', summary.value,
    'funnel', funnel.value,
    'timeline', timeline.value,
    'checkout_errors', checkout_errors.value
  )
  INTO v_result
  FROM summary, funnel, timeline, checkout_errors;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_usage_metrics(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_metrics(INTEGER) TO authenticated;
