-- POLYFAUNA — errores de cliente para operación de beta
CREATE TABLE IF NOT EXISTS public.client_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'fatal')),
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  source TEXT CHECK (char_length(source) <= 120),
  route TEXT CHECK (char_length(route) <= 300),
  stack TEXT CHECK (char_length(stack) <= 4000),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS client_errors_created_at_idx ON public.client_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS client_errors_session_idx ON public.client_errors(session_id, created_at DESC);
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_errors_admin_read" ON public.client_errors;
CREATE POLICY "client_errors_admin_read" ON public.client_errors
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

REVOKE ALL ON public.client_errors FROM anon, authenticated;
GRANT SELECT ON public.client_errors TO authenticated;
GRANT ALL ON public.client_errors TO service_role;
