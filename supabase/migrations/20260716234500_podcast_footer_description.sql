-- Texto editorial complementario que se muestra al final del detalle del podcast.
ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS footer_description TEXT;

COMMENT ON COLUMN public.podcasts.footer_description IS
  'Notas, créditos o información complementaria mostrada al pie del detalle del podcast.';
