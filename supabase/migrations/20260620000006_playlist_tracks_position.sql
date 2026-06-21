-- ─────────────────────────────────────────────────────────────────────────────
-- Playlist tracks: add position column for user-defined ordering
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.playlist_tracks
  ADD COLUMN IF NOT EXISTS position INTEGER;

-- Initialize positions based on insertion order
WITH numbered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY playlist_id ORDER BY id) - 1 AS pos
  FROM public.playlist_tracks
)
UPDATE public.playlist_tracks pt
SET    position = n.pos
FROM   numbered n
WHERE  pt.id = n.id AND pt.position IS NULL;

-- Index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order
  ON public.playlist_tracks(playlist_id, position);
