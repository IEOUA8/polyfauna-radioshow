-- POLYFAUNA — limpieza de las funciones de diagnostico temporal usadas
-- para investigar el error RLS de subida de avatar (ya resuelto: era el
-- upsert:true en storage-api, no la politica).
DROP FUNCTION IF EXISTS public.debug_avatar_policy(TEXT);
DROP FUNCTION IF EXISTS public.debug_avatar_bucket_config();
