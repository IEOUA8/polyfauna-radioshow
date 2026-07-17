import React, { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ArtistCreditSelector({ artists, selectedIds, primaryArtistId, onChange }) {
  const [search, setSearch] = useState('');
  const candidates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return artists
      .filter((artist) => artist.id !== primaryArtistId)
      .filter((artist) => !query || artist.name?.toLocaleLowerCase('es').includes(query));
  }, [artists, primaryArtistId, search]);

  const toggle = (artistId) => {
    onChange(selectedIds.includes(artistId)
      ? selectedIds.filter((id) => id !== artistId)
      : [...selectedIds, artistId]);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div>
        <Label>Artistas etiquetados</Label>
        <p className="text-xs text-muted-foreground mt-1">
          El contenido aparecerá en el perfil del colectivo y en cada artista seleccionado.
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar artista…"
          className="pl-9 bg-background border-border text-foreground"
        />
      </div>
      <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            {search.trim() ? 'No hay coincidencias para esta búsqueda.' : 'No hay otros artistas disponibles.'}
          </p>
        ) : candidates.map((artist) => {
          const checked = selectedIds.includes(artist.id);
          return (
            <button
              key={artist.id}
              type="button"
              onClick={() => toggle(artist.id)}
              className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-white/5 transition-colors"
              aria-pressed={checked}
            >
              <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                {checked && <Check className="w-3.5 h-3.5" />}
              </span>
              <span className="text-sm text-foreground truncate">{artist.name}</span>
            </button>
          );
        })}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-primary">{selectedIds.length} artista{selectedIds.length === 1 ? '' : 's'} etiquetado{selectedIds.length === 1 ? '' : 's'}</p>
      )}
    </div>
  );
}
