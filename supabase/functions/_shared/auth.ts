import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export async function requireUser(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return { admin, user: null };
  return { admin, user };
}

export async function requireAdmin(req: Request) {
  const auth = await requireUser(req);
  if (!auth.user) return { ...auth, isAdmin: false };
  const { data } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).single();
  return { ...auth, isAdmin: data?.role === 'admin' };
}
