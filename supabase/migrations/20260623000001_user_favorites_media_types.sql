-- POLYFAUNA — Allow music objects inside the user's organism/favorites.

ALTER TABLE public.user_favorites
  DROP CONSTRAINT IF EXISTS user_favorites_item_type_check;

ALTER TABLE public.user_favorites
  ADD CONSTRAINT user_favorites_item_type_check
  CHECK (item_type IN ('event', 'podcast', 'artist', 'album', 'track'));
