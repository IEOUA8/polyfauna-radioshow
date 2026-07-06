-- POLYFAUNA — el escaner de QR (validate_ticket) no devolvia el nombre
-- del asistente en el mensaje de aprobacion.
--
-- ValidatePage.jsx (ResultScreen) ya esperaba result.full_name,
-- result.document_type y result.document_number para el cuadro
-- "Verificar identidad" al aprobar un ticket, pero validate_ticket()
-- nunca consultaba user_identity — siempre caia en el placeholder
-- "Nombre no registrado". El modo offline (get_event_offline_pack /
-- evaluateOfflineTicket) ya hacia este join correctamente; esto iguala
-- el camino online al mismo comportamiento.

CREATE OR REPLACE FUNCTION public.validate_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ticket   public.user_tickets%ROWTYPE;
  v_event    public.events%ROWTYPE;
  v_identity public.user_identity%ROWTYPE;
  v_is_admin BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autenticado', 'code', 'UNAUTHENTICATED');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') INTO v_is_admin;
  SELECT * INTO v_ticket FROM public.user_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket no encontrado', 'code', 'NOT_FOUND');
  END IF;
  SELECT * INTO v_event FROM public.events WHERE id = v_ticket.event_id;
  IF NOT v_is_admin AND (v_event.owner_id IS NULL OR v_event.owner_id <> auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sin autorización para este evento', 'code', 'UNAUTHORIZED');
  END IF;
  IF v_ticket.user_id IS NOT NULL THEN
    SELECT * INTO v_identity FROM public.user_identity WHERE user_id = v_ticket.user_id;
  END IF;
  IF v_ticket.status = 'used' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_USED', 'error', 'Ticket ya utilizado',
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
      'full_name', v_identity.full_name, 'document_type', v_identity.document_type, 'document_number', v_identity.document_number);
  END IF;
  IF v_ticket.status = 'pending_registration' THEN
    RETURN jsonb_build_object('success', false, 'code', 'PENDING_REGISTRATION',
      'error', 'Cortesía pendiente: el destinatario (' || COALESCE(v_ticket.assigned_email, 'sin correo') || ') debe crear su cuenta en Polyfauna con ese correo antes de poder validar este QR',
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title);
  END IF;
  IF v_ticket.status <> 'valid' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS',
      'error', 'Ticket no vigente: ' || COALESCE(v_ticket.status, 'desconocido'),
      'ticket_type', v_ticket.ticket_type, 'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
      'full_name', v_identity.full_name, 'document_type', v_identity.document_type, 'document_number', v_identity.document_number);
  END IF;
  UPDATE public.user_tickets SET status = 'used' WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true, 'code', 'VALID', 'ticket_type', v_ticket.ticket_type,
    'ticket_number', v_ticket.ticket_number, 'event_title', v_event.title,
    'event_date', v_event.date::text, 'event_venue', v_event.venue,
    'full_name', v_identity.full_name, 'document_type', v_identity.document_type, 'document_number', v_identity.document_number);
END;
$$;
