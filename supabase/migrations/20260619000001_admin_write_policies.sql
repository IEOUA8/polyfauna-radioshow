-- ============================================================
-- POLYFAUNA — Políticas de escritura para usuarios admin
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- Idempotente (usa DROP IF EXISTS antes de crear)
--
-- El rol admin se determina por profiles.role = 'admin'.
-- El cliente browser (anon key) puede escribir cuando el
-- usuario autenticado tiene ese rol en su perfil.
-- ============================================================

-- Helper: verifica si el usuario actual es admin
-- (se usa como subquery en cada política)

-- ─────────────────────────────────────────────────────────────
-- ARTISTS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "artists_admin_write" ON public.artists;
CREATE POLICY "artists_admin_write" ON public.artists
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- EVENTS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_admin_write" ON public.events;
CREATE POLICY "events_admin_write" ON public.events
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- BLOG ARTICLES
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "blog_articles_admin_write" ON public.blog_articles;
CREATE POLICY "blog_articles_admin_write" ON public.blog_articles
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- INTERVIEWS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "interviews_admin_write" ON public.interviews;
CREATE POLICY "interviews_admin_write" ON public.interviews
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- RADIO SHOWS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "radio_shows_admin_write" ON public.radio_shows;
CREATE POLICY "radio_shows_admin_write" ON public.radio_shows
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- ALBUMS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "albums_admin_write" ON public.albums;
CREATE POLICY "albums_admin_write" ON public.albums
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- TRACKS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tracks_admin_write" ON public.tracks;
CREATE POLICY "tracks_admin_write" ON public.tracks
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- MESSAGES (Signal Inbox — admin puede enviar mensajes)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_admin_write" ON public.messages;
CREATE POLICY "messages_admin_write" ON public.messages
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- USER TICKETS (admin puede emitir entradas)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tickets_admin_write" ON public.user_tickets;
CREATE POLICY "tickets_admin_write" ON public.user_tickets
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────
-- STORAGE — admin puede subir a todos los buckets
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "storage_admin_all" ON storage.objects;
CREATE POLICY "storage_admin_all" ON storage.objects
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
