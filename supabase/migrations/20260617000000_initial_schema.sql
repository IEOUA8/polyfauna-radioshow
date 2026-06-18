-- ============================================================
-- POLYFAUNA RADIO SHOW — Migración completa de base de datos
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ARTISTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.artists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  bio         TEXT,
  image_url   TEXT,
  type        TEXT DEFAULT 'DJ',
  genres      JSONB DEFAULT '[]',
  social_links JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artists_public_read" ON public.artists FOR SELECT USING (true);
CREATE POLICY "artists_service_write" ON public.artists USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 2. EVENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  date        TIMESTAMPTZ,
  venue       TEXT,
  city        TEXT,
  image_url   TEXT,
  price       NUMERIC(10,2) DEFAULT 0,
  lineup      JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_public_read" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_service_write" ON public.events USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 3. PODCASTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.podcasts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  cover_url   TEXT,
  audio_url   TEXT,
  duration    INTEGER,
  genre       TEXT,
  artist_id   UUID REFERENCES public.artists(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.podcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "podcasts_public_read" ON public.podcasts FOR SELECT USING (true);
CREATE POLICY "podcasts_service_write" ON public.podcasts USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 4. RADIO SHOWS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.radio_shows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  dj          TEXT,
  schedule    TEXT,
  genre       TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.radio_shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "radio_shows_public_read" ON public.radio_shows FOR SELECT USING (true);
CREATE POLICY "radio_shows_service_write" ON public.radio_shows USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 5. BLOG ARTICLES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blog_articles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  content             TEXT,
  category            TEXT,
  author              TEXT,
  featured_image_url  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blog_articles_public_read" ON public.blog_articles FOR SELECT USING (true);
CREATE POLICY "blog_articles_service_write" ON public.blog_articles USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 6. INTERVIEWS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  subject           TEXT,
  excerpt           TEXT,
  format            TEXT DEFAULT 'audio',
  image_url         TEXT,
  duration_minutes  INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interviews_public_read" ON public.interviews FOR SELECT USING (true);
CREATE POLICY "interviews_service_write" ON public.interviews USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 7. MESSAGES (Signal Inbox)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_name   TEXT NOT NULL,
  from_role   TEXT DEFAULT 'member',
  to_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  body        TEXT,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_owner_read" ON public.messages FOR SELECT
  USING (auth.uid() = to_user_id);
CREATE POLICY "messages_owner_update" ON public.messages FOR UPDATE
  USING (auth.uid() = to_user_id);
CREATE POLICY "messages_service_write" ON public.messages USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 8. USER TICKETS (Ticket Vault)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id       UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ticket_number  TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  ticket_type    TEXT DEFAULT 'GA',
  status         TEXT DEFAULT 'valid',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_owner_read" ON public.user_tickets FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "tickets_service_write" ON public.user_tickets USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- SEED DATA — Artistas
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.artists (name, bio, type, genres, social_links, image_url) VALUES
  ('Nox Vega', 'DJ y productor de techno industrial con base en Berlín. Conocido por sus sets de 3 horas que atraviesan el espectro dark del electrónico.', 'DJ/Producer',
   '["Techno", "Industrial", "Dark Ambient"]', '{"instagram": "https://instagram.com", "website": "https://example.com"}',
   'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=400&auto=format&fit=crop'),
  ('AQUMA', 'Artista de música electrónica experimental procedente de Buenos Aires. Sus producciones mezclan ritmos latinoamericanos con síntesis modular.', 'Producer',
   '["Experimental", "Modular", "Latin Electronic"]', '{"instagram": "https://instagram.com", "twitter": "https://twitter.com"}',
   'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop'),
  ('Velvet Pulse', 'Dúo de DJs especializados en house melódico y deep techno. Residentes habituales en PolyFauna Radio los domingos.', 'Duo',
   '["Melodic House", "Deep Techno", "Afro House"]', '{"website": "https://example.com"}',
   'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=400&auto=format&fit=crop'),
  ('RDRG', 'Productor y live act de música concreta y electroacústica. Sus performances en vivo combinan field recordings con síntesis granular.', 'Live Act',
   '["Electroacoustic", "Concrete", "Granular"]', '{"instagram": "https://instagram.com"}',
   'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=400&auto=format&fit=crop'),
  ('Synthetic Bloom', 'Colectivo de producción electrónica enfocado en ambient y drone music. Han publicado más de 10 álbumes en sellos internacionales.', 'Collective',
   '["Ambient", "Drone", "Atmospheric"]', '{"instagram": "https://instagram.com", "twitter": "https://twitter.com", "website": "https://example.com"}',
   'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop'),
  ('KRÜ', 'DJ de drum & bass y jungle con raíces en la escena underground bogotana. Residente en PolyFauna desde la primera edición.', 'DJ',
   '["Drum & Bass", "Jungle", "Neurofunk"]', '{"instagram": "https://instagram.com"}',
   'https://images.unsplash.com/photo-1571266028243-d220c6a6f2e5?q=80&w=400&auto=format&fit=crop');

-- ─────────────────────────────────────────────────────────────
-- SEED DATA — Podcasts
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.podcasts (title, description, cover_url, duration, genre, artist_id)
SELECT
  'Underground Frequencies Vol. 1',
  'Primera sesión de la serie Underground Frequencies. Techno oscuro e industrial durante 90 minutos sin parar.',
  'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=400&auto=format&fit=crop',
  5400, 'Techno', id FROM public.artists WHERE name = 'Nox Vega' LIMIT 1;

INSERT INTO public.podcasts (title, description, cover_url, duration, genre, artist_id)
SELECT
  'Modular Dreams EP01',
  'Exploración de síntesis modular en vivo. Una hora de texturas orgánicas y ritmos africanos procesados electrónicamente.',
  'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=400&auto=format&fit=crop',
  3600, 'Experimental', id FROM public.artists WHERE name = 'AQUMA' LIMIT 1;

INSERT INTO public.podcasts (title, description, cover_url, duration, genre, artist_id)
SELECT
  'Sunday Deep Sessions',
  'House melódico y deep techno para las tardes del domingo. El sonido característico del dúo bogotano en su máxima expresión.',
  'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=400&auto=format&fit=crop',
  7200, 'Melodic House', id FROM public.artists WHERE name = 'Velvet Pulse' LIMIT 1;

INSERT INTO public.podcasts (title, description, cover_url, duration, genre, artist_id)
SELECT
  'Concrete Fields',
  'Una inmersión en música concreta usando field recordings de la ciudad. Cada sonido fue capturado en las calles durante 2024.',
  'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?q=80&w=400&auto=format&fit=crop',
  4800, 'Electroacoustic', id FROM public.artists WHERE name = 'RDRG' LIMIT 1;

INSERT INTO public.podcasts (title, description, cover_url, duration, genre, artist_id)
SELECT
  'Jungle Pressure',
  'Set completo de DnB y jungle del residente más veterano de PolyFauna. Clásicos y exclusivas del 2024.',
  'https://images.unsplash.com/photo-1534536281715-e28d76689b4d?q=80&w=400&auto=format&fit=crop',
  6000, 'Drum & Bass', id FROM public.artists WHERE name = 'KRÜ' LIMIT 1;

-- ─────────────────────────────────────────────────────────────
-- SEED DATA — Radio Shows
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.radio_shows (name, dj, schedule, genre) VALUES
  ('Underground Frequencies', 'Nox Vega', 'Lun 22:00', 'Techno'),
  ('Modular Nights', 'AQUMA', 'Mar 21:00', 'Experimental'),
  ('Sunday Deep', 'Velvet Pulse', 'Dom 18:00', 'Melodic House'),
  ('Concrete Fields Live', 'RDRG', 'Mié 23:00', 'Electroacoustic'),
  ('Jungle Pressure', 'KRÜ', 'Vie 20:00', 'Drum & Bass'),
  ('Ambient Drift', 'Synthetic Bloom', 'Sáb 15:00', 'Ambient'),
  ('Polyfauna Selector', 'Varios', 'Jue 22:00', 'Mixed'),
  ('Late Night Frequencies', 'Nox Vega', 'Vie 01:00', 'Dark Techno');

-- ─────────────────────────────────────────────────────────────
-- SEED DATA — Events
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.events (title, description, date, venue, city, price, lineup, image_url) VALUES
  ('PolyFauna: Opening Night',
   'La primera edición del año de PolyFauna. Tres rooms, seis artistas y más de 8 horas de música electrónica continua.',
   NOW() + INTERVAL '15 days',
   'Club Razzmatazz', 'Bogotá', 35000,
   '["Nox Vega", "AQUMA", "Velvet Pulse"]',
   'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=2070&auto=format&fit=crop'),
  ('Techno Cathedral',
   'Una noche dedicada al techno más oscuro e industrial. Nox Vega presenta su nuevo live set en exclusiva mundial.',
   NOW() + INTERVAL '22 days',
   'Bodega El Patio', 'Medellín', 45000,
   '["Nox Vega", "KRÜ"]',
   'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=2070&auto=format&fit=crop'),
  ('Modular Session Vol. 3',
   'AQUMA presenta la tercera edición de su serie de performances de síntesis modular en vivo. Aforo limitado.',
   NOW() + INTERVAL '30 days',
   'La Teatrería', 'Bogotá', 25000,
   '["AQUMA", "RDRG"]',
   'https://images.unsplash.com/photo-1598653222000-6b7b7a552625?q=80&w=2070&auto=format&fit=crop'),
  ('PolyFauna x Synthetic Bloom',
   'Colaboración especial entre PolyFauna Radio y el colectivo Synthetic Bloom. Una tarde de ambient y drone en un espacio industrial.',
   NOW() + INTERVAL '45 days',
   'Fábrica de Arte', 'Cali', 20000,
   '["Synthetic Bloom", "Velvet Pulse"]',
   'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=2070&auto=format&fit=crop');

-- ─────────────────────────────────────────────────────────────
-- SEED DATA — Blog Articles
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.blog_articles (title, content, category, author, featured_image_url) VALUES
  ('El techno industrial y su resurgimiento en Latinoamérica',
   'En los últimos años, la escena del techno industrial en Latinoamérica ha vivido un renacimiento inesperado. Ciudades como Bogotá, Buenos Aires y Ciudad de México están generando artistas que desafían las convenciones del género y llevan el sonido oscuro a nuevas audiencias. Nox Vega, uno de los exponentes más importantes de esta nueva ola, explica: "El techno siempre ha sido música de resistencia. En Latinoamérica, esa resistencia tiene un sabor diferente."',
   'Escena', 'PolyFauna Editorial',
   'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=600&auto=format&fit=crop'),
  ('Guía de síntesis modular para principiantes',
   'La síntesis modular puede parecer intimidante al principio: cables, módulos, voltajes de control. Pero una vez que entiendes los conceptos básicos, se convierte en uno de los instrumentos más expresivos de la música electrónica. En esta guía, AQUMA nos lleva de la mano a través de los fundamentos: osciladores, filtros, envelopes y VCAs.',
   'Tutorial', 'AQUMA',
   'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?q=80&w=600&auto=format&fit=crop'),
  ('Los mejores clubs de electrónica en Colombia en 2024',
   'Colombia tiene una escena electrónica vibrante y en constante crecimiento. Desde los clubes subterráneos de Bogotá hasta los eventos en espacios industriales de Medellín, hay opciones para todos los gustos. Aquí te presentamos nuestra selección de los mejores espacios para vivir la electrónica en vivo durante 2024.',
   'Guías', 'PolyFauna Editorial',
   'https://images.unsplash.com/photo-1571266028243-d220c6a6f2e5?q=80&w=600&auto=format&fit=crop'),
  ('Drum & Bass: un género que no muere',
   'Mientras otros géneros van y vienen, el drum & bass lleva más de 30 años evolucionando sin parar. De los rave warehouses de Londres a los clubs de Bogotá, el género ha encontrado nuevas audiencias en cada generación. KRÜ, residente de PolyFauna Radio, analiza por qué el DnB sigue siendo relevante y hacia dónde va.',
   'Análisis', 'KRÜ',
   'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop');

-- ─────────────────────────────────────────────────────────────
-- SEED DATA — Interviews
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.interviews (title, subject, excerpt, format, image_url, duration_minutes) VALUES
  ('Nox Vega: "El techno es terapia colectiva"',
   'Nox Vega', 'Hablamos con el DJ bogotano sobre su nuevo live set, su proceso creativo y por qué el techno sigue siendo el género más honesto de la música electrónica.',
   'video',
   'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop',
   45),
  ('AQUMA y la revolución modular en Buenos Aires',
   'AQUMA', 'La productora argentina nos abre las puertas de su estudio y nos enseña cómo construyó su sistema modular desde cero con un presupuesto limitado.',
   'audio',
   'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=600&auto=format&fit=crop',
   60),
  ('Velvet Pulse: construir un dúo en la era del DJ individual',
   'Velvet Pulse', 'En un mundo donde los DJs son figuras solitarias, Velvet Pulse decidió apostar por el trabajo en equipo. Esta es la historia de cómo dos amigos crearon uno de los proyectos más frescos de la escena colombiana.',
   'text',
   'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=600&auto=format&fit=crop',
   NULL),
  ('KRÜ: 15 años de drum & bass en Colombia',
   'KRÜ', 'El veterano residente de PolyFauna mira hacia atrás y hacia adelante. 15 años tocando drum & bass en Colombia, desde los primeros raves hasta los festivales internacionales.',
   'audio',
   'https://images.unsplash.com/photo-1534536281715-e28d76689b4d?q=80&w=600&auto=format&fit=crop',
   90);
