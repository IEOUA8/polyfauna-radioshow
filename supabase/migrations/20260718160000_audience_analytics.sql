-- Analítica agregada de audiencia sin almacenar direcciones IP.
-- La ubicación proviene de encabezados geográficos de Vercel y los datos
-- demográficos son voluntarios, privados y consultables solo como agregados.

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS os_name TEXT,
  ADD COLUMN IF NOT EXISTS browser_name TEXT;

ALTER TABLE public.usage_events
  DROP CONSTRAINT IF EXISTS usage_events_country_code_check,
  DROP CONSTRAINT IF EXISTS usage_events_region_check,
  DROP CONSTRAINT IF EXISTS usage_events_city_check,
  DROP CONSTRAINT IF EXISTS usage_events_device_type_check,
  DROP CONSTRAINT IF EXISTS usage_events_os_name_check,
  DROP CONSTRAINT IF EXISTS usage_events_browser_name_check;

ALTER TABLE public.usage_events
  ADD CONSTRAINT usage_events_country_code_check CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT usage_events_region_check CHECK (region IS NULL OR char_length(region) <= 80),
  ADD CONSTRAINT usage_events_city_check CHECK (city IS NULL OR char_length(city) <= 80),
  ADD CONSTRAINT usage_events_device_type_check CHECK (device_type IS NULL OR device_type IN ('mobile', 'tablet', 'desktop')),
  ADD CONSTRAINT usage_events_os_name_check CHECK (os_name IS NULL OR char_length(os_name) <= 80),
  ADD CONSTRAINT usage_events_browser_name_check CHECK (browser_name IS NULL OR char_length(browser_name) <= 80);

CREATE INDEX IF NOT EXISTS usage_events_device_created_at_idx
  ON public.usage_events(device_type, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_city_created_at_idx
  ON public.usage_events(city, created_at DESC)
  WHERE city IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_demographics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gender_identity TEXT CHECK (
    gender_identity IS NULL OR gender_identity IN ('woman', 'man', 'non_binary', 'prefer_not_to_say')
  ),
  age_range TEXT CHECK (
    age_range IS NULL OR age_range IN ('under_18', '18_24', '25_34', '35_44', '45_54', '55_plus', 'prefer_not_to_say')
  ),
  consented_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (gender_identity IS NOT NULL OR age_range IS NOT NULL)
);

ALTER TABLE public.user_demographics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_demographics_own_select" ON public.user_demographics;
CREATE POLICY "user_demographics_own_select" ON public.user_demographics
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_demographics_own_insert" ON public.user_demographics;
CREATE POLICY "user_demographics_own_insert" ON public.user_demographics
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_demographics_own_update" ON public.user_demographics;
CREATE POLICY "user_demographics_own_update" ON public.user_demographics
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_demographics_own_delete" ON public.user_demographics;
CREATE POLICY "user_demographics_own_delete" ON public.user_demographics
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.user_demographics FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_demographics TO authenticated;
GRANT ALL ON public.user_demographics TO service_role;

