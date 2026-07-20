-- El organizador elige un único canal público de venta por evento. En modo
-- WhatsApp coordina el pago directamente y emite el QR desde el panel.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_sales_channel TEXT NOT NULL DEFAULT 'polyfauna',
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_message TEXT;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_ticket_sales_channel_check,
  DROP CONSTRAINT IF EXISTS events_whatsapp_number_check,
  DROP CONSTRAINT IF EXISTS events_whatsapp_message_check,
  DROP CONSTRAINT IF EXISTS events_whatsapp_channel_configuration_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_ticket_sales_channel_check
    CHECK (ticket_sales_channel IN ('polyfauna', 'whatsapp')),
  ADD CONSTRAINT events_whatsapp_number_check
    CHECK (whatsapp_number IS NULL OR whatsapp_number ~ '^[1-9][0-9]{7,14}$'),
  ADD CONSTRAINT events_whatsapp_message_check
    CHECK (whatsapp_message IS NULL OR char_length(whatsapp_message) BETWEEN 1 AND 500),
  ADD CONSTRAINT events_whatsapp_channel_configuration_check
    CHECK (
      ticket_sales_channel <> 'whatsapp'
      OR (
        COALESCE(whatsapp_number ~ '^[1-9][0-9]{7,14}$', false)
        AND char_length(btrim(COALESCE(whatsapp_message, ''))) BETWEEN 1 AND 500
      )
    );

COMMENT ON COLUMN public.events.ticket_sales_channel IS
  'Canal público para Comprar Ticket: polyfauna (pasarela) o whatsapp (venta directa y emisión manual).';
COMMENT ON COLUMN public.events.whatsapp_number IS
  'Número internacional, solo dígitos, usado para construir el enlace wa.me.';
COMMENT ON COLUMN public.events.whatsapp_message IS
  'Mensaje prellenado que el comprador enviará al organizador.';

-- La emisión gratuita pública también debe respetar el canal. La función
-- manual del organizador no se limita porque es precisamente la vía de
-- emisión de QR para pagos coordinados por WhatsApp.
CREATE OR REPLACE FUNCTION public.purchase_ticket(
  p_event_id UUID,
  p_ticket_type TEXT DEFAULT 'General'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  available BOOLEAN;
  sales_channel TEXT;
BEGIN
  SELECT event.is_public AND event.creator_is_public, event.ticket_sales_channel
  INTO available, sales_channel
  FROM public.events AS event
  WHERE event.id = p_event_id;

  IF NOT COALESCE(available, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'El evento no esta disponible',
      'code', 'UNAVAILABLE'
    );
  END IF;

  IF sales_channel <> 'polyfauna' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este evento gestiona sus ventas directamente por WhatsApp',
      'code', 'WHATSAPP_SALES_ONLY'
    );
  END IF;

  RETURN public.purchase_ticket_visibility_impl(p_event_id, p_ticket_type);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_ticket(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_ticket(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
