export function normalizeArtistKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugifyArtist(value) {
  return normalizeArtistKey(value) || 'artista';
}

export function parseLineup(lineup) {
  if (!lineup) return [];
  const entries = Array.isArray(lineup)
    ? lineup
    : String(lineup).split(',');

  return entries
    .map((entry) => {
      if (entry && typeof entry === 'object') {
        const name = entry.name || entry.label || entry.artist || '';
        return {
          name: String(name).trim(),
          artistId: entry.artist_id || entry.artistId || entry.id || null,
        };
      }
      return { name: String(entry || '').trim(), artistId: null };
    })
    .filter(item => item.name);
}

export function resolveLineupArtists(lineup, artists = []) {
  const byId = new Map();
  const byKey = new Map();

  artists.forEach((artist) => {
    if (!artist?.id) return;
    byId.set(artist.id, artist);
    byKey.set(normalizeArtistKey(artist.name), artist);
    if (artist.slug) byKey.set(normalizeArtistKey(artist.slug), artist);
  });

  return parseLineup(lineup).map((item) => {
    const artist = item.artistId
      ? byId.get(item.artistId)
      : byKey.get(normalizeArtistKey(item.name));

    return { ...item, artist: artist || null };
  });
}

export function lineupIncludesArtist(lineup, artist) {
  if (!artist) return false;
  const artistKeys = new Set([
    normalizeArtistKey(artist.id),
    normalizeArtistKey(artist.name),
    normalizeArtistKey(artist.slug),
  ].filter(Boolean));

  return parseLineup(lineup).some((item) => (
    artistKeys.has(normalizeArtistKey(item.artistId)) ||
    artistKeys.has(normalizeArtistKey(item.name))
  ));
}
