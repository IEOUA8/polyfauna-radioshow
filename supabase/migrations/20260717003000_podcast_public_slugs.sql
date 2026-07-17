ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE OR REPLACE FUNCTION public.normalize_podcast_slug(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(
    trim(BOTH '-' FROM regexp_replace(
      translate(
        lower(COALESCE(p_value, '')),
        'áàäâãåéèëêíìïîóòöôõúùüûñç',
        'aaaaaaeeeeiiiiooooouuuunc'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.set_podcast_public_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  base_slug TEXT;
BEGIN
  base_slug := public.normalize_podcast_slug(COALESCE(NEW.slug, NEW.title));
  IF base_slug IS NULL THEN
    base_slug := NEW.id::TEXT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.podcasts p
    WHERE p.slug = base_slug
      AND p.id <> NEW.id
  ) THEN
    base_slug := base_slug || '-' || left(NEW.id::TEXT, 8);
  END IF;

  NEW.slug := base_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS podcasts_set_public_slug ON public.podcasts;
CREATE TRIGGER podcasts_set_public_slug
BEFORE INSERT OR UPDATE OF title, slug ON public.podcasts
FOR EACH ROW
EXECUTE FUNCTION public.set_podcast_public_slug();

UPDATE public.podcasts
SET slug = public.normalize_podcast_slug(title)
WHERE slug IS NULL OR btrim(slug) = '';

CREATE UNIQUE INDEX IF NOT EXISTS podcasts_slug_unique_idx
  ON public.podcasts (slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.podcasts.slug IS
  'Identificador público estable para la URL canónica y los metadatos sociales del podcast.';
