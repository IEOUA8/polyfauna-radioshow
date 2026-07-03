-- get_event_attendees quedo roto tras 20260702231304: COALESCE(users.email,
-- ticket.assigned_email) resuelve a character varying, no text, y RETURN
-- QUERY exige coincidencia exacta con la columna declarada (email TEXT),
-- rompiendo la lista de asistentes con "structure of query does not match
-- function result type" (42804). Cast explicito a text.

CREATE OR REPLACE FUNCTION public.get_event_attendees(p_event_id UUID)
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
    profile.display_name, profile.phone, COALESCE(users.email::TEXT, ticket.assigned_email), transaction.wompi_reference, transaction.amount_total,
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
