import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_FEE_PCT = 10;
const MAX_TICKETS = 4;

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

    const {
      event_id,
      ticket_type = 'GA',
      quantity = 1,
      assigned_emails = [],
    } = await req.json();

    if (!event_id)
      return new Response(JSON.stringify({ error: 'event_id requerido' }), { status: 400, headers: CORS });

    // Validar cantidad
    const qty = Math.max(1, Math.min(MAX_TICKETS, Math.round(Number(quantity))));

    // Validar emails asignados (máx qty-1, uno por ticket extra)
    const emails: (string | null)[] = (assigned_emails as (string | null)[])
      .slice(0, qty - 1)
      .map(e => (typeof e === 'string' && e.includes('@')) ? e.trim().toLowerCase() : null);

    // Obtener evento
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, title, price, tickets_total, tickets_sold, owner_id, date, status')
      .eq('id', event_id)
      .single();

    if (evErr || !event)
      return new Response(JSON.stringify({ error: 'Evento no encontrado' }), { status: 404, headers: CORS });

    if (!['upcoming', 'live', 'published'].includes(event.status))
      return new Response(JSON.stringify({ error: 'El evento no está disponible' }), { status: 400, headers: CORS });

    const sold  = event.tickets_sold ?? 0;
    const total = event.tickets_total ?? 0;

    if (total > 0 && sold + qty > total)
      return new Response(JSON.stringify({ error: `Solo quedan ${total - sold} entradas disponibles` }), { status: 400, headers: CORS });

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

    const amount_cop = Math.round((event.price || 0) * qty);
    if (amount_cop <= 0)
      return new Response(JSON.stringify({ error: 'Este evento es gratuito — usa purchase_ticket RPC' }), { status: 400, headers: CORS });

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
    });

    if (txErr)
      return new Response(JSON.stringify({ error: 'Error creando transacción', detail: txErr.message }), { status: 500, headers: CORS });

    const INTEGRITY_KEY = Deno.env.get('WOMPI_INTEGRITY_KEY')!;
    const signature = await sha256hex(`${reference}${amount_in_cents}COP${INTEGRITY_KEY}`);

    return new Response(
      JSON.stringify({
        reference,
        amount_in_cents,
        currency:    'COP',
        signature,
        public_key:  Deno.env.get('WOMPI_PUBLIC_KEY')!,
        event_title: event.title,
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
