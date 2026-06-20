-- ============================================================
-- POLYFAUNA — Sistema de pagos Wompi
-- Tablas: promoter_accounts, wallets, transactions, payouts
-- Funciones: get_or_create_wallet, add_to_pending_wallet,
--            release_pending_balance, issue_ticket_for_user
-- ============================================================

-- ─── 1. Cuentas bancarias de promotores ────────────────────────
CREATE TABLE IF NOT EXISTS public.promoter_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_holder   TEXT NOT NULL,
  document_type    TEXT NOT NULL CHECK (document_type IN ('CC', 'NIT', 'CE', 'Pasaporte')),
  document_number  TEXT NOT NULL,
  bank_name        TEXT NOT NULL,
  account_type     TEXT NOT NULL CHECK (account_type IN ('ahorros', 'corriente')),
  account_number   TEXT NOT NULL,
  verified         BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── 2. Wallets por usuario ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_available  BIGINT DEFAULT 0,   -- COP disponible para retiro
  balance_pending    BIGINT DEFAULT 0,   -- COP en espera (48h post-evento)
  total_earned       BIGINT DEFAULT 0,   -- COP acumulado histórico
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── 3. Transacciones de pago ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id            UUID REFERENCES public.user_tickets(id),
  event_id             UUID REFERENCES public.events(id),
  buyer_id             UUID REFERENCES auth.users(id),
  promoter_id          UUID REFERENCES auth.users(id),
  amount_total         BIGINT NOT NULL,    -- COP total pagado (en pesos)
  platform_fee         BIGINT NOT NULL,    -- COP comisión plataforma
  promoter_amount      BIGINT NOT NULL,    -- COP para el promotor
  payment_method       TEXT,               -- PSE, CARD, NEQUI, etc.
  wompi_transaction_id TEXT UNIQUE,
  wompi_reference      TEXT UNIQUE,
  status               TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined','voided','error')),
  wompi_payload        JSONB,
  paid_at              TIMESTAMPTZ,
  release_at           TIMESTAMPTZ,        -- cuándo mover pending → available
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Solicitudes de retiro ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payouts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id),
  amount             BIGINT NOT NULL,      -- COP a transferir
  status             TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','rejected')),
  account_snapshot   JSONB,               -- copia de promoter_accounts al momento
  transfer_reference TEXT,                -- referencia bancaria (admin)
  admin_notes        TEXT,
  requested_at       TIMESTAMPTZ DEFAULT NOW(),
  processed_at       TIMESTAMPTZ
);

-- ─── RLS ────────────────────────────────────────────────────────

ALTER TABLE public.promoter_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts           ENABLE ROW LEVEL SECURITY;

