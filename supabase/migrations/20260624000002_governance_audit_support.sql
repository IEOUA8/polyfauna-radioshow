-- POLYFAUNA — gobernanza, auditoria admin y soporte interno

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL CHECK (char_length(action) BETWEEN 3 AND 120),
  target_table   TEXT CHECK (target_table IS NULL OR char_length(target_table) <= 80),
  target_id      UUID,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON public.admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created
  ON public.admin_audit_log(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_created
  ON public.admin_audit_log(target_user_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_admin_read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_admin_read" ON public.admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS public.support_cases (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject                TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 180),
  category               TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('payment','ticket','refund','payout','account','technical','general')),
  status                 TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','triage','waiting_user','waiting_internal','resolved','closed')),
  priority               TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  related_ticket_id      UUID REFERENCES public.user_tickets(id) ON DELETE SET NULL,
  related_event_id       UUID REFERENCES public.events(id) ON DELETE SET NULL,
  description            TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  internal_notes         TEXT CHECK (internal_notes IS NULL OR char_length(internal_notes) <= 4000),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_cases_status_priority_created
  ON public.support_cases(status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_cases_user_created
  ON public.support_cases(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_cases_assigned_created
  ON public.support_cases(assigned_to, created_at DESC);

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_cases_owner_read" ON public.support_cases;
CREATE POLICY "support_cases_owner_read" ON public.support_cases
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_cases_owner_insert" ON public.support_cases;
CREATE POLICY "support_cases_owner_insert" ON public.support_cases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_cases_admin_all" ON public.support_cases;
CREATE POLICY "support_cases_admin_all" ON public.support_cases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'citizen';

CREATE TABLE IF NOT EXISTS public.role_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_role   TEXT NOT NULL CHECK (requested_role IN ('artist','promoter','club','sello')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  form_data        JSONB DEFAULT '{}',
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_requests_status
  ON public.role_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_requests_user
  ON public.role_requests(user_id);

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_requests_owner_read" ON public.role_requests;
CREATE POLICY "role_requests_owner_read"
  ON public.role_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "role_requests_owner_insert" ON public.role_requests;
CREATE POLICY "role_requests_owner_insert"
  ON public.role_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "role_requests_admin_read" ON public.role_requests;
CREATE POLICY "role_requests_admin_read"
  ON public.role_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "role_requests_admin_update" ON public.role_requests;
CREATE POLICY "role_requests_admin_update"
  ON public.role_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.touch_support_case_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_cases_touch_updated_at ON public.support_cases;
CREATE TRIGGER support_cases_touch_updated_at
  BEFORE UPDATE ON public.support_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_support_case_updated_at();

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_table TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_table,
    target_id,
    target_user_id,
    metadata
  )
  VALUES (
    auth.uid(),
    p_action,
    p_target_table,
    p_target_id,
    p_target_user_id,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

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
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_role NOT IN ('citizen','artist','promoter','club','sello','admin') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  IF p_user_id = auth.uid() AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'self_admin_demotion_blocked';
  END IF;

  SELECT role INTO v_previous_role
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  UPDATE public.profiles
  SET role = p_role
  WHERE id = p_user_id;

  PERFORM public.log_admin_action(
    'user.role_update',
    'profiles',
    p_user_id,
    p_user_id,
    jsonb_build_object(
      'previous_role', v_previous_role,
      'new_role', p_role,
      'reason', NULLIF(left(COALESCE(p_reason, ''), 500), '')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_profile_admin(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_role TEXT;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'self_profile_delete_blocked';
  END IF;

  SELECT role INTO v_previous_role
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  PERFORM public.log_admin_action(
    'user.profile_delete',
    'profiles',
    p_user_id,
    p_user_id,
    jsonb_build_object(
      'previous_role', v_previous_role,
      'reason', NULLIF(left(COALESCE(p_reason, ''), 500), '')
    )
  );

  DELETE FROM public.profiles
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_support_case(
  p_case_id UUID,
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_assigned_to UUID DEFAULT NULL,
  p_internal_notes TEXT DEFAULT NULL
)
RETURNS public.support_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.support_cases;
  v_case public.support_cases;
  v_status TEXT;
  v_priority TEXT;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO v_previous
  FROM public.support_cases
  WHERE id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'support_case_not_found';
  END IF;

  v_status := COALESCE(p_status, v_previous.status);
  v_priority := COALESCE(p_priority, v_previous.priority);

  IF v_status NOT IN ('open','triage','waiting_user','waiting_internal','resolved','closed') THEN
    RAISE EXCEPTION 'invalid_support_status';
  END IF;

  IF v_priority NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'invalid_support_priority';
  END IF;

  UPDATE public.support_cases
  SET
    status = v_status,
    priority = v_priority,
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    internal_notes = COALESCE(left(p_internal_notes, 4000), internal_notes),
    resolved_at = CASE
      WHEN v_status IN ('resolved','closed') THEN COALESCE(resolved_at, NOW())
      ELSE NULL
    END
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  PERFORM public.log_admin_action(
    'support.case_update',
    'support_cases',
    p_case_id,
    v_case.user_id,
    jsonb_build_object(
      'previous_status', v_previous.status,
      'new_status', v_case.status,
      'previous_priority', v_previous.priority,
      'new_priority', v_case.priority,
      'assigned_to', v_case.assigned_to
    )
  );

  RETURN v_case;
END;
$$;

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
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'invalid_role_request_action';
  END IF;

  SELECT * INTO v_request
  FROM public.role_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'role_request_not_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'role_request_already_reviewed';
  END IF;

  IF p_action = 'approve' THEN
    PERFORM public.set_user_role(
      v_request.user_id,
      v_request.requested_role,
      'Solicitud de rol aprobada'
    );
    v_status := 'approved';
    v_reason := NULL;
  ELSE
    v_status := 'rejected';
    v_reason := NULLIF(left(COALESCE(p_rejection_reason, ''), 500), '');
  END IF;

  UPDATE public.role_requests
  SET
    status = v_status,
    reviewed_at = NOW(),
    rejection_reason = v_reason
  WHERE id = p_request_id
  RETURNING * INTO v_updated;

  PERFORM public.log_admin_action(
    CASE WHEN p_action = 'approve' THEN 'role_request.approve' ELSE 'role_request.reject' END,
    'role_requests',
    p_request_id,
    v_request.user_id,
    jsonb_build_object(
      'requested_role', v_request.requested_role,
      'reason', v_reason
    )
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

GRANT SELECT, INSERT ON public.support_cases TO authenticated;
GRANT ALL ON public.support_cases TO service_role;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_profile_admin(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_support_case(UUID, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_role_request_admin(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_profile_admin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_support_case(UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_role_request_admin(UUID, TEXT, TEXT) TO authenticated;