CREATE OR REPLACE FUNCTION public.set_user_demographics(
  p_gender_identity TEXT,
  p_age_range TEXT,
  p_consent BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesion' USING ERRCODE = '42501';
  END IF;

  IF NOT p_consent OR (p_gender_identity IS NULL AND p_age_range IS NULL) THEN
    DELETE FROM public.user_demographics WHERE user_id = (SELECT auth.uid());
    RETURN jsonb_build_object('deleted', true);
  END IF;

  INSERT INTO public.user_demographics (user_id, gender_identity, age_range, consented_at, updated_at)
  VALUES ((SELECT auth.uid()), p_gender_identity, p_age_range, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    gender_identity = EXCLUDED.gender_identity,
    age_range = EXCLUDED.age_range,
    consented_at = CASE
      WHEN public.user_demographics.gender_identity IS DISTINCT FROM EXCLUDED.gender_identity
        OR public.user_demographics.age_range IS DISTINCT FROM EXCLUDED.age_range
      THEN NOW()
      ELSE public.user_demographics.consented_at
    END,
    updated_at = NOW()
  RETURNING to_jsonb(user_demographics) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_demographics(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_demographics(TEXT, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_audience_demographics(p_hours INTEGER DEFAULT 24)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hours INTEGER;
  v_since TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  v_hours := CASE WHEN p_hours IN (1, 6, 24, 168, 720) THEN p_hours ELSE 24 END;
  v_since := NOW() - make_interval(hours => v_hours);

  WITH active_users AS (
    SELECT DISTINCT user_id
    FROM public.usage_events
    WHERE created_at >= v_since AND user_id IS NOT NULL
  ),
  gender_counts AS (
    SELECT COALESCE(d.gender_identity, 'not_provided') AS key, COUNT(*) AS total
    FROM active_users active
    LEFT JOIN public.user_demographics d ON d.user_id = active.user_id
    GROUP BY 1
  ),
  age_counts AS (
    SELECT COALESCE(d.age_range, 'not_provided') AS key, COUNT(*) AS total
    FROM active_users active
    LEFT JOIN public.user_demographics d ON d.user_id = active.user_id
    GROUP BY 1
  ),
  gender_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', key, 'count', total) ORDER BY total DESC, key), '[]'::jsonb) AS value
    FROM gender_counts
  ),
  age_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('key', key, 'count', total) ORDER BY total DESC, key), '[]'::jsonb) AS value
    FROM age_counts
  ),
  coverage AS (
    SELECT
      COUNT(*) AS eligible_users,
      COUNT(d.user_id) AS responded_users
    FROM active_users active
    LEFT JOIN public.user_demographics d ON d.user_id = active.user_id
  )
  SELECT jsonb_build_object(
    'hours', v_hours,
    'eligible_users', coverage.eligible_users,
    'responded_users', coverage.responded_users,
    'coverage_percent', CASE
      WHEN coverage.eligible_users = 0 THEN 0
      ELSE ROUND((coverage.responded_users::NUMERIC / coverage.eligible_users::NUMERIC) * 100, 1)
    END,
    'gender', gender_json.value,
    'age_ranges', age_json.value
  )
  INTO v_result
  FROM coverage, gender_json, age_json;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_audience_demographics(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_audience_demographics(INTEGER) TO authenticated;

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
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_hours := CASE WHEN p_hours IN (1, 6, 24, 168, 720) THEN p_hours ELSE 24 END;
  v_since := NOW() - make_interval(hours => v_hours);
  v_bucket := CASE WHEN v_hours <= 48 THEN 'hour' ELSE 'day' END;

  WITH filtered AS (
    SELECT event_name, session_id, user_id, release, properties, created_at,
      country_code, region, city, device_type, os_name, browser_name
    FROM public.usage_events
    WHERE created_at >= v_since
  ),
  summary AS (
    SELECT jsonb_build_object(
      'sessions', COUNT(DISTINCT session_id),
      'page_views', COUNT(*) FILTER (WHERE event_name = 'route_view'),
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
    SELECT * FROM (VALUES
      (1, 'event_view'::TEXT), (2, 'checkout_start'::TEXT),
      (3, 'checkout_ready'::TEXT), (4, 'ticket_claimed'::TEXT)
    ) AS stages(position, event_name)
  ),
  funnel AS (
    SELECT jsonb_agg(jsonb_build_object(
      'event_name', stages.event_name, 'count', COALESCE(counts.total, 0)
    ) ORDER BY stages.position) AS value
    FROM funnel_counts stages
    LEFT JOIN (
      SELECT event_name, COUNT(*) AS total FROM filtered
      WHERE event_name IN ('event_view', 'checkout_start', 'checkout_ready', 'ticket_claimed')
      GROUP BY event_name
    ) counts USING (event_name)
  ),
  bounds AS (
    SELECT date_trunc(v_bucket, v_since) AS first_bucket,
      date_trunc(v_bucket, NOW()) AS last_bucket,
      CASE WHEN v_bucket = 'hour' THEN INTERVAL '1 hour' ELSE INTERVAL '1 day' END AS step
  ),
  buckets AS (
    SELECT generate_series(first_bucket, last_bucket, step) AS bucket FROM bounds
  ),
  timeline_counts AS (
    SELECT date_trunc(v_bucket, created_at) AS bucket,
      COUNT(DISTINCT session_id) AS sessions,
      COUNT(*) FILTER (WHERE event_name IN ('stream_start', 'media_start')) AS plays,
      COUNT(*) FILTER (WHERE event_name = 'checkout_error') AS errors
    FROM filtered GROUP BY 1
  ),
  timeline AS (
    SELECT jsonb_agg(jsonb_build_object(
      'bucket', buckets.bucket,
      'sessions', COALESCE(timeline_counts.sessions, 0),
      'plays', COALESCE(timeline_counts.plays, 0),
      'errors', COALESCE(timeline_counts.errors, 0)
    ) ORDER BY buckets.bucket) AS value
    FROM buckets LEFT JOIN timeline_counts USING (bucket)
  ),
  checkout_error_groups AS (
    SELECT NULLIF(properties ->> 'event_id', '') AS event_id,
      COALESCE(NULLIF(properties ->> 'error_code', ''), 'unknown') AS error_code,
      COALESCE(NULLIF(release, ''), 'unknown') AS release,
      COUNT(*) AS total, MAX(created_at) AS latest_at
    FROM filtered WHERE event_name = 'checkout_error'
    GROUP BY 1, 2, 3 ORDER BY total DESC, latest_at DESC LIMIT 10
  ),
  checkout_errors AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'event_id', event_id, 'error_code', error_code, 'release', release,
      'count', total, 'latest_at', latest_at
    ) ORDER BY total DESC, latest_at DESC), '[]'::jsonb) AS value
    FROM checkout_error_groups
  ),
  city_groups AS (
    SELECT COALESCE(NULLIF(city, ''), 'Sin identificar') AS city,
      NULLIF(country_code, '') AS country_code,
      COUNT(DISTINCT session_id) AS sessions
    FROM filtered WHERE event_name = 'route_view'
    GROUP BY 1, 2 ORDER BY sessions DESC, city LIMIT 12
  ),
  cities AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'city', city, 'country_code', country_code, 'sessions', sessions
    ) ORDER BY sessions DESC, city), '[]'::jsonb) AS value FROM city_groups
  ),
  device_groups AS (
    SELECT COALESCE(NULLIF(device_type, ''), 'unknown') AS key,
      COUNT(DISTINCT session_id) AS sessions
    FROM filtered WHERE event_name = 'route_view'
    GROUP BY 1 ORDER BY sessions DESC
  ),
  devices AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'key', key, 'sessions', sessions
    ) ORDER BY sessions DESC, key), '[]'::jsonb) AS value FROM device_groups
  ),
  browser_groups AS (
    SELECT COALESCE(NULLIF(browser_name, ''), 'Desconocido') AS key,
      COUNT(DISTINCT session_id) AS sessions
    FROM filtered WHERE event_name = 'route_view'
    GROUP BY 1 ORDER BY sessions DESC LIMIT 8
  ),
  browsers AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'key', key, 'sessions', sessions
    ) ORDER BY sessions DESC, key), '[]'::jsonb) AS value FROM browser_groups
  ),
  os_groups AS (
    SELECT COALESCE(NULLIF(os_name, ''), 'Desconocido') AS key,
      COUNT(DISTINCT session_id) AS sessions
    FROM filtered WHERE event_name = 'route_view'
    GROUP BY 1 ORDER BY sessions DESC LIMIT 8
  ),
  operating_systems AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'key', key, 'sessions', sessions
    ) ORDER BY sessions DESC, key), '[]'::jsonb) AS value FROM os_groups
  )
  SELECT jsonb_build_object(
    'hours', v_hours,
    'generated_at', NOW(),
    'summary', summary.value,
    'funnel', funnel.value,
    'timeline', timeline.value,
    'checkout_errors', checkout_errors.value,
    'cities', cities.value,
    'devices', devices.value,
    'browsers', browsers.value,
    'operating_systems', operating_systems.value
  ) INTO v_result
  FROM summary, funnel, timeline, checkout_errors, cities, devices, browsers, operating_systems;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_usage_metrics(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_metrics(INTEGER) TO authenticated;
