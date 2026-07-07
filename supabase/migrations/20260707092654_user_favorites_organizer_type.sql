-- Permite favoritear organizadores (botón "Seguir" en OrganizersPage.jsx /
-- OrganizerPublicPage.jsx), igual que ya ocurre con 'artist'.

ALTER TABLE public.user_favorites
  DROP CONSTRAINT IF EXISTS user_favorites_item_type_check;

ALTER TABLE public.user_favorites
  ADD CONSTRAINT user_favorites_item_type_check
  CHECK (item_type IN ('event', 'podcast', 'artist', 'album', 'track', 'session', 'song', 'organizer'));
