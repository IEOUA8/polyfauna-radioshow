-- ============================================================
-- POLYFAUNA — Música on-demand: álbumes, tracks y storage
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- Seguro de re-ejecutar (idempotente)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- ALBUMS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.albums (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  artist_id    UUID REFERENCES public.artists(id) ON DELETE SET NULL,
  cover_url    TEXT,
  release_year INTEGER,
  genre        TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "albums_public_read"   ON public.albums;
DROP POLICY IF EXISTS "albums_service_write" ON public.albums;
CREATE POLICY "albums_public_read"   ON public.albums FOR SELECT USING (true);
CREATE POLICY "albums_service_write" ON public.albums USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- TRACKS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tracks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  album_id     UUID REFERENCES public.albums(id) ON DELETE CASCADE,
  artist_id    UUID REFERENCES public.artists(id) ON DELETE SET NULL,
  audio_url    TEXT,
  duration     INTEGER,           -- en segundos
  track_number INTEGER,
  genre        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tracks_public_read"   ON public.tracks;
DROP POLICY IF EXISTS "tracks_service_write" ON public.tracks;
CREATE POLICY "tracks_public_read"   ON public.tracks FOR SELECT USING (true);
CREATE POLICY "tracks_service_write" ON public.tracks USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('album-covers',   'album-covers',   true, 10485760,  ARRAY['image/jpeg','image/png','image/webp']),
  ('track-audio',    'track-audio',    true, 524288000, ARRAY['audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/flac']),
  ('podcast-audio',  'podcast-audio',  true, 524288000, ARRAY['audio/mpeg','audio/mp3','audio/ogg','audio/wav']),
  ('podcast-covers', 'podcast-covers', true, 10485760,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "album_covers_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "track_audio_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "podcast_audio_public_read" ON storage.objects;
DROP POLICY IF EXISTS "podcast_covers_public_read" ON storage.objects;

CREATE POLICY "album_covers_public_read"
  ON storage.objects FOR SELECT USING (bucket_id = 'album-covers');

CREATE POLICY "track_audio_public_read"
  ON storage.objects FOR SELECT USING (bucket_id = 'track-audio');

CREATE POLICY "podcast_audio_public_read"
  ON storage.objects FOR SELECT USING (bucket_id = 'podcast-audio');

CREATE POLICY "podcast_covers_public_read"
  ON storage.objects FOR SELECT USING (bucket_id = 'podcast-covers');
