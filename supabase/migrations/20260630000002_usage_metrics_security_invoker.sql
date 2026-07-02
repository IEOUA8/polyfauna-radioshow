-- La agregacion solo necesita el SELECT ya protegido por RLS de usage_events.
-- Mantenerla como invoker evita ampliar la superficie SECURITY DEFINER.

ALTER FUNCTION public.get_usage_metrics(INTEGER) SECURITY INVOKER;
