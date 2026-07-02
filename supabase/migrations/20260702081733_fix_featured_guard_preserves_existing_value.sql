-- POLYFAUNA — corrige el guard de "featured" para no bloquear ediciones
-- ajenas al banner.
--
-- events_featured_admin_guard (RESTRICTIVE, phase 7.2) evalúa la fila
-- resultante completa en WITH CHECK, sin acceso a OLD. Esto bloqueaba
-- CUALQUIER actualización de un promotor/club a un evento que un admin ya
-- había marcado featured=true, aunque el update no tocara featured en
-- absoluto (ej. corregir el título). Se reemplaza por un trigger BEFORE
-- UPDATE que compara OLD vs NEW: solo bloquea la transición false→true por
-- un no-admin; preservar un valor ya existente queda permitido.

DROP POLICY IF EXISTS "events_featured_admin_guard" ON public.events;

CREATE OR REPLACE FUNCTION public.guard_featured_admin_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.featured IS TRUE
    AND OLD.featured IS DISTINCT FROM TRUE
    AND NOT public.is_current_user_admin()
  THEN
    RAISE EXCEPTION 'Solo un administrador puede activar el banner destacado';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_featured_admin_only() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_featured_admin_only() TO service_role;

DROP TRIGGER IF EXISTS events_featured_admin_guard_trigger ON public.events;
CREATE TRIGGER events_featured_admin_guard_trigger
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_featured_admin_only();
