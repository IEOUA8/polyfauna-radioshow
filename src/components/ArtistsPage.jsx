import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Disc3, ExternalLink, Globe, Heart, Instagram, Music, Twitter } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop';

const SOCIAL_DETAIL = [
  { key: 'instagram', icon: Instagram, label: 'Instagram', color: '#E1306C', build: (h) => `https://instagram.com/${h}` },
  { key: 'twitter',   icon: Twitter,   label: 'Twitter / X', color: '#94A3B8', build: (h) => `https://x.com/${h}` },
  { key: 'bandcamp',  icon: Music,     label: 'Bandcamp',  color: '#1DA0C3', build: (h) => h.includes('.') ? `https://${h}` : `https://${h}.bandcamp.com` },
  { key: 'soundcloud',icon: Music,     label: 'SoundCloud',color: '#FF5500', build: (h) => `https://soundcloud.com/${h}` },
  { key: 'website',   icon: Globe,     label: 'Website',   color: 'rgba(255,255,255,0.9)', build: (h) => h.startsWith('http') ? h : `https://${h}` },
];

function SocialButton({ href, icon: Icon, label, color }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}30`; e.currentTarget.style.transform = 'scale(1.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <Icon className="w-3.5 h-3.5" />
    </a>
  );
}

function ArtistDetail({ artist, onBack, isFav, toggleFav }) {
  const links = typeof artist.social_links === 'object' && artist.social_links ? artist.social_links : {};
  const genres = artist.genres
    ? (Array.isArray(artist.genres) ? artist.genres : String(artist.genres).split(','))
    : [];
  const favoured = isFav('artist', artist.id);

  return (
    <motion.div
      key="artist-detail"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="p-5 space-y-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Artists & Labels
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 300 }}>
        <img
          src={artist.image_url || FALLBACK}
          alt={artist.name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.75)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

        {/* Favorite */}
        <button
          type="button"
          onClick={() => toggleFav('artist', artist.id)}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Heart
            className="w-4 h-4"
            style={{ fill: favoured ? '#F87171' : 'none', color: favoured ? '#F87171' : 'rgba(255,255,255,0.7)' }}
          />
        </button>

        <div className="relative z-10 p-6 flex flex-col justify-end" style={{ minHeight: 300 }}>
          {artist.type && (
            <span className="inline-flex text-[10px] font-bold uppercase tracking-widest mb-2 px-2.5 py-0.5 rounded-full w-fit" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(32,199,232,0.25)' }}>
              {artist.type}
            </span>
          )}
          <h1 className="text-3xl font-black text-white leading-tight">{artist.name}</h1>
          {artist.city && (
            <p className="text-sm text-white/50 mt-1">{artist.city}</p>
          )}
        </div>
      </div>

      {/* Social links */}
      {SOCIAL_DETAIL.some(({ key }) => links[key]) && (
        <div className="flex flex-wrap gap-2">
          {SOCIAL_DETAIL.map(({ key, icon, label, color, build }) =>
            links[key] ? (
              <a
                key={key}
                href={build(links[key])}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${color}22`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = `${color}12`)}
              >
                {React.createElement(icon, { className: 'w-3.5 h-3.5' })}
                {label}
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            ) : null
          )}
        </div>
      )}

      {/* Bio */}
      {artist.bio && (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Biografía</h2>
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{artist.bio}</p>
        </div>
      )}

      {/* Genres */}
      {genres.length > 0 && (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">Géneros</h2>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <span
                key={g}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(124,92,255,0.1)', color: '#7C5CFF', border: '1px solid rgba(124,92,255,0.2)' }}
              >
                {g.trim()}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ArtistCard({ artist, index, isFav, toggleFav, onClick }) {
  const links = typeof artist.social_links === 'object' ? artist.social_links : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl overflow-hidden flex flex-col group cursor-pointer"
      style={{ background: 'rgba(11, 16, 15, 0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(124,92,255,0.25)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
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
            style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(32,199,232,0.25)' }}
          >
            {artist.type}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFav('artist', artist.id); }}
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
          <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">{artist.bio}</p>
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
          <SocialButton href={links.instagram} icon={Instagram} label="Instagram" color="#E1306C" />
          <SocialButton href={links.twitter} icon={Twitter} label="Twitter" color="#94A3B8" />
          <SocialButton href={links.website} icon={Globe} label="Website" color="rgba(255,255,255,0.9)" />
          {(!links.instagram && !links.twitter && !links.website) && (
            <span className="text-[10px] text-white/20">Sin redes</span>
          )}
          <span className="ml-auto text-[10px] text-white/20 group-hover:text-white/40 transition-colors">Ver más →</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function ArtistsPage() {
  const [search, setSearch] = useState('');
  const [selectedArtist, setSelectedArtist] = useState(null);
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
    <AnimatePresence mode="wait">
      {selectedArtist ? (
        <ArtistDetail
          key="detail"
          artist={selectedArtist}
          onBack={() => setSelectedArtist(null)}
          isFav={isFav}
          toggleFav={toggleFav}
        />
      ) : (
        <motion.div
          key="grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="p-5 space-y-5"
        >
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
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  index={i}
                  isFav={isFav}
                  toggleFav={toggleFav}
                  onClick={() => setSelectedArtist(artist)}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
