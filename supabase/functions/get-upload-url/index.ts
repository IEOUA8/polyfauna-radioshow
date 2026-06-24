import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const R2_ACCOUNT_ID     = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_ACCESS_KEY_ID  = Deno.env.get('R2_ACCESS_KEY_ID')!;
const R2_SECRET_KEY     = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const R2_PUBLIC_URL     = Deno.env.get('R2_PUBLIC_URL')!;
const R2_BUCKET         = 'polyfauna-media';

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_KEY,
  region: 'auto',
  service: 's3',
});

const ALLOWED_ROLES = ['artist', 'club', 'promoter', 'admin'];

const ALLOWED_AUDIO  = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg'];
const ALLOWED_IMAGE  = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_FOLDERS = new Set([
  'podcasts',
  'podcasts/audio',
  'podcasts/covers',
  'tracks',
  'albums',
  'artists',
  'events',
  'profiles',
]);
const EXT_BY_TYPE: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3':  'mp3',
  'audio/wav':  'wav',
  'audio/flac': 'flac',
  'audio/aac':  'aac',
  'audio/ogg':  'ogg',
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};
const MAX_AUDIO_MB   = 500;
const MAX_IMAGE_MB   = 10;
const MAX_BODY_BYTES = 4096;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
  if (Number(req.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Payload too large' }), {
      status: 413,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return json({ error: 'Solo artistas, clubs y promotores pueden subir contenido.' }, 403);
    }

    const { filename, contentType, folder = 'podcasts', fileSizeBytes } = await req.json();

    if (typeof filename !== 'string' || !filename.trim() || typeof contentType !== 'string') {
      return json({ error: 'filename y contentType son requeridos' }, 400);
    }
    if (typeof folder !== 'string' || !ALLOWED_FOLDERS.has(folder)) {
      return json({ error: 'Carpeta de carga no permitida' }, 400);
    }

    // Validate content type
    const isAudio = ALLOWED_AUDIO.includes(contentType);
    const isImage = ALLOWED_IMAGE.includes(contentType);
    if (!isAudio && !isImage) {
      return json({ error: `Tipo de archivo no permitido: ${contentType}` }, 400);
    }

    // Validate size
    const size = Number(fileSizeBytes);
    if (!Number.isInteger(size) || size <= 0) {
      return json({ error: 'fileSizeBytes debe ser un entero positivo' }, 400);
    }
    const maxBytes = isAudio ? MAX_AUDIO_MB * 1024 * 1024 : MAX_IMAGE_MB * 1024 * 1024;
    if (size > maxBytes) {
      const limit = isAudio ? `${MAX_AUDIO_MB}MB` : `${MAX_IMAGE_MB}MB`;
      return json({ error: `Archivo demasiado grande. Límite: ${limit}` }, 400);
    }

    const ext = EXT_BY_TYPE[contentType];
    const key = `${folder}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;

    // Generate presigned PUT URL (15 min expiry)
    const urlToSign = new URL(endpoint);
    urlToSign.searchParams.set('X-Amz-Expires', '900');

    const signed = await r2.sign(
      new Request(urlToSign.toString(), { method: 'PUT' }),
      { aws: { signQuery: true } }
    );

    return json({
      uploadUrl: signed.url,
      publicUrl: `${R2_PUBLIC_URL}/${key}`,
      key,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message ?? 'Error interno' }, 500);
  }
});
