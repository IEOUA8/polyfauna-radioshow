-- ── 1. Artist slug ────────────────────────────────────────────
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slug from name (lowercase, replace spaces/special chars with hyphens)
UPDATE public.artists
SET slug = lower(
  regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s\-]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Deduplicate: if two artists share a slug, append short id to the later one
UPDATE public.artists a1
SET slug = a1.slug || '-' || substr(a1.id::text, 1, 8)
WHERE EXISTS (
  SELECT 1 FROM public.artists a2
  WHERE a2.slug = a1.slug AND a2.id < a1.id
);

ALTER TABLE public.artists ADD CONSTRAINT artists_slug_unique UNIQUE (slug);
ALTER TABLE public.artists ALTER COLUMN slug SET NOT NULL;

-- ── 2. Web Push subscriptions ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth_key   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_own_read"   ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_own_insert" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_own_delete" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
