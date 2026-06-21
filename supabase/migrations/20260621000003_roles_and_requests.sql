-- ─────────────────────────────────────────────────────────────────────────────
-- Roles ampliados + tabla role_requests
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Agregar rol 'sello' al enum de roles permitidos en profiles
--    (no hay CHECK constraint, solo actualizamos el default comment)
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'citizen';

-- 2. Actualizar handle_new_user para leer el rol solicitado del metadata
--    Solo se persiste como pendiente en role_requests; el perfil siempre
--    inicia con 'citizen' para mayor seguridad.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- 3. Tabla de solicitudes de rol
CREATE TABLE IF NOT EXISTS public.role_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_role   TEXT NOT NULL CHECK (requested_role IN ('artist','promoter','club','sello')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  form_data        JSONB DEFAULT '{}',
  reviewed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

-- Usuario puede leer sus propias solicitudes
CREATE POLICY "role_requests_owner_read"
  ON public.role_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Usuario puede crear su propia solicitud
CREATE POLICY "role_requests_owner_insert"
  ON public.role_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin puede leer y actualizar todas
CREATE POLICY "role_requests_admin_read"
  ON public.role_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "role_requests_admin_update"
  ON public.role_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Index para listar pendientes rápido
CREATE INDEX IF NOT EXISTS idx_role_requests_status
  ON public.role_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_requests_user
  ON public.role_requests(user_id);
