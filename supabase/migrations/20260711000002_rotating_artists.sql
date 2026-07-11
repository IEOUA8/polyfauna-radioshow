-- Rotacion publica de "Artistas" en RightPanel: hoy no hay ORDER BY en
-- ningun lado (ni en artists_public ni en el query del cliente), asi que
-- todos los usuarios ven siempre los mismos 5 artistas en el mismo orden,
-- para siempre. Esta funcion devuelve un subconjunto pseudo-aleatorio pero
-- ESTABLE dentro de ventanas de 25 minutos (1500s): el mismo bucket de
-- tiempo produce el mismo orden para todos los usuarios, y cambia solo al
-- pasar la ventana, sin necesidad de cron ni cache.

CREATE OR REPLACE FUNCTION public.get_rotating_artists(p_limit INT DEFAULT 8)
RETURNS TABLE (id UUID, name TEXT, slug TEXT, image_url TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT a.id, a.name, a.slug, a.image_url
  FROM public.artists_public a
  ORDER BY md5(a.id::text || (floor(extract(epoch FROM now()) / 1500))::text)
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_rotating_artists(INT) TO anon, authenticated;
