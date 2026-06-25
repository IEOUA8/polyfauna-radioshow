-- POLYFAUNA - Fase 7.5: reducir superficie RPC SECURITY DEFINER
--
-- is_current_user_admin() y log_admin_action(...) son helpers internos usados
-- por RPCs administrativas. No aparecen llamados desde el frontend, por lo que
-- no deben exponerse como endpoints /rpc directos para cualquier usuario
-- autenticado. Las funciones administrativas que los llaman conservan acceso
-- porque ejecutan como SECURITY DEFINER.

REVOKE ALL ON FUNCTION public.is_current_user_admin()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin()
  TO service_role;

GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, UUID, JSONB)
  TO service_role;
