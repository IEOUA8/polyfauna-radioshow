-- POLYFAUNA — Reparación puntual de Ticket Vault
-- Usar cuando una base ya tiene eventos/perfiles, pero no public.user_tickets.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.events') IS NULL THEN
    RAISE EXCEPTION 'Falta public.events. Esta reparación requiere que la migración inicial de eventos ya exista.';
  END IF;

  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Falta public.profiles. Esta reparación requiere que la migración de perfiles/roles ya exista.';
  END IF;
END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS tickets_total INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS tickets_sold INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.user_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ticket_number  TEXT UNIQUE NOT NULL DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)),
  ticket_type    TEXT DEFAULT 'GA',
  status         TEXT DEFAULT 'valid',
  assigned_email TEXT,
  ticket_index   INTEGER NOT NULL DEFAULT 1,
  transaction_id UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_tickets
  ADD COLUMN IF NOT EXISTS assigned_email TEXT,
  ADD COLUMN IF NOT EXISTS ticket_index INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS transaction_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'user_tickets_transaction_id_fkey'
        AND conrelid = 'public.user_tickets'::regclass
    )
  THEN
    ALTER TABLE public.user_tickets
      ADD CONSTRAINT user_tickets_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_tickets_user
  ON public.user_tickets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_tickets_event
  ON public.user_tickets(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_tickets_event_status
  ON public.user_tickets(event_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS user_tickets_transaction_index_unique
  ON public.user_tickets(transaction_id, ticket_index)
  WHERE transaction_id IS NOT NULL;

ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_owner_read" ON public.user_tickets;
CREATE POLICY "tickets_owner_read" ON public.user_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tickets_service_write" ON public.user_tickets;
CREATE POLICY "tickets_service_write" ON public.user_tickets
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "tickets_promoter_read" ON public.user_tickets;
CREATE POLICY "tickets_promoter_read" ON public.user_tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id AND e.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "tickets_admin_read" ON public.user_tickets;
CREATE POLICY "tickets_admin_read" ON public.user_tickets
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "tickets_admin_write" ON public.user_tickets;
CREATE POLICY "tickets_admin_write" ON public.user_tickets
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
