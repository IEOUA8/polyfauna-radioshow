-- ============================================================
-- POLYFAUNA — Columnas de promotor + RLS en events
-- Agrega owner_id, status, tickets_total, tickets_sold
-- y permite a promotores/clubs crear y editar sus eventos
-- ============================================================

-- ─── Columnas faltantes en events ──────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS owner_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS tickets_total  INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS tickets_sold   INTEGER DEFAULT 0;

-- ─── RLS: promotores y clubs pueden crear y gestionar sus propios eventos ───

-- Escritura: promotores y clubs pueden insertar sus propios eventos
DROP POLICY IF EXISTS "events_promoter_insert" ON public.events;
CREATE POLICY "events_promoter_insert" ON public.events
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('promoter', 'club', 'admin')
    )
  );

-- Actualizar: solo el dueño del evento o un admin
DROP POLICY IF EXISTS "events_promoter_update" ON public.events;
CREATE POLICY "events_promoter_update" ON public.events
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Eliminar: solo el dueño o admin
DROP POLICY IF EXISTS "events_promoter_delete" ON public.events;
CREATE POLICY "events_promoter_delete" ON public.events
  FOR DELETE
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- La política service_role ya existe, la dejamos como está
-- La política de lectura pública (events_public_read) también se deja
