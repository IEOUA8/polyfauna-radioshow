-- POLYFAUNA — Bootstrap operativo para tickets, eventos y devoluciones
-- Idempotente: completa el esquema si la base no recibió la migración inicial.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Perfiles base
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE,
  display_name  TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  city          TEXT,
  website       TEXT,
  social_links  JSONB DEFAULT '{}',
  role          TEXT DEFAULT 'citizen',
  phone         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'citizen',
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_owner_write" ON public.profiles;
CREATE POLICY "profiles_owner_write" ON public.profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'citizen'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Eventos base
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  date           TIMESTAMPTZ,
  venue          TEXT,
  city           TEXT,
  image_url      TEXT,
  price          NUMERIC(10,2) DEFAULT 0,
  lineup         JSONB DEFAULT '[]',
  owner_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status         TEXT DEFAULT 'published',
  tickets_total  INTEGER DEFAULT 100,
  tickets_sold   INTEGER DEFAULT 0,
  featured       BOOLEAN DEFAULT false,
  featured_order INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lineup JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS tickets_total INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS tickets_sold INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_order INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_events_date
  ON public.events(date);

CREATE INDEX IF NOT EXISTS idx_events_owner
  ON public.events(owner_id, date DESC);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_public_read" ON public.events;
CREATE POLICY "events_public_read" ON public.events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "events_service_write" ON public.events;
CREATE POLICY "events_service_write" ON public.events
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

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

DROP POLICY IF EXISTS "events_promoter_update" ON public.events;
CREATE POLICY "events_promoter_update" ON public.events
  FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "events_promoter_delete" ON public.events;
CREATE POLICY "events_promoter_delete" ON public.events
  FOR DELETE
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- Ticket Vault
-- ─────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_user_tickets_user
  ON public.user_tickets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_tickets_event
  ON public.user_tickets(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_tickets_event_status
  ON public.user_tickets(event_id, status);

ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_owner_read" ON public.user_tickets;
CREATE POLICY "tickets_owner_read" ON public.user_tickets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tickets_service_write" ON public.user_tickets;
CREATE POLICY "tickets_service_write" ON public.user_tickets
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "tickets_promoter_read" ON public.user_tickets;
CREATE POLICY "tickets_promoter_read" ON public.user_tickets
  FOR SELECT USING (
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
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "tickets_admin_write" ON public.user_tickets;
CREATE POLICY "tickets_admin_write" ON public.user_tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- Transacciones mínimas para pagos/tickets
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id            UUID REFERENCES public.user_tickets(id),
  event_id             UUID REFERENCES public.events(id),
  buyer_id             UUID REFERENCES auth.users(id),
  promoter_id          UUID REFERENCES auth.users(id),
  amount_total         BIGINT NOT NULL DEFAULT 0,
  platform_fee         BIGINT NOT NULL DEFAULT 0,
  promoter_amount      BIGINT NOT NULL DEFAULT 0,
  payment_method       TEXT,
  wompi_transaction_id TEXT UNIQUE,
  wompi_reference      TEXT UNIQUE,
  status               TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined','voided','error')),
  wompi_payload        JSONB,
  paid_at              TIMESTAMPTZ,
  release_at           TIMESTAMPTZ,
  quantity             INTEGER NOT NULL DEFAULT 1,
  assigned_emails      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_emails JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_quantity_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_quantity_check CHECK (quantity BETWEEN 1 AND 4);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_tickets_transaction_id_fkey'
      AND conrelid = 'public.user_tickets'::regclass
  ) THEN
    ALTER TABLE public.user_tickets
      ADD CONSTRAINT user_tickets_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_tickets_transaction_index_unique
  ON public.user_tickets(transaction_id, ticket_index)
  WHERE transaction_id IS NOT NULL;
