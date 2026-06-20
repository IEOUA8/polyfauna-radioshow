-- ============================================================
-- POLYFAUNA — Comentarios de podcasts + contador de plays
-- ============================================================

-- ── play_count en podcasts ─────────────────────────────────────
ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0;

-- Función para incrementar plays (llamada desde el cliente al reproducir)
CREATE OR REPLACE FUNCTION public.increment_podcast_plays(p_podcast_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.podcasts SET play_count = play_count + 1 WHERE id = p_podcast_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_podcast_plays(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_podcast_plays(UUID) TO anon;

-- ── podcast_comments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.podcast_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id UUID        NOT NULL REFERENCES public.podcasts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS podcast_comments_podcast_id_idx ON public.podcast_comments(podcast_id);

ALTER TABLE public.podcast_comments ENABLE ROW LEVEL SECURITY;

-- Lectura pública
DROP POLICY IF EXISTS "comments_read"         ON public.podcast_comments;
CREATE POLICY "comments_read" ON public.podcast_comments
  FOR SELECT USING (true);

-- Insertar solo el propio usuario
DROP POLICY IF EXISTS "comments_insert"       ON public.podcast_comments;
CREATE POLICY "comments_insert" ON public.podcast_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Borrar el propio comentario
DROP POLICY IF EXISTS "comments_own_delete"   ON public.podcast_comments;
CREATE POLICY "comments_own_delete" ON public.podcast_comments
  FOR DELETE USING (user_id = auth.uid());

-- Admin puede borrar cualquiera
DROP POLICY IF EXISTS "comments_admin_delete" ON public.podcast_comments;
CREATE POLICY "comments_admin_delete" ON public.podcast_comments
  FOR DELETE USING (
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT SELECT                 ON public.podcast_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.podcast_comments TO authenticated;
