import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_FEE_PCT = 10;
const MAX_TICKETS = 4;
const MAX_BODY_BYTES = 4096;

async function sha256hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES)
    return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413, headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user)
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: CORS });

    const { data: identity } = await supabase
      .from('user_identity')
      .select('full_name, document_number')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!identity?.full_name || !identity?.document_number)
      return new Response(
        JSON.stringify({ error: 'Completa tu nombre y documento en el Control Center antes de adquirir tickets' }),
        { status: 400, headers: CORS },
      );

    const {
      event_id,
      ticket_type = 'General',
      quantity = 1,
      assigned_emails = [],
    } = await req.json();

    if (!event_id)
      return new Response(JSON.stringify({ error: 'event_id requerido' }), { status: 400, headers: CORS });

    // Rechazar valores ambiguos en vez de ajustarlos silenciosamente.
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_TICKETS)
      return new Response(JSON.stringify({ error: `quantity debe estar entre 1 y ${MAX_TICKETS}` }), { status: 400, headers: CORS });

    // Validar emails asignados (máx qty-1, uno por ticket extra)
    if (!Array.isArray(assigned_emails))
      return new Response(JSON.stringify({ error: 'assigned_emails debe ser una lista' }), { status: 400, headers: CORS });

    const emails: (string | null)[] = (assigned_emails as (string | null)[])
      .slice(0, qty - 1)
      .map(e => (typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) ? e.trim().toLowerCase() : null);

    const rawRequestedType = typeof ticket_type === 'string' ? ticket_type.trim().slice(0, 60) : '';
    if (!rawRequestedType)
      return new Response(JSON.stringify({ error: 'ticket_type requerido' }), { status: 400, headers: CORS });
    const requestedType = ['ga', 'general admission'].includes(rawRequestedType.toLowerCase())
      ? 'General'
      : rawRequestedType;

    // Obtener evento y sus tipos de entrada
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, title, price, tickets_total, tickets_sold, ticket_types, owner_id, date, status')
      .eq('id', event_id)
      .single();

    if (evErr || !event)
      return new Response(JSON.stringify({ error: 'Evento no encontrado' }), { status: 404, headers: CORS });

    if (!['upcoming', 'live', 'published'].includes(event.status))
      return new Response(JSON.stringify({ error: 'El evento no está disponible' }), { status: 400, headers: CORS });

    const tiers = Array.isArray(event.ticket_types) ? event.ticket_types : [];
    const tier = tiers.find((item: Record<string, unknown>) =>
      typeof item?.name === 'string' && item.name.toLowerCase() === requestedType.toLowerCase()
    );
    if (!tier)
      return new Response(JSON.stringify({ error: 'Tipo de entrada no disponible' }), { status: 400, headers: CORS });

    const tierName = String(tier.name).slice(0, 60);
    const tierPrice = Number(tier.price);
    const tierCapacity = Number(tier.capacity);
    if (!Number.isFinite(tierPrice) || tierPrice < 0 || !Number.isInteger(tierCapacity) || tierCapacity < 1)
      return new Response(JSON.stringify({ error: 'Configuración de entrada inválida' }), { status: 500, headers: CORS });

    const sold  = event.tickets_sold ?? 0;
    const total = event.tickets_total ?? 0;

    if (total > 0 && sold + qty > total)
      return new Response(JSON.stringify({ error: `Solo quedan ${total - sold} entradas disponibles` }), { status: 400, headers: CORS });

    const { count: tierSold, error: tierSoldErr } = await supabase
      .from('user_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .ilike('ticket_type', tierName);
    if (tierSoldErr)
      return new Response(JSON.stringify({ error: 'No fue posible validar el inventario' }), { status: 500, headers: CORS });
    if ((tierSold ?? 0) + qty > tierCapacity)
      return new Response(JSON.stringify({ error: `Solo quedan ${Math.max(0, tierCapacity - (tierSold ?? 0))} entradas ${tierName}` }), { status: 400, headers: CORS });

    // Verificar límite de 4 tickets por comprador en este evento
    const { data: existingCount } = await supabase.rpc('count_user_event_tickets', {
      p_user_id:  user.id,
      p_event_id: event_id,
    });
    const existing = Number(existingCount ?? 0);
    if (existing + qty > MAX_TICKETS)
      return new Response(
        JSON.stringify({ error: `Ya tienes ${existing} ticket(s) para este evento. El máximo es ${MAX_TICKETS}.` }),
        { status: 400, headers: CORS },
      );

    // Evita múltiples checkouts simultáneos para el mismo comprador/evento.
    const pendingSince = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: pendingTransaction } = await supabase
      .from('transactions')
      .select('wompi_reference')
      .eq('buyer_id', user.id)
      .eq('event_id', event_id)
      .eq('status', 'pending')
      .gte('created_at', pendingSince)
      .maybeSingle();

    if (pendingTransaction)
      return new Response(
        JSON.stringify({ error: 'Ya existe un checkout pendiente para este evento. Complétalo o espera 30 minutos.' }),
        { status: 409, headers: CORS },
      );

    const amount_cop = Math.round(tierPrice * qty);
    if (amount_cop <= 0)
      return new Response(JSON.stringify({ error: 'Este evento es gratuito — usa purchase_ticket RPC' }), { status: 400, headers: CORS });

    const INTEGRITY_KEY = Deno.env.get('WOMPI_INTEGRITY_KEY');
    const PUBLIC_KEY = Deno.env.get('WOMPI_PUBLIC_KEY');
    if (!INTEGRITY_KEY || !PUBLIC_KEY)
      return new Response(JSON.stringify({ error: 'Pasarela de pago no configurada' }), { status: 503, headers: CORS });

    const platform_fee    = Math.round(amount_cop * PLATFORM_FEE_PCT / 100);
    const promoter_amount = amount_cop - platform_fee;
    const amount_in_cents = amount_cop * 100;

    const reference = `PF-${event_id.slice(0, 8)}-${user.id.slice(0, 8)}-${Date.now()}`;

    const { error: txErr } = await supabase.from('transactions').insert({
      event_id,
      buyer_id:        user.id,
      promoter_id:     event.owner_id,
      amount_total:    amount_cop,
      platform_fee,
      promoter_amount,
      wompi_reference: reference,
      status:          'pending',
      quantity:        qty,
      assigned_emails: emails,
      ticket_type:     tierName,
    });

    if (txErr) {
      console.error('create-payment tx insert:', txErr.message);
      return new Response(JSON.stringify({ error: 'Error creando transacción' }), { status: 500, headers: CORS });
    }

    const signature = await sha256hex(`${reference}${amount_in_cents}COP${INTEGRITY_KEY}`);

    return new Response(
      JSON.stringify({
        reference,
        amount_in_cents,
        currency:    'COP',
        signature,
        public_key:  PUBLIC_KEY,
        event_title: event.title,
        ticket_type: tierName,
        quantity:    qty,
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS } },
    );

  } catch (err) {
    console.error('create-payment error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno' }),
      { status: 500, headers: CORS },
    );
  }
});
