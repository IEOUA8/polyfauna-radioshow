-- Cierra el gap de vínculo artista-entrevista. Ver POLYFAUNA_EVENTOS_ORGANIZADORES_MASTER.md, sección 3.2.

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS subject_artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL;
-- 'subject' (TEXT) se conserva para entrevistas grupales o temáticas
-- sin un artista único asociado (ej. "Escena techno en Bogotá 2026").

CREATE INDEX IF NOT EXISTS idx_interviews_subject_artist_id ON public.interviews(subject_artist_id);

NOTIFY pgrst, 'reload schema';
