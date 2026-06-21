import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, emailWrapper } from '../_shared/resend.ts';

// Batch size to avoid Resend rate limits
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1200;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

serve(async (req) => {
  try {
    const { subject, title, body, ctaLabel, ctaUrl, adminSecret } = await req.json();

    // Simple secret check — set BROADCAST_SECRET in Supabase secrets
    const secret = Deno.env.get('BROADCAST_SECRET');
    if (secret && adminSecret !== secret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch all user emails via auth admin API
    const appUrl = Deno.env.get('APP_URL') || 'https://polyfauna.com';
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name')
      .order('created_at');

    // Get emails from auth.users using service role
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    users?.forEach(u => { emailMap[u.id] = u.email || ''; });

    const recipients = (profilesData || [])
      .map(p => ({ email: emailMap[p.id], name: p.display_name || 'Raver' }))
      .filter(r => !!r.email);

    const html = emailWrapper(`
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;color:#ffffff;">${title}</h1>
      <div style="font-size:15px;color:rgba(255,255,255,0.55);line-height:1.7;margin-bottom:28px;">
        ${body.replace(/\n/g, '<br/>')}
      </div>
      ${ctaLabel && ctaUrl ? `
      <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;background:rgba(255,255,255,0.9);border-radius:12px;font-size:14px;font-weight:900;color:#080B14;text-decoration:none;">
        ${ctaLabel}
      </a>` : ''}
    `);

    let sent = 0;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(r => sendEmail({ to: r.email, subject, html }))
      );
      sent += batch.length;
      if (i + BATCH_SIZE < recipients.length) await sleep(BATCH_DELAY_MS);
    }

    return new Response(JSON.stringify({ ok: true, sent }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
