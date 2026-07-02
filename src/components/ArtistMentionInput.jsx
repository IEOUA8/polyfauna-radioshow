import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, Plus, X } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { normalizeArtistKey, parseLineup } from '@/lib/artistIdentity';

export default function ArtistMentionInput({ value, onChange }) {
  const [artists, setArtists] = useState([]);
  const [query, setQuery] = useState('');
  const lineup = useMemo(() => parseLineup(value), [value]);

  useEffect(() => {
    supabase
      .from('artists')
      .select('id, name, slug')
      .order('name')
      .limit(250)
      .then(({ data }) => setArtists(data || []));
  }, []);

  const search = query.replace(/^@/, '').trim();
  const suggestions = search
    ? artists
      .filter(artist =>
        normalizeArtistKey(artist.name).includes(normalizeArtistKey(search))
        && !lineup.some(item => item.artistId === artist.id)
      )
      .slice(0, 6)
    : [];

  const addArtist = (artist) => {
    onChange([...lineup, { name: artist.name, artist_id: artist.id }]);
    setQuery('');
  };

  const addManual = () => {
    const name = query.replace(/^@/, '').trim();
    if (!name || lineup.some(item => normalizeArtistKey(item.name) === normalizeArtistKey(name))) return;
    onChange([...lineup, { name, artist_id: null }]);
    setQuery('');
  };

  const remove = (index) => onChange(lineup.filter((_, itemIndex) => itemIndex !== index).map(item => ({
    name: item.name,
    artist_id: item.artistId,
  })));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {lineup.map((item, index) => (
          <span key={`${item.artistId || item.name}-${index}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
            style={{
              background: item.artistId ? 'rgba(32,199,232,0.12)' : 'rgba(255,255,255,0.06)',
              color: item.artistId ? '#8BEAFF' : 'rgba(255,255,255,0.72)',
              border: item.artistId ? '1px solid rgba(32,199,232,0.28)' : '1px solid rgba(255,255,255,0.1)',
            }}>
            {item.artistId && <AtSign className="w-3 h-3" />}
            {item.name}
            <button type="button" onClick={() => remove(index)} aria-label={`Quitar ${item.name}`}>
              <X className="w-3 h-3 opacity-60" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  if (suggestions[0]) addArtist(suggestions[0]);
                  else addManual();
                }
              }}
              placeholder="@busca un DJ o escribe un nombre"
              className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <button type="button" onClick={addManual} disabled={!search}
            className="w-10 rounded-xl flex items-center justify-center disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="absolute z-30 top-full left-0 right-12 mt-1 rounded-xl overflow-hidden shadow-2xl"
            style={{ background: '#101716', border: '1px solid rgba(255,255,255,0.12)' }}>
            {suggestions.map(artist => (
              <button key={artist.id} type="button" onClick={() => addArtist(artist)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5">
                <AtSign className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-xs font-bold text-white">{artist.name}</span>
                {artist.slug && <span className="text-[10px] text-white/25 ml-auto">@{artist.slug}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-[10px] text-white/30">Las menciones con @ enlazan el perfil del artista dentro de PolyFauna.</p>
    </div>
  );
}
