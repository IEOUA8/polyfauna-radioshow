-- POLYFAUNA — corrige "infinite recursion detected in policy for relation
-- events" (INCIDENTE CRÍTICO EN PRODUCCIÓN).
--
-- events_visible_read (public.events) consulta event_co_promoters.
-- event_co_promoters_select (public.event_co_promoters) consultaba
-- public.events directamente para verificar si el llamante es dueño del
-- evento. Ambas políticas RLS se disparaban entre sí en un ciclo infinito.
--
-- Fix: el chequeo de "soy dueño de este evento" pasa a una función
-- SECURITY DEFINER, que bypassa RLS al leer events (mismo patrón ya usado
-- por is_current_user_admin() sobre profiles), rompiendo el ciclo.

CREATE OR REPLACE FUNCTION public.is_event_owner(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id AND owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_event_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_owner(UUID) TO authenticated;

DROP POLICY IF EXISTS "event_co_promoters_select" ON public.event_co_promoters;
CREATE POLICY "event_co_promoters_select" ON public.event_co_promoters
  FOR SELECT TO authenticated
  USING (
    promoter_id = (SELECT auth.uid())
    OR public.is_event_owner(event_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
