import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Disc3, Heart, Instagram, Globe, Twitter } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop';

function SocialButton({ href, icon: Icon, label }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,207,255,0.12)'; e.currentTarget.style.color = '#00CFFF'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
    >
      <Icon className="w-3.5 h-3.5" />
    </a>
  );
}

function ArtistCard({ artist, index, isFav, toggleFav }) {
  const links = typeof artist.social_links === 'object' ? artist.social_links : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl overflow-hidden flex flex-col group"
      style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={artist.image_url || FALLBACK}
          alt={artist.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {artist.type && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#00CFFF', border: '1px solid rgba(0,207,255,0.25)' }}
          >
            {artist.type}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleFav('artist', artist.id)}
          className="absolute top-2 right-2 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          title={isFav('artist', artist.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        >
          <Heart
            className="w-3.5 h-3.5 transition-colors"
            style={{
              fill: isFav('artist', artist.id) ? '#F87171' : 'none',
              color: isFav('artist', artist.id) ? '#F87171' : 'rgba(255,255,255,0.7)',
            }}
          />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-sm font-black text-white">{artist.name}</p>
        {artist.bio && (
          <p className="text-xs text-white/40 line-clamp-3 leading-relaxed">{artist.bio}</p>
        )}
        {artist.genres && (
          <div className="flex flex-wrap gap-1 mt-1">
            {(Array.isArray(artist.genres) ? artist.genres : String(artist.genres).split(','))
              .slice(0, 3)
              .map((g) => (
                <span
                  key={g}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}
                >
                  {g.trim()}
                </span>
              ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-auto pt-2">
          <SocialButton href={links.instagram} icon={Instagram} label="Instagram" />
          <SocialButton href={links.twitter} icon={Twitter} label="Twitter" />
          <SocialButton href={links.website} icon={Globe} label="Website" />
          {(links.instagram || links.twitter || links.website) ? null : (
            <span className="text-[10px] text-white/20">Sin redes sociales</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ArtistsPage() {
  const [search, setSearch] = useState('');
  const { isFav, toggle: toggleFav } = useFavorites();

  const { data: artists, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('artists').select('*').order('name'),
    []
  );

  const filtered = useMemo(() => {
    if (!artists) return [];
    const q = search.toLowerCase();
    return q ? artists.filter((a) => a.name?.toLowerCase().includes(q) || a.bio?.toLowerCase().includes(q)) : artists;
  }, [artists, search]);

  return (
    <div className="p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Artists & Labels</h1>
          <p className="text-sm text-white/40 mt-1">Los artistas y sellos que dan vida a PolyFauna.</p>
        </div>
        <input
          type="text"
          placeholder="Buscar artista…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg outline-none w-full sm:w-64"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
        />
      </div>

      {loading && <CardSkeleton count={6} />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState label={search ? 'Sin resultados para tu búsqueda' : 'No hay artistas aún'} icon={Disc3} />
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((artist, i) => (
            <ArtistCard key={artist.id} artist={artist} index={i} isFav={isFav} toggleFav={toggleFav} />
          ))}
        </div>
      )}
    </div>
  );
}
