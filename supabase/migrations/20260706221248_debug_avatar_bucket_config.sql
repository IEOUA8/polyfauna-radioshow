-- POLYFAUNA — diagnostico temporal adicional para el error RLS al subir
-- avatar. La funcion debug_avatar_policy ya probo que la expresion de la
-- politica evalua true con el JWT real del usuario via PostgREST, pero el
-- storage-api (servicio distinto, con su propia conexion a Postgres)
-- sigue rechazando el insert con el mismo error. Esta funcion expone la
-- configuracion no sensible del bucket 'avatars' (public, limites) y si
-- ya existe una fila en storage.objects para la ruta del propio usuario,
-- para descartar un desajuste bucket_id/name o un conflicto de upsert.
-- Cualquier autenticado puede llamarla; no expone datos de otros usuarios
-- (el filtro de objects es siempre sobre auth.uid() propio).
CREATE OR REPLACE FUNCTION public.debug_avatar_bucket_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket JSONB;
  v_existing JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not authenticated');
  END IF;
  SELECT to_jsonb(b) - 'owner' INTO v_bucket FROM storage.buckets b WHERE b.name = 'avatars' OR b.id = 'avatars';
  SELECT jsonb_agg(to_jsonb(o) - 'metadata') INTO v_existing
    FROM storage.objects o
    WHERE o.bucket_id = 'avatars' AND (storage.foldername(o.name))[1] = auth.uid()::text;
  RETURN jsonb_build_object('bucket', v_bucket, 'existing_objects', COALESCE(v_existing, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.debug_avatar_bucket_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_avatar_bucket_config() TO authenticated;
