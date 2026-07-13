-- ─────────────────────────────────────────────────────────────
-- BLOG ARTICLES · contenido enriquecido + reconciliación de schema
-- ─────────────────────────────────────────────────────────────
-- Contexto: el lector (BlogInterviewsSection.jsx) y el admin
-- (BlogManager.jsx) leían/escribían columnas que NUNCA existieron en
-- la tabla real de producción:
--   · lector  → cover_url, excerpt, external_url, published_at  (SELECT + ORDER)
--   · admin   → created_by                                       (INSERT)
-- Como la consulta del feed ordena por published_at, la sección Blog
-- devolvía HTTP 400 y quedaba rota. Esta migración añade esas columnas
-- (todas nullable / con default, es aditiva y no destructiva) y agrega
-- content_format para soportar artículos con estructura editorial rica
-- (bloques JSON) además del texto plano legado.

ALTER TABLE public.blog_articles
  ADD COLUMN IF NOT EXISTS cover_url      TEXT,
  ADD COLUMN IF NOT EXISTS excerpt        TEXT,
  ADD COLUMN IF NOT EXISTS external_url   TEXT,
  ADD COLUMN IF NOT EXISTS published_at   TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'text';

-- content_format: 'text' = prosa plana (comportamiento legado, se pinta
-- con whitespace-pre-wrap) · 'blocks' = JSON de bloques editoriales
-- (párrafos con capitular, cita, secciones, lista de hábitats, figuras).
ALTER TABLE public.blog_articles
  DROP CONSTRAINT IF EXISTS blog_articles_content_format_check;
ALTER TABLE public.blog_articles
  ADD CONSTRAINT blog_articles_content_format_check
  CHECK (content_format IN ('text', 'blocks'));

-- Backfill para filas existentes: la portada usa cover_url y el feed
-- ordena por published_at, así que heredamos de las columnas viejas.
UPDATE public.blog_articles
   SET cover_url    = COALESCE(cover_url, featured_image_url),
       published_at = COALESCE(published_at, created_at)
 WHERE cover_url IS NULL OR published_at IS NULL;

-- Orden del feed por fecha de publicación.
CREATE INDEX IF NOT EXISTS blog_articles_published_at_idx
  ON public.blog_articles (published_at DESC);

-- ─────────────────────────────────────────────────────────────
-- STORAGE · bucket público para imágenes de artículos
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('blog-images', 'blog-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/avif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "blog_images_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_insert"  ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_update"  ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_delete"  ON storage.objects;

CREATE POLICY "blog_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

CREATE POLICY "blog_images_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "blog_images_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "blog_images_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
