-- ============================================================
-- POLYFAUNA — Perfiles, Favoritos, Playlists, Likes
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE,
  display_name  TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  city          TEXT,
  website       TEXT,
  social_links  JSONB DEFAULT '{}',
  role          TEXT DEFAULT 'citizen',   -- citizen | artist | promoter | club | admin
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read"  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_owner_write"  ON public.profiles FOR ALL USING (auth.uid() = id);

-- Auto-crear perfil cuando un usuario se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. USER FAVORITES (eventos, podcasts, artistas)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type   TEXT NOT NULL CHECK (item_type IN ('event','podcast','artist')),
  item_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, item_type, item_id)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_owner_all" ON public.user_favorites FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. USER LIKES (podcasts / tracks)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  podcast_id  UUID REFERENCES public.podcasts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, podcast_id)
);

ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_owner_all" ON public.user_likes FOR ALL USING (auth.uid() = user_id);

-- Count de likes por podcast (columna desnormalizada para performance)
ALTER TABLE public.podcasts ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_podcast_likes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.podcasts SET likes_count = likes_count + 1 WHERE id = NEW.podcast_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.podcasts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.podcast_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS podcast_likes_count ON public.user_likes;
CREATE TRIGGER podcast_likes_count
  AFTER INSERT OR DELETE ON public.user_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_podcast_likes();

-- ─────────────────────────────────────────────────────────────
-- 4. PLAYLISTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  cover_url   TEXT,
  is_public   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlists_public_read"  ON public.playlists FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "playlists_owner_write" ON public.playlists FOR ALL USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS playlists_updated_at ON public.playlists;
CREATE TRIGGER playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5. PLAYLIST TRACKS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE,
  podcast_id  UUID REFERENCES public.podcasts(id) ON DELETE CASCADE,
  position    INTEGER DEFAULT 0,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (playlist_id, podcast_id)
);

ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlist_tracks_read" ON public.playlist_tracks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_id AND (p.is_public = true OR p.user_id = auth.uid())
  ));
CREATE POLICY "playlist_tracks_owner_write" ON public.playlist_tracks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- 6. PROMOTER EVENTS (eventos creados por promotores)
--    Reutilizamos la tabla events, solo agregamos owner_id
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tickets_total INTEGER DEFAULT 100;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tickets_sold INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'; -- draft | published | cancelled

-- Permisos de escritura al promotor dueño del evento
CREATE POLICY "events_owner_write" ON public.events FOR ALL
  USING (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────
-- 7. STORAGE BUCKET para avatares
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_owner_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
