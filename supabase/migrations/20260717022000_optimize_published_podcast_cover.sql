-- Backfill puntual: la portada original del primer podcast era un PNG de
-- 2.210.848 bytes. La versión WebP versionada pesa 99.972 bytes (95 % menos)
-- y se sirve desde el CDN de la aplicación con caché inmutable.
UPDATE public.podcasts
   SET cover_url = 'https://www.polyfauna.com/media/podcasts/plano-de-fase-serie-001-nous.webp'
 WHERE id = '7cb099e8-4cfb-4698-8e01-f03a731860bc'::uuid
   AND cover_url = 'https://pub-82186bd0fe924cb5b8d4b1cb03c46dc7.r2.dev/podcasts/covers/0511ec76-2bd7-4cc2-9bf7-538747ce9da5/89f8ed80-795a-416a-b12a-f0aa95da049c.png';
