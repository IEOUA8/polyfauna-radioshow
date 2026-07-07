-- POLYFAUNA — diagnostico temporal para el error "new row violates
-- row-level security policy" al subir avatar. SECURITY INVOKER a
-- proposito: debe reflejar el auth.uid() real de quien la llama, no un
-- superusuario. Cualquier usuario autenticado puede llamarla (no expone
-- nada sensible, solo su propio uid comparado contra una ruta hipotetica).
CREATE OR REPLACE FUNCTION public.debug_avatar_policy(p_path TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_path TEXT := COALESCE(p_path, auth.uid()::text || '/avatar.png');
BEGIN
  RETURN jsonb_build_object(
    'auth_uid', auth.uid(),
    'jwt_role', auth.role(),
    'test_path', v_path,
    'foldername_first_segment', (storage.foldername(v_path))[1],
    'would_match_policy', auth.uid()::text = (storage.foldername(v_path))[1]
  );
END;
$$;

REVOKE ALL ON FUNCTION public.debug_avatar_policy(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_avatar_policy(TEXT) TO authenticated;
