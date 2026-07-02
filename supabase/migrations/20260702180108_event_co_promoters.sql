-- POLYFAUNA — co-promotores vinculados a un evento
--
-- El dueño de un evento puede vincular otros promotores/clubes para que
-- vendan tickets y emitan tickets manuales de ESE evento, sin poder
-- editarlo ni borrarlo. Cada co-promotor recibe un ref_code propio: las
-- compras hechas por la pasarela de pagos usando su link se atribuyen a su
-- propio wallet (create-payment resuelve promoter_id vía ref_code); las
-- compras directas en la plataforma siguen yendo al dueño del evento.

CREATE TABLE IF NOT EXISTS public.event_co_promoters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  promoter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by     UUID NOT NULL REFERENCES auth.users(id),
  ref_code     TEXT NOT NULL UNIQUE DEFAULT substr(md5(gen_random_uuid()::text), 1, 12),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, promoter_id)
);

ALTER TABLE public.event_co_promoters ENABLE ROW LEVEL SECURITY;

-- Solo lectura directa por RLS; toda escritura pasa por las funciones
-- SECURITY DEFINER de abajo (mismo patrón que payouts/request_payout).
DROP POLICY IF EXISTS "event_co_promoters_select" ON public.event_co_promoters;
CREATE POLICY "event_co_promoters_select" ON public.event_co_promoters
  FOR SELECT TO authenticated
  USING (
    promoter_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

REVOKE ALL ON public.event_co_promoters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_co_promoters TO authenticated;
GRANT ALL ON public.event_co_promoters TO service_role;

-- ─── Vincular por email (dueño del evento o admin) ─────────────────────
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

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_event_co_promoter(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_event_co_promoter(UUID, TEXT) TO authenticated;

-- ─── Revocar (dueño del evento o admin) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_event_co_promoter(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.event_co_promoters%ROWTYPE;
  v_owner_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.event_co_promoters WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.events WHERE id = v_row.event_id;

  IF v_owner_id <> auth.uid() AND NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.event_co_promoters SET status = 'revoked' WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_event_co_promoter(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_event_co_promoter(UUID) TO authenticated;

-- ─── El co-promotor debe poder ver el evento aunque no esté publicado ──
DROP POLICY IF EXISTS "events_visible_read" ON public.events;
CREATE POLICY "events_visible_read" ON public.events
  FOR SELECT
  USING (
    status IN ('published', 'upcoming', 'live')
    OR (SELECT auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.event_co_promoters
      WHERE event_id = events.id
        AND promoter_id = (SELECT auth.uid())
        AND status = 'active'
    )
  );

-- ─── Asistentes: dueño o co-promotor activo ────────────────────────────
-- La firma vigente (20260701000006) agregó columnas de identidad; DROP +
-- CREATE porque Postgres no permite cambiar el tipo de retorno vía
-- CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.get_event_attendees(UUID);
CREATE FUNCTION public.get_event_attendees(p_event_id UUID)
RETURNS TABLE (
  ticket_id UUID, ticket_number TEXT, ticket_type TEXT, ticket_status TEXT,
  ticket_created TIMESTAMPTZ, user_id UUID, display_name TEXT, phone TEXT,
  email TEXT, wompi_reference TEXT, amount_total NUMERIC,
  full_name TEXT, document_type TEXT, document_number TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events AS event WHERE event.id = p_event_id AND (
      event.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.profiles AS profile WHERE profile.id = auth.uid() AND profile.role = 'admin')
      OR EXISTS (
        SELECT 1 FROM public.event_co_promoters
        WHERE event_id = event.id AND promoter_id = auth.uid() AND status = 'active'
      )
    )
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  SELECT ticket.id, ticket.ticket_number, ticket.ticket_type, ticket.status, ticket.created_at, ticket.user_id,
    profile.display_name, profile.phone, users.email, transaction.wompi_reference, transaction.amount_total,
    identity.full_name, identity.document_type, identity.document_number
  FROM public.user_tickets AS ticket
  LEFT JOIN public.profiles AS profile ON profile.id = ticket.user_id
  LEFT JOIN public.user_identity AS identity ON identity.user_id = ticket.user_id
  LEFT JOIN auth.users AS users ON users.id = ticket.user_id
  LEFT JOIN public.transactions AS transaction ON transaction.id = ticket.transaction_id
  WHERE ticket.event_id = p_event_id
  ORDER BY ticket.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_attendees(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_attendees(UUID) TO authenticated;

-- ─── Ticket manual: dueño o co-promotor activo, y se acredita a quien lo emite ──
CREATE OR REPLACE FUNCTION public.issue_manual_transfer_ticket(
  p_actor_id UUID,
  p_event_id UUID,
  p_user_email TEXT,
  p_ticket_type TEXT,
  p_payment_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_event public.events%ROWTYPE;
  v_user_id UUID;
  v_tier JSONB;
  v_tier_name TEXT;
  v_tier_price BIGINT;
  v_tier_capacity INTEGER;
  v_tier_sold INTEGER;
  v_reference TEXT;
  v_existing_transaction public.transactions%ROWTYPE;
  v_existing_ticket public.user_tickets%ROWTYPE;
  v_transaction_id UUID;
  v_ticket_id UUID;
  v_ticket_number TEXT;
BEGIN
  SELECT role INTO v_actor_role
  FROM public.profiles
  WHERE id = p_actor_id;

  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF v_actor_role <> 'admin'
     AND v_event.owner_id <> p_actor_id
     AND NOT EXISTS (
       SELECT 1 FROM public.event_co_promoters
       WHERE event_id = p_event_id
         AND promoter_id = p_actor_id
         AND status = 'active'
     ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_user_email))
  LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  SELECT value INTO v_tier
  FROM jsonb_array_elements(v_event.ticket_types) AS value
  WHERE lower(value->>'name') = lower(trim(p_ticket_type))
  LIMIT 1;
  IF v_tier IS NULL THEN
    RAISE EXCEPTION 'invalid_ticket_type';
  END IF;

  v_tier_name := v_tier->>'name';
  v_tier_price := GREATEST(COALESCE((v_tier->>'price')::BIGINT, 0), 0);
  v_tier_capacity := GREATEST(COALESCE((v_tier->>'capacity')::INTEGER, 0), 0);
  v_reference := 'BANK-' || upper(left(regexp_replace(trim(p_payment_reference), '[^A-Za-z0-9_-]+', '', 'g'), 80));

  IF v_reference = 'BANK-' THEN
    RAISE EXCEPTION 'payment_reference_required';
  END IF;

  SELECT * INTO v_existing_transaction
  FROM public.transactions
  WHERE wompi_reference = v_reference;

  IF FOUND THEN
    IF v_existing_transaction.event_id <> p_event_id
       OR v_existing_transaction.buyer_id <> v_user_id THEN
      RAISE EXCEPTION 'payment_reference_already_used';
    END IF;

    SELECT * INTO v_existing_ticket
    FROM public.user_tickets
    WHERE transaction_id = v_existing_transaction.id
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'ticket_id', v_existing_ticket.id,
      'ticket_number', v_existing_ticket.ticket_number,
      'ticket_type', v_existing_ticket.ticket_type,
      'user_id', v_user_id,
      'event_title', v_event.title,
      'event_date', v_event.date,
      'event_city', COALESCE(v_event.venue, v_event.city)
    );
  END IF;

  IF COALESCE(v_event.tickets_sold, 0) >= COALESCE(v_event.tickets_total, 0) THEN
    RAISE EXCEPTION 'event_sold_out';
  END IF;

  SELECT count(*)::INTEGER INTO v_tier_sold
  FROM public.user_tickets
  WHERE event_id = p_event_id
    AND lower(ticket_type) = lower(v_tier_name)
    AND status NOT IN ('cancelled', 'refunded');

  IF v_tier_sold >= v_tier_capacity THEN
    RAISE EXCEPTION 'ticket_type_sold_out';
  END IF;

  INSERT INTO public.transactions (
    event_id,
    buyer_id,
    promoter_id,
    amount_total,
    platform_fee,
    promoter_amount,
    payment_method,
    wompi_reference,
    status,
    quantity,
    assigned_emails,
    ticket_type,
    paid_at
  )
  VALUES (
    p_event_id,
    v_user_id,
    p_actor_id,
    v_tier_price,
    0,
    v_tier_price,
    'bank_transfer',
    v_reference,
    'approved',
    1,
    '[]'::jsonb,
    v_tier_name,
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
  INSERT INTO public.user_tickets (
    user_id,
    event_id,
    ticket_number,
    ticket_type,
    status,
    ticket_index,
    transaction_id
  )
  VALUES (
    v_user_id,
    p_event_id,
    v_ticket_number,
    v_tier_name,
    'valid',
    1,
    v_transaction_id
  )
  RETURNING id INTO v_ticket_id;

  UPDATE public.transactions
  SET ticket_id = v_ticket_id
  WHERE id = v_transaction_id;

  UPDATE public.events
  SET tickets_sold = COALESCE(tickets_sold, 0) + 1
  WHERE id = p_event_id;

  INSERT INTO public.admin_audit_log (
    actor_id,
    action,
    target_table,
    target_id,
    target_user_id,
    metadata
  )
  VALUES (
    p_actor_id,
    'ticket.manual_bank_transfer',
    'user_tickets',
    v_ticket_id,
    v_user_id,
    jsonb_build_object(
      'event_id', p_event_id,
      'ticket_type', v_tier_name,
      'payment_reference', v_reference
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number,
    'ticket_type', v_tier_name,
    'user_id', v_user_id,
    'event_title', v_event.title,
    'event_date', v_event.date,
    'event_city', COALESCE(v_event.venue, v_event.city)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_manual_transfer_ticket(UUID, UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_manual_transfer_ticket(UUID, UUID, TEXT, TEXT, TEXT)
  TO service_role;
