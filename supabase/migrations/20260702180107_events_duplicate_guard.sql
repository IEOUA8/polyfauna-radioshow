-- POLYFAUNA — bloqueo estricto de eventos duplicados
-- Un promotor no puede tener dos eventos activos con el mismo título
-- (normalizado) el mismo día. Backstop atómico: funciona incluso con doble
-- clic simultáneo o llamadas directas a la API, sin depender del cliente.
--
-- date_trunc('day', timestamptz) es STABLE (depende del timezone de
-- sesión), no sirve para un índice. Se usa un wrapper IMMUTABLE que trunca
-- siempre en UTC.
CREATE OR REPLACE FUNCTION public.events_dup_day(ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (ts AT TIME ZONE 'UTC')::date;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS events_owner_title_day_unique
  ON public.events (owner_id, lower(trim(title)), public.events_dup_day(date))
  WHERE status <> 'cancelled';
