-- Fase 9 de POLYFAUNA_EVENTOS_ORGANIZADORES_MASTER.md — migración de datos:
-- pobla events.venue_organizer_id a partir del texto libre events.venue.
--
-- Esto NO es una migración de esquema (no se aplica con `supabase db push`):
-- requiere revisión manual de duplicados/variantes de nombre antes de crear
-- cada organizador, así que se ejecuta paso a paso, a mano, en el SQL Editor
-- de Supabase o vía `supabase db query --linked`.
--
-- ─── Paso 1: revisar qué venues existen y con qué frecuencia ───
-- Antes de crear un solo organizador, correr esto y revisar la lista:
-- descarta placeholders (ej. "Locación secreta") y agrupa variantes del
-- mismo venue (ej. mayúsculas/minúsculas, con/sin sufijo de ciudad).

SELECT venue, city, count(*) AS n
FROM public.events
WHERE venue IS NOT NULL AND trim(venue) <> ''
GROUP BY venue, city
ORDER BY n DESC;

-- ─── Paso 2: por cada venue real confirmado, crear su organizador ───
-- Repetir este INSERT (con los valores del venue confirmado) por cada fila
-- que sí represente un venue real. slug debe ser único.
--
-- INSERT INTO public.organizers (slug, name, type, city)
-- VALUES ('<slug-unico>', '<Nombre del venue>', 'club', '<Ciudad>')
-- RETURNING id;

-- ─── Paso 3: vincular los eventos de ese venue al organizador creado ───
-- Usar el id devuelto en el paso 2.
--
-- UPDATE public.events
-- SET venue_organizer_id = '<id-del-organizador>'
-- WHERE venue = '<Nombre del venue>' AND city = '<Ciudad>';

-- ─── Paso 4 (opcional): puente curatorial ───
-- Si además quieres que el evento aparezca en el tab "Eventos" del perfil
-- público del organizador (no solo tener venue_organizer_id poblado),
-- agregar también la fila en event_organizers:
--
-- INSERT INTO public.event_organizers (event_id, organizer_id, role_in_event)
-- SELECT id, '<id-del-organizador>', 'venue'
-- FROM public.events
-- WHERE venue = '<Nombre del venue>' AND city = '<Ciudad>'
-- ON CONFLICT (event_id, organizer_id) DO NOTHING;
