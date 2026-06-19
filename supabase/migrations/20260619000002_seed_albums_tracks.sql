-- ============================================================
-- POLYFAUNA — Seed: Álbumes y tracks iniciales
-- Ejecutar DESPUÉS de 20260619000001_admin_write_policies.sql
-- Idempotente: usa ON CONFLICT DO NOTHING
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ÁLBUMES
-- Usamos subqueries para obtener artist_id por nombre
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.albums (title, artist_id, cover_url, release_year, genre, description)
SELECT
  'Dark Matter',
  id,
  'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop',
  2024,
  'Techno',
  'Debut LP de Nox Vega. Seis tracks de techno oscuro e industrial grabados en vivo en Berlín.'
FROM public.artists WHERE name = 'Nox Vega' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.albums (title, artist_id, cover_url, release_year, genre, description)
SELECT
  'Síntesis Orgánica',
  id,
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=600&auto=format&fit=crop',
  2025,
  'Experimental',
  'Segundo álbum de AQUMA. Exploración de ritmos latinoamericanos procesados con síntesis modular.'
FROM public.artists WHERE name = 'AQUMA' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.albums (title, artist_id, cover_url, release_year, genre, description)
SELECT
  'Late Sunday',
  id,
  'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=600&auto=format&fit=crop',
  2024,
  'Melodic House',
  'EP debut de Velvet Pulse. House melódico y deep techno pensado para tardes de domingo.'
FROM public.artists WHERE name = 'Velvet Pulse' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.albums (title, artist_id, cover_url, release_year, genre, description)
SELECT
  'Campo Concreto',
  id,
  'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?q=80&w=600&auto=format&fit=crop',
  2025,
  'Electroacoustic',
  'RDRG usa field recordings de la ciudad como materia prima para este álbum de música concreta.'
FROM public.artists WHERE name = 'RDRG' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.albums (title, artist_id, cover_url, release_year, genre, description)
SELECT
  'Pressure System',
  id,
  'https://images.unsplash.com/photo-1534536281715-e28d76689b4d?q=80&w=600&auto=format&fit=crop',
  2024,
  'Drum & Bass',
  'KRÜ reúne en este álbum lo mejor de 15 años de DnB y jungle en la escena underground bogotana.'
FROM public.artists WHERE name = 'KRÜ' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.albums (title, artist_id, cover_url, release_year, genre, description)
SELECT
  'Atmósfera',
  id,
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
  2025,
  'Ambient',
  'Colección de drones y paisajes sonoros del colectivo Synthetic Bloom. Escucha en auriculares.'
FROM public.artists WHERE name = 'Synthetic Bloom' LIMIT 1
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- TRACKS — Dark Matter (Nox Vega)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT
  'Void Entrance',
  a.id,
  ar.id,
  1,
  'Techno',
  487
FROM public.albums a
JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Dark Matter' AND ar.name = 'Nox Vega'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Ferric Core', a.id, ar.id, 2, 'Techno', 612
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Dark Matter' AND ar.name = 'Nox Vega' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Subterranean', a.id, ar.id, 3, 'Techno', 558
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Dark Matter' AND ar.name = 'Nox Vega' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Pressure Chamber', a.id, ar.id, 4, 'Techno', 703
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Dark Matter' AND ar.name = 'Nox Vega' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Event Horizon', a.id, ar.id, 5, 'Techno', 820
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Dark Matter' AND ar.name = 'Nox Vega' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Dark Matter (Reprise)', a.id, ar.id, 6, 'Dark Ambient', 394
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Dark Matter' AND ar.name = 'Nox Vega' LIMIT 1 ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- TRACKS — Síntesis Orgánica (AQUMA)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Raíz Digital', a.id, ar.id, 1, 'Experimental', 342
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Síntesis Orgánica' AND ar.name = 'AQUMA' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Cumbia Modular', a.id, ar.id, 2, 'Experimental', 418
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Síntesis Orgánica' AND ar.name = 'AQUMA' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Vallenato Eléctrico', a.id, ar.id, 3, 'Experimental', 376
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Síntesis Orgánica' AND ar.name = 'AQUMA' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Patch Bay Dreams', a.id, ar.id, 4, 'Modular', 521
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Síntesis Orgánica' AND ar.name = 'AQUMA' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Voltaje Sur', a.id, ar.id, 5, 'Experimental', 467
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Síntesis Orgánica' AND ar.name = 'AQUMA' LIMIT 1 ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- TRACKS — Late Sunday (Velvet Pulse)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Ritual Opening', a.id, ar.id, 1, 'Melodic House', 398
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Late Sunday' AND ar.name = 'Velvet Pulse' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Dusk Drive', a.id, ar.id, 2, 'Deep Techno', 511
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Late Sunday' AND ar.name = 'Velvet Pulse' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Afro Signal', a.id, ar.id, 3, 'Afro House', 447
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Late Sunday' AND ar.name = 'Velvet Pulse' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Golden Hour Loop', a.id, ar.id, 4, 'Melodic House', 589
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Late Sunday' AND ar.name = 'Velvet Pulse' LIMIT 1 ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- TRACKS — Pressure System (KRÜ)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Jungle Boot', a.id, ar.id, 1, 'Jungle', 312
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Pressure System' AND ar.name = 'KRÜ' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Neuro Pressure', a.id, ar.id, 2, 'Neurofunk', 408
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Pressure System' AND ar.name = 'KRÜ' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Bogotá Rave', a.id, ar.id, 3, 'Drum & Bass', 356
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Pressure System' AND ar.name = 'KRÜ' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'Step Up Classic', a.id, ar.id, 4, 'Jump Up', 289
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Pressure System' AND ar.name = 'KRÜ' LIMIT 1 ON CONFLICT DO NOTHING;

INSERT INTO public.tracks (title, album_id, artist_id, track_number, genre, duration)
SELECT 'System Override', a.id, ar.id, 5, 'Drum & Bass', 445
FROM public.albums a JOIN public.artists ar ON ar.id = a.artist_id
WHERE a.title = 'Pressure System' AND ar.name = 'KRÜ' LIMIT 1 ON CONFLICT DO NOTHING;
