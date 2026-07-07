-- Capa pública/curatorial de organizadores (clubes, promotores, colectivos)
-- y su relación many-to-many con eventos. Ver POLYFAUNA_EVENTOS_ORGANIZADORES_MASTER.md, sección 3.1.

CREATE TABLE IF NOT EXISTS public.organizers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'promoter'
                CHECK (type IN ('club', 'promoter', 'collective', 'hybrid')),
  bio           TEXT,
  image_url     TEXT,
  cover_url     TEXT,
  city          TEXT,
  address       TEXT,
  lat           NUMERIC(9,6),
  lng           NUMERIC(9,6),
  capacity      INTEGER,
  social_links  JSONB DEFAULT '{}',
  owner_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_verified   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizers_owner_id ON public.organizers(owner_id);

ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizers_public_read" ON public.organizers;
CREATE POLICY "organizers_public_read" ON public.organizers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "organizers_owner_update" ON public.organizers;
CREATE POLICY "organizers_owner_update" ON public.organizers
  FOR UPDATE USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "organizers_admin_insert" ON public.organizers;
CREATE POLICY "organizers_admin_insert" ON public.organizers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'promoter', 'club', 'collective')
    )
  );

-- ─── Relación evento ↔ organizador (many-to-many, capa curatorial) ───
CREATE TABLE IF NOT EXISTS public.event_organizers (
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id  UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  role_in_event TEXT NOT NULL DEFAULT 'organizer'
                CHECK (role_in_event IN ('owner', 'venue', 'co-organizer', 'curator')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, organizer_id)
);

ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_organizers_public_read" ON public.event_organizers;
CREATE POLICY "event_organizers_public_read" ON public.event_organizers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "event_organizers_owner_write" ON public.event_organizers;
CREATE POLICY "event_organizers_owner_write" ON public.event_organizers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organizers o
      WHERE o.id = organizer_id
        AND (o.owner_id = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
    )
  );

-- ─── events: relación real a venue, conservando el texto legacy ───
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_organizer_id UUID REFERENCES public.organizers(id);
-- events.venue (TEXT) se conserva como fallback hasta que la Fase 9
-- (migración de datos) pueble venue_organizer_id en todos los eventos
-- existentes. No se elimina en esta fase para no romper EventTerminal.jsx
-- ni EventPublicPage.jsx, que hoy leen event.venue directamente.

NOTIFY pgrst, 'reload schema';
