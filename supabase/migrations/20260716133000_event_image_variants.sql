-- Optional event artwork variants. image_url remains the canonical 16:9 banner
-- so existing clients keep working; the other fields override mobile and ticket
-- crops only when an organizer supplies them.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS mobile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS ticket_image_url TEXT;

COMMENT ON COLUMN public.events.image_url IS
  'Primary event artwork, optimized for landscape banners and cards (recommended 1600x900).';
COMMENT ON COLUMN public.events.mobile_image_url IS
  'Optional portrait/mobile crop (recommended 1200x1500). Falls back to image_url.';
COMMENT ON COLUMN public.events.ticket_image_url IS
  'Optional wide ticket/QR header crop (recommended 1600x800). Falls back to image_url.';