-- promoter_accounts
DROP POLICY IF EXISTS "pa_own"   ON public.promoter_accounts;
DROP POLICY IF EXISTS "pa_admin" ON public.promoter_accounts;
CREATE POLICY "pa_own" ON public.promoter_accounts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pa_admin" ON public.promoter_accounts
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- wallets
DROP POLICY IF EXISTS "wallet_own_read" ON public.wallets;
DROP POLICY IF EXISTS "wallet_admin"    ON public.wallets;
CREATE POLICY "wallet_own_read" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallet_admin" ON public.wallets
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- transactions: buyer ve las suyas, promoter ve las de sus eventos, admin ve todo
DROP POLICY IF EXISTS "tx_buyer"    ON public.transactions;
DROP POLICY IF EXISTS "tx_promoter" ON public.transactions;
DROP POLICY IF EXISTS "tx_admin"    ON public.transactions;
CREATE POLICY "tx_buyer"    ON public.transactions FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "tx_promoter" ON public.transactions FOR SELECT USING (auth.uid() = promoter_id);
CREATE POLICY "tx_admin"    ON public.transactions FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- payouts
DROP POLICY IF EXISTS "payout_own_read"   ON public.payouts;
DROP POLICY IF EXISTS "payout_own_insert" ON public.payouts;
DROP POLICY IF EXISTS "payout_admin"      ON public.payouts;
CREATE POLICY "payout_own_read"   ON public.payouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payout_own_insert" ON public.payouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payout_admin"      ON public.payouts FOR ALL USING (
  EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ─── Permisos de tabla ──────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.promoter_accounts TO authenticated;
GRANT SELECT                 ON public.wallets           TO authenticated;
GRANT SELECT                 ON public.transactions      TO authenticated;
GRANT SELECT, INSERT         ON public.payouts           TO authenticated;

-- ─── Funciones helper (solo service_role las llama) ────────────

-- Crear wallet si no existe, retornar el registro
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(p_user_id UUID)
RETURNS public.wallets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets;
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  RETURN v_wallet;
END;
$$;

-- Sumar monto al wallet pending de un promotor (llamado por webhook)
CREATE OR REPLACE FUNCTION public.add_to_pending_wallet(
  p_user_id  UUID,
  p_amount   BIGINT,
  p_total    BIGINT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance_pending, total_earned, updated_at)
  VALUES (p_user_id, p_amount, p_total, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET balance_pending = wallets.balance_pending + EXCLUDED.balance_pending,
        total_earned    = wallets.total_earned    + EXCLUDED.total_earned,
        updated_at      = NOW();
END;
$$;

-- Liberar saldo pending → available según release_at de transacciones
CREATE OR REPLACE FUNCTION public.release_pending_balances()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_promoter RECORD;
  v_released BIGINT;
  v_count    INTEGER := 0;
BEGIN
  FOR v_promoter IN
    SELECT DISTINCT promoter_id
    FROM public.transactions
    WHERE status = 'approved'
      AND release_at <= NOW()
      AND release_at IS NOT NULL
  LOOP
    SELECT COALESCE(SUM(promoter_amount), 0) INTO v_released
    FROM public.transactions
    WHERE promoter_id = v_promoter.promoter_id
      AND status = 'approved'
      AND release_at <= NOW();

    UPDATE public.wallets
    SET balance_available = v_released,
        balance_pending   = GREATEST(0, total_earned - v_released),
        updated_at        = NOW()
    WHERE user_id = v_promoter.promoter_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Emitir ticket desde el webhook (no depende de auth.uid())
CREATE OR REPLACE FUNCTION public.issue_ticket_for_user(
  p_event_id    UUID,
  p_user_id     UUID,
  p_ticket_type TEXT DEFAULT 'GA'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event         events%ROWTYPE;
  v_ticket_id     UUID;
  v_ticket_number TEXT;
  v_existing      UUID;
BEGIN
  -- ¿Ya tiene entrada para este evento?
  SELECT id INTO v_existing
  FROM user_tickets
  WHERE user_id = p_user_id AND event_id = p_event_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Ya tiene entrada', 'code', 'DUPLICATE', 'ticket_id', v_existing
    );
  END IF;

  -- Lock del evento para evitar overselling
  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento no encontrado', 'code', 'NOT_FOUND');
  END IF;

  IF COALESCE(v_event.tickets_sold, 0) >= COALESCE(v_event.tickets_total, 999999) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entradas agotadas', 'code', 'SOLD_OUT');
  END IF;

  v_ticket_number := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  INSERT INTO user_tickets (user_id, event_id, ticket_number, ticket_type, status)
  VALUES (p_user_id, p_event_id, v_ticket_number, p_ticket_type, 'valid')
  RETURNING id INTO v_ticket_id;

  UPDATE events SET tickets_sold = COALESCE(tickets_sold, 0) + 1 WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success',       true,
    'ticket_id',     v_ticket_id,
    'ticket_number', v_ticket_number,
    'event_title',   v_event.title
  );
END;
$$;

-- Descontar del balance_available al aprobar un retiro
CREATE OR REPLACE FUNCTION public.approve_payout(
  p_payout_id         UUID,
  p_transfer_reference TEXT,
  p_admin_notes        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payout public.payouts;
BEGIN
  -- Solo admins
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_payout FROM public.payouts WHERE id = p_payout_id FOR UPDATE;

  IF NOT FOUND OR v_payout.status != 'pending' THEN
    RAISE EXCEPTION 'Retiro no encontrado o ya procesado';
  END IF;

  UPDATE public.payouts
  SET status             = 'completed',
      transfer_reference = p_transfer_reference,
      admin_notes        = COALESCE(p_admin_notes, admin_notes),
      processed_at       = NOW()
  WHERE id = p_payout_id;

  UPDATE public.wallets
  SET balance_available = GREATEST(0, balance_available - v_payout.amount),
      updated_at        = NOW()
  WHERE user_id = v_payout.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_wallet(UUID)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_wallet(UUID)                          TO service_role;
GRANT EXECUTE ON FUNCTION public.add_to_pending_wallet(UUID, BIGINT, BIGINT)         TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pending_balances()                          TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_ticket_for_user(UUID, UUID, TEXT)             TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_payout(UUID, TEXT, TEXT)                   TO authenticated;
