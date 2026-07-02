import { CORS_HEADERS, escapeHtml, json, requireUser } from '../_shared/auth.ts';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { admin, user } = await requireUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { eventId, promoterId } = await req.json();
    if (typeof eventId !== 'string' || typeof promoterId !== 'string') {
      return json({ error: 'Datos inválidos' }, 400);
    }

    const { data: event } = await admin
      .from('events')
      .select('title, date, owner_id, image_url')
      .eq('id', eventId)
      .maybeSingle();
    if (!event) return json({ error: 'Evento no encontrado' }, 404);

    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const isOwner = event.owner_id === user.id;
    const isAdmin = callerProfile?.role === 'admin';
    if (!isOwner && !isAdmin) return json({ error: 'Forbidden' }, 403);

    const { data: { user: target } } = await admin.auth.admin.getUserById(promoterId);
    if (!target?.email) return json({ error: 'El co-promotor no tiene correo disponible' }, 404);

    const { data: ownerProfile } = await admin.from('profiles').select('display_name').eq('id', event.owner_id).maybeSingle();
    const ownerName = escapeHtml(ownerProfile?.display_name || 'Un organizador');
    const eventTitle = escapeHtml(event.title);
    const dateLabel = event.date
      ? new Date(event.date).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    const appUrl = Deno.env.get('APP_URL') || 'https://www.polyfauna.com';

    const html = emailWrapper(`
      <h1 style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;line-height:1.25;font-weight:900;color:#38D99C !important;">Te vincularon como co-promotor</h1>
      <p style="margin:0 0 22px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#9A9A9A !important;">
        ${ownerName} te agregó como co-promotor de <strong style="color:#ECECEC !important;">${eventTitle}</strong>${dateLabel ? ` (${dateLabel})` : ''}.
        Ya puedes verlo en tu panel operativo, emitir tickets manuales (transferencia o efectivo) y compartir tu propio link de venta — las compras hechas con tu link se acreditan a tu wallet.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td bgcolor="#E7ECEC" style="background:#E7ECEC !important;background-color:#E7ECEC !important;background-image:linear-gradient(#E7ECEC,#E7ECEC) !important;border-radius:10px;">
            <a href="${appUrl}/admin" target="_blank" style="display:inline-block;padding:13px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:900;color:#081010 !important;-webkit-text-fill-color:#081010 !important;text-decoration:none;border-radius:10px;">
              <span style="color:#081010 !important;-webkit-text-fill-color:#081010 !important;">Ir al panel operativo &rarr;</span>
            </a>
          </td>
        </tr>
      </table>
    `);

    await sendEmail({ to: target.email, subject: `Te vincularon a "${event.title}" — POLYFAUNA`, html });
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error interno' }, 500);
  }
});
