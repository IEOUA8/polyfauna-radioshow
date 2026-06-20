import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_FEE_PCT = 10; // 10 % de comisión de plataforma

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
    // ── Auth ─────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user)
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: CORS });

    // ── Body ──────────────────────────────────────────────────────
    const { event_id, ticket_type = 'GA' } = await req.json();
    if (!event_id)
      return new Response(JSON.stringify({ error: 'event_id requerido' }), { status: 400, headers: CORS });

    // ── Evento ────────────────────────────────────────────────────
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, title, price, tickets_total, tickets_sold, owner_id, date, status')
      .eq('id', event_id)
      .single();

    if (evErr || !event)
      return new Response(JSON.stringify({ error: 'Evento no encontrado' }), { status: 404, headers: CORS });

    if (event.status !== 'published')
      return new Response(JSON.stringify({ error: 'El evento no está disponible' }), { status: 400, headers: CORS });

    const sold = event.tickets_sold ?? 0;
    const total = event.tickets_total ?? 0;
    if (total > 0 && sold >= total)
      return new Response(JSON.stringify({ error: 'Entradas agotadas' }), { status: 400, headers: CORS });

    // ── Calcular montos ───────────────────────────────────────────
    const amount_cop = Math.round(event.price || 0);
    if (amount_cop <= 0)
      return new Response(JSON.stringify({ error: 'Este evento es gratuito — usa purchase_ticket RPC' }), { status: 400, headers: CORS });

    const platform_fee    = Math.round(amount_cop * PLATFORM_FEE_PCT / 100);
    const promoter_amount = amount_cop - platform_fee;
    const amount_in_cents = amount_cop * 100; // Wompi usa centavos

    // ── Referencia única ──────────────────────────────────────────
    const reference = `PF-${event_id.slice(0, 8)}-${user.id.slice(0, 8)}-${Date.now()}`;

    // ── Crear transacción pendiente ───────────────────────────────
    const { error: txErr } = await supabase.from('transactions').insert({
      event_id,
      buyer_id:        user.id,
      promoter_id:     event.owner_id,
      amount_total:    amount_cop,
      platform_fee,
      promoter_amount,
      wompi_reference: reference,
      status:          'pending',
    });

    if (txErr)
      return new Response(JSON.stringify({ error: 'Error creando transacción', detail: txErr.message }), { status: 500, headers: CORS });

    // ── Firma de integridad Wompi ─────────────────────────────────
    const INTEGRITY_KEY = Deno.env.get('WOMPI_INTEGRITY_KEY')!;
    const signature = await sha256hex(`${reference}${amount_in_cents}COP${INTEGRITY_KEY}`);

    return new Response(
      JSON.stringify({
        reference,
        amount_in_cents,
        currency:   'COP',
        signature,
        public_key: Deno.env.get('WOMPI_PUBLIC_KEY')!,
        event_title: event.title,
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS } },
    );

  } catch (err) {
    console.error('create-payment error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Error interno' }), { status: 500, headers: CORS });
  }
});
