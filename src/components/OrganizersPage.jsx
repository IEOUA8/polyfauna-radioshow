import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Globe, Heart, Instagram, Link2, MapPin, Twitter, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import supabase from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';
import { normalizeArtistKey } from '@/lib/artistIdentity';
import ProfileContentTabs from '@/components/ProfileContentTabs';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop';

const SOCIAL_DETAIL = [
  { key: 'instagram', icon: Instagram, label: 'Instagram', color: '#E1306C', build: (h) => `https://instagram.com/${h}` },
  { key: 'twitter',   icon: Twitter,   label: 'Twitter / X', color: '#94A3B8', build: (h) => `https://x.com/${h}` },
  { key: 'website',   icon: Globe,     label: 'Website',   color: '#C8C8C8', build: (h) => h.startsWith('http') ? h : `https://${h}` },
];

const TYPE_LABEL = { club: 'Club', promoter: 'Promotor', collective: 'Colectivo', hybrid: 'Híbrido' };

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

function OrganizerDetail({ organizer, onBack, isFav, toggleFav, setCurrentSection }) {
  const { toast } = useToast();
  const links = typeof organizer.social_links === 'object' && organizer.social_links ? organizer.social_links : {};
  const favoured = isFav('organizer', organizer.id);
  const img = organizer.image_url || FALLBACK;

  const profileUrl = organizer.slug
    ? `${window.location.origin}/organizadores/${organizer.slug}`
    : `${window.location.origin}/?section=organizadores`;

  // Un organizador puede tener una fila espejo en `artists` si además sube
  // contenido propio (música/podcast/entrevistas) — se resuelve por slug,
  // igual que en la antigua OrganizerPublicPage.jsx.
  const [mirrorArtistId, setMirrorArtistId] = useState(null);
  useEffect(() => {
    if (!organizer?.slug) return;
    supabase
      .from('artists')
      .select('id, slug')
      .then(({ data }) => {
        const match = (data || []).find(
          (artist) => normalizeArtistKey(artist.slug) === normalizeArtistKey(organizer.slug)
        );
        setMirrorArtistId(match?.id || null);
      });
  }, [organizer?.slug]);

  const handleShare = async () => {
    const text = `${organizer.name} en POLYFAUNA`;
    if (navigator.share) {
      await navigator.share({ title: text, url: profileUrl });
    } else {
      await navigator.clipboard.writeText(profileUrl);
      toast({ title: 'Enlace copiado', description: text });
    }
  };

  return (
    <motion.div
      key="organizer-detail"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-0"
    >
      <div className="px-5 pt-5 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-white/45 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Organizadores
        </button>
      </div>

      <div className="relative px-5 pt-4 pb-6 overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <img
            src={organizer.cover_url || img}
            alt=""
            className="w-full h-full object-cover scale-110"
            style={{ filter: 'blur(18px) brightness(0.42) saturate(0.85)' }}
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(5,9,10,0.20) 0%, rgba(5,9,10,0.72) 65%, #05090A 100%)',
          }} />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="flex flex-row items-start gap-4 sm:gap-5 flex-1 min-w-0 text-left">
            {/* Avatar — compacto en mobile para no empujar bio/pestañas fuera
                de pantalla; mismo tamaño de siempre a partir de sm:. */}
            <div
              className="rounded-full overflow-hidden shrink-0 w-20 h-20 sm:w-[140px] sm:h-[140px]"
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 12px 34px rgba(0,0,0,0.55)',
              }}
            >
              <img src={img} alt={organizer.name} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 min-w-0 flex flex-col items-start">
              {organizer.type && (
                <span
                  className="pf-chip mb-2"
                >
                  {TYPE_LABEL[organizer.type] || organizer.type}
                </span>
              )}
              <h1 className="pf-detail-title">{organizer.name}</h1>
              {organizer.city && (
                <span className="text-sm font-medium text-white/50 flex items-center gap-1.5 mt-2">
                  <MapPin className="w-3.5 h-3.5" /> {organizer.city}
                </span>
              )}
              {organizer.capacity && (
                <span className="text-sm font-medium text-white/50 flex items-center gap-1.5 mt-1.5">
                  <Users className="w-3.5 h-3.5" /> Capacidad para {organizer.capacity}
                </span>
              )}
              {SOCIAL_DETAIL.some(({ key }) => links[key]) && (
                <div className="flex gap-1.5 mt-3.5 flex-wrap justify-start">
                  {SOCIAL_DETAIL.map(({ key, icon, label, color, build }) =>
                    links[key] ? (
                      <SocialButton key={key} href={build(links[key])} icon={icon} label={label} color={color} />
                    ) : null
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-start sm:justify-end gap-2 sm:shrink-0 sm:pt-1">
            <button
              type="button"
              onClick={handleShare}
              title="Compartir"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <Link2 className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.65)' }} />
            </button>
            <button
              type="button"
              onClick={() => toggleFav('organizer', organizer.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all shrink-0"
              style={{
                background: favoured ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${favoured ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.10)'}`,
                color: favoured ? '#F87171' : 'rgba(255,255,255,0.85)',
              }}
            >
              <Heart className="w-4 h-4" style={{ fill: favoured ? '#F87171' : 'none' }} />
              {favoured ? 'Siguiendo' : 'Seguir'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 pb-6 space-y-4">
        {organizer.bio && (
          <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="pf-section-label mb-3">Sobre {organizer.name}</h2>
            <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{organizer.bio}</p>
          </div>
        )}

        <ProfileContentTabs organizerId={organizer.id} organizerType={organizer.type} artistId={mirrorArtistId || undefined} />
      </div>
    </motion.div>
  );
}

function OrganizerCard({ organizer, index, isFav, toggleFav, onClick }) {
  const links = typeof organizer.social_links === 'object' ? organizer.social_links : {};

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
          src={organizer.image_url || FALLBACK}
          alt={organizer.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {organizer.type && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {TYPE_LABEL[organizer.type] || organizer.type}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFav('organizer', organizer.id); }}
          className="absolute top-2 right-2 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          title={isFav('organizer', organizer.id) ? 'Quitar del Organismo' : 'Agregar al Organismo'}
        >
          <Heart
            className="w-3.5 h-3.5 transition-colors"
            style={{
              fill: isFav('organizer', organizer.id) ? '#F87171' : 'none',
              color: isFav('organizer', organizer.id) ? '#F87171' : 'rgba(255,255,255,0.7)',
            }}
          />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-sm font-black text-white">{organizer.name}</p>
        {organizer.city && (
          <p className="text-xs text-white/40 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {organizer.city}
          </p>
        )}
        {organizer.bio && (
          <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">{organizer.bio}</p>
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

export default function OrganizersPage({ setCurrentSection }) {
  const [search, setSearch] = useState('');
  const [selectedOrganizer, setSelectedOrganizer] = useState(null);
  const { isFav, toggle: toggleFav } = useFavorites();

  const { data: organizers, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('organizers').select('*').order('name'),
    []
  );

  // Deep-link desde búsqueda global
  useEffect(() => {
    const handler = async (e) => {
      const { type, id } = e.detail || {};
      if (type !== 'organizers') return;
      const inList = (organizers || []).find(o => o.id === id);
      if (inList) { setSelectedOrganizer(inList); return; }
      const { data } = await supabase.from('organizers').select('*').eq('id', id).single();
      if (data) setSelectedOrganizer(data);
    };
    window.addEventListener('pf:open-item', handler);
    return () => window.removeEventListener('pf:open-item', handler);
  }, [organizers]);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('organizer');
    if (!slug || !organizers?.length) return;
    const inList = organizers.find(o => o.slug === slug);
    if (inList) setSelectedOrganizer(inList);
  }, [organizers]);

  const filtered = useMemo(() => {
    if (!organizers) return [];
    const q = search.toLowerCase();
    return q ? organizers.filter((o) => o.name?.toLowerCase().includes(q) || o.city?.toLowerCase().includes(q)) : organizers;
  }, [organizers, search]);

  return (
    <AnimatePresence mode="wait">
      {selectedOrganizer ? (
        <OrganizerDetail
          key="detail"
          organizer={selectedOrganizer}
          onBack={() => setSelectedOrganizer(null)}
          isFav={isFav}
          toggleFav={toggleFav}
          setCurrentSection={setCurrentSection}
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
              <h1 className="pf-page-title">Organizadores</h1>
              <p className="pf-page-subtitle">Clubes, promotores y colectivos detrás de los eventos.</p>
            </div>
            <input
              type="text"
              placeholder="Buscar organizador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg outline-none w-full sm:w-64"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
            />
          </div>

          {loading && <CardSkeleton count={6} />}
          {error && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState label={search ? 'Sin resultados para tu búsqueda' : 'No hay organizadores aún'} icon={Users} />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((organizer, i) => (
                <OrganizerCard
                  key={organizer.id}
                  organizer={organizer}
                  index={i}
                  isFav={isFav}
                  toggleFav={toggleFav}
                  onClick={() => setSelectedOrganizer(organizer)}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
