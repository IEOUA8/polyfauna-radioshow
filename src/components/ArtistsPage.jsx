import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Disc3, Globe, Heart, Instagram, Link2, Music, Twitter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
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
  { key: 'website',   icon: Globe,     label: 'Website',   color: '#C8C8C8', build: (h) => h.startsWith('http') ? h : `https://${h}` },
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
  const { toast } = useToast();
  const links = typeof artist.social_links === 'object' && artist.social_links ? artist.social_links : {};
  const genres = artist.genres
    ? (Array.isArray(artist.genres) ? artist.genres : String(artist.genres).split(','))
    : [];
  const favoured = isFav('artist', artist.id);
  const img = artist.image_url || FALLBACK;

  const handleShare = async () => {
    const url = window.location.href;
    const text = `${artist.name} en POLYFAUNA`;
    if (navigator.share) {
      await navigator.share({ title: text, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Enlace copiado', description: text });
    }
  };

  return (
    <motion.div
      key="artist-detail"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-0"
    >
      {/* Back */}
      <div className="px-5 pt-5 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-white/45 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Artists & Labels
        </button>
      </div>

      {/* Cover banner — outer wrapper sin overflow:hidden para no clipear el row */}
      <div className="relative" style={{ height: 170 }}>
        {/* Inner clip: solo contiene la imagen blureada */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={img}
            alt=""
            aria-hidden
            className="w-full h-full object-cover scale-110"
            style={{ filter: 'blur(6px) brightness(0.38) saturate(0.7)' }}
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(5,9,10,0.08) 0%, rgba(5,9,10,0.50) 65%, #05090A 100%)',
          }} />
        </div>
        {/* Action buttons: share + favorite */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button
            type="button"
            onClick={handleShare}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(0,0,0,0.50)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <Link2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.65)' }} />
          </button>
          <button
            type="button"
            onClick={() => toggleFav('artist', artist.id)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(0,0,0,0.50)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
          >
            <Heart
              className="w-4 h-4 transition-colors"
              style={{ fill: favoured ? '#F87171' : 'none', color: favoured ? '#F87171' : 'rgba(255,255,255,0.65)' }}
            />
          </button>
        </div>
      </div>

      {/* Avatar (left) + Info (right) — items-end: ambos alineados abajo */}
      <div className="px-5 flex items-end gap-4 relative" style={{ marginTop: -64, zIndex: 2 }}>
        {/* Avatar circle grande */}
        <div
          className="rounded-full overflow-hidden shrink-0"
          style={{
            width: 120,
            height: 120,
            border: '3px solid #05090A',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.13), 0 10px 32px rgba(0,0,0,0.75)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <img src={img} alt={artist.name} className="w-full h-full object-cover" />
        </div>

        {/* Info column */}
        <div className="flex-1 min-w-0 pb-1">
          {artist.type && (
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              {artist.type}
            </span>
          )}
          <h1 className="text-xl font-black text-white leading-tight">{artist.name}</h1>
          {artist.city && (
            <p className="text-xs text-white/40 mt-0.5">{artist.city}</p>
          )}
          {/* Social icons inline */}
          {SOCIAL_DETAIL.some(({ key }) => links[key]) && (
            <div className="flex gap-1.5 mt-2.5 flex-wrap">
              {SOCIAL_DETAIL.map(({ key, icon, label, color, build }) =>
                links[key] ? (
                  <SocialButton
                    key={key}
                    href={build(links[key])}
                    icon={icon}
                    label={label}
                    color={color}
                  />
                ) : null
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bio + Genres */}
      <div className="px-5 pt-5 pb-6 space-y-4">
        {artist.bio && (
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">Biografía</h2>
            <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{artist.bio}</p>
          </div>
        )}
        {genres.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">Géneros</h2>
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <span
                  key={g}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  {g.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
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
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
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
            style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}
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
          <SocialButton href={links.website} icon={Globe} label="Website" color="#C8C8C8" />
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
