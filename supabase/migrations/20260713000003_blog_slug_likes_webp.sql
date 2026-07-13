-- ─────────────────────────────────────────────────────────────
-- BLOG · slug para URLs limpias/SEO, likes públicos y switch a webp
-- ─────────────────────────────────────────────────────────────

-- 1. slug (URL editorial /blog/<slug>) y like_count (contador público).
ALTER TABLE public.blog_articles
  ADD COLUMN IF NOT EXISTS slug       TEXT,
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

-- Backfill slug del primer artículo.
UPDATE public.blog_articles SET slug = 'fauna-de-altura'
  WHERE title = 'Fauna de altura' AND slug IS NULL;

-- slug único (permite varios NULL mientras se completan artículos viejos).
CREATE UNIQUE INDEX IF NOT EXISTS blog_articles_slug_key
  ON public.blog_articles (slug) WHERE slug IS NOT NULL;

-- 2. Las imágenes del lector pasan a webp (mucho más livianas). El OG social
--    sigue en JPG (og.jpg) y no vive en el content. Los únicos ".png" del
--    contenido son las rutas de imagen del artículo, así que el reemplazo es
--    seguro.
UPDATE public.blog_articles
   SET cover_url = replace(cover_url, '.png', '.webp'),
       content   = replace(content, '.png', '.webp')
 WHERE slug = 'fauna-de-altura';

-- 3. Like público con contador. Los artículos son contenido abierto, así que
--    la RPC es invocable por anónimos; solo ajusta un contador acotado a >= 0
--    (el cliente evita doble voto con localStorage). SECURITY DEFINER +
--    search_path fijo, en línea con el endurecimiento de la fase 7.2.
CREATE OR REPLACE FUNCTION public.toggle_article_like(p_article_id UUID, p_liked BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_liked THEN
    UPDATE public.blog_articles
       SET like_count = like_count + 1
     WHERE id = p_article_id
     RETURNING like_count INTO v_count;
  ELSE
    UPDATE public.blog_articles
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = p_article_id
     RETURNING like_count INTO v_count;
  END IF;
  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_article_like(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_article_like(UUID, BOOLEAN) TO anon, authenticated;
