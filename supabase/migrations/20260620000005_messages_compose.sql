-- ─────────────────────────────────────────────────────────────────────────────
-- User-to-user messaging: add from_user_id + to_display_name, fix RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_display_name TEXT;

-- 2. Index for "sent by me" queries
CREATE INDEX IF NOT EXISTS idx_messages_from_user ON public.messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_user   ON public.messages(to_user_id);

-- 3. Enable RLS (idempotent)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Drop any old permissive policies to replace with precise ones
DROP POLICY IF EXISTS "Allow all for authenticated users"   ON public.messages;
DROP POLICY IF EXISTS "messages_select_own"                 ON public.messages;
DROP POLICY IF EXISTS "messages_insert_system"              ON public.messages;
DROP POLICY IF EXISTS "messages_update_own"                 ON public.messages;
DROP POLICY IF EXISTS "messages_read_received"              ON public.messages;
DROP POLICY IF EXISTS "messages_read_sent"                  ON public.messages;
DROP POLICY IF EXISTS "messages_insert_auth"                ON public.messages;
DROP POLICY IF EXISTS "messages_update_read"                ON public.messages;

-- 5. Users can read messages they received
CREATE POLICY "messages_read_received" ON public.messages
  FOR SELECT USING (auth.uid() = to_user_id);

-- 6. Users can read messages they sent
CREATE POLICY "messages_read_sent" ON public.messages
  FOR SELECT USING (auth.uid() = from_user_id);

-- 7. Authenticated users can insert messages (must be the sender)
CREATE POLICY "messages_insert_auth" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- 8. Recipients can mark messages as read
CREATE POLICY "messages_update_read" ON public.messages
  FOR UPDATE USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

-- 9. Profiles: allow authenticated users to search other profiles for messaging
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_read_authenticated'
  ) THEN
    CREATE POLICY "profiles_read_authenticated" ON public.profiles
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
