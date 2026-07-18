import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Disc3, Headphones, Mic } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { lineupIncludesArtist } from '@/lib/artistIdentity';
import { EmptyState, LoadingSkeleton } from '@/components/SectionStates';
import { getEventImage } from '@/lib/eventImages';
import { EDITORIAL_ACCENT, editorialAccent } from '@/lib/editorialTheme';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop';

const TAB_DEFS = [
  { key: 'events', label: 'Eventos', icon: Calendar, requiresArtist: false },
  { key: 'music', label: 'Música', icon: Disc3, requiresArtist: true },
  { key: 'podcast', label: 'Podcast', icon: Headphones, requiresArtist: true },
  { key: 'interviews', label: 'Entrevistas', icon: Mic, requiresArtist: true },
];

// Qué pestañas tiene sentido mostrar según el tipo de perfil — un sello no
// toca en vivo (sin Eventos), un promotor no sube contenido propio (sin
// Música ni Podcast), etc. Sin esto, cualquier organizador con fila espejo
// en `artists` mostraba las 4 pestañas sin importar su rol real.
const DEFAULT_ARTIST_CAPABILITIES = { events: true, music: true, podcast: true, interviews: true };
const ARTIST_TAB_CAPABILITIES = {
  label: { events: false, music: true, podcast: true, interviews: true },
};

const DEFAULT_ORGANIZER_CAPABILITIES = { events: true, music: false, podcast: true, interviews: true };
const ORGANIZER_TAB_CAPABILITIES = {
  club:       { events: true, music: false, podcast: true,  interviews: true },
  promoter:   { events: true, music: false, podcast: false, interviews: true },
  collective: { events: true, music: true,  podcast: true,  interviews: true },
  hybrid:     { events: true, music: false, podcast: true,  interviews: true },
};

function formatEventDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(minutes) {
  if (!minutes) return '';
  return `${minutes} min`;
}

function PreviewRow({ to, image, title, subtitle }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 rounded-xl transition-colors"
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
        <img src={image || FALLBACK_IMAGE} alt="" loading="lazy" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-white/35 truncate">{subtitle}</p>}
      </div>
    </Link>
  );
}

export default function ProfileContentTabs({ artistId, organizerId, artistType, organizerType }) {
  const capabilities = useMemo(() => {
    if (organizerId) return ORGANIZER_TAB_CAPABILITIES[organizerType] || DEFAULT_ORGANIZER_CAPABILITIES;
    if (artistId) return ARTIST_TAB_CAPABILITIES[artistType] || DEFAULT_ARTIST_CAPABILITIES;
    return { events: true, music: false, podcast: false, interviews: false };
  }, [organizerId, organizerType, artistId, artistType]);

  const tabs = useMemo(
    () => TAB_DEFS.filter((tab) => capabilities[tab.key] && (!tab.requiresArtist || Boolean(artistId))),
    [capabilities, artistId]
  );

  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'events');
  const [cache, setCache] = useState({});
  const [loadingTab, setLoadingTab] = useState(null);

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0]?.key || 'events');
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!activeTab || cache[activeTab] !== undefined) return;
    let cancelled = false;
    setLoadingTab(activeTab);

    async function load() {
      if (activeTab === 'events') {
        if (organizerId) {
          const { data } = await supabase
            .from('event_organizers')
            .select('events(id, title, date, venue, city, image_url, mobile_image_url, ticket_image_url, is_public, creator_is_public)')
            .eq('organizer_id', organizerId);
          const rows = (data || [])
            .map((row) => row.events)
            .filter((event) => event?.is_public !== false && event?.creator_is_public !== false)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          if (!cancelled) setCache((prev) => ({ ...prev, events: rows }));
          return;
        }
        if (artistId) {
          const { data } = await supabase
            .from('events')
            .select('id, title, date, venue, city, image_url, mobile_image_url, ticket_image_url, lineup')
            .eq('is_public', true)
            .eq('creator_is_public', true)
            .order('date', { ascending: false })
            .limit(60);
          const rows = (data || []).filter((event) => lineupIncludesArtist(event.lineup, { id: artistId }));
          if (!cancelled) setCache((prev) => ({ ...prev, events: rows }));
          return;
        }
        if (!cancelled) setCache((prev) => ({ ...prev, events: [] }));
        return;
      }

      if (activeTab === 'music') {
        const [primaryResult, creditsResult] = await Promise.all([
          supabase
            .from('albums')
            .select('id, title, cover_url, release_year')
            .eq('is_public', true)
            .eq('creator_is_public', true)
            .eq('artist_id', artistId)
            .order('release_year', { ascending: false }),
          supabase
            .from('album_artist_credits')
            .select('albums(id, title, cover_url, release_year, is_public, creator_is_public)')
            .eq('artist_id', artistId),
        ]);
        const credited = (creditsResult.data || []).map((row) => row.albums).filter((album) => album?.is_public !== false && album?.creator_is_public !== false);
        const rows = [...new Map([...(primaryResult.data || []), ...credited].map((album) => [album.id, album])).values()]
          .sort((a, b) => Number(b.release_year || 0) - Number(a.release_year || 0));
        if (!cancelled) setCache((prev) => ({ ...prev, music: rows }));
        return;
      }

      if (activeTab === 'podcast') {
        const [primaryResult, creditsResult] = await Promise.all([
          supabase
            .from('podcasts')
            .select('id, title, cover_url, duration, created_at')
            .eq('is_public', true)
            .eq('creator_is_public', true)
            .eq('artist_id', artistId)
            .order('created_at', { ascending: false }),
          supabase
            .from('podcast_artist_credits')
            .select('podcasts(id, title, cover_url, duration, created_at, is_public, creator_is_public)')
            .eq('artist_id', artistId),
        ]);
        const credited = (creditsResult.data || []).map((row) => row.podcasts).filter((podcast) => podcast?.is_public !== false && podcast?.creator_is_public !== false);
        const rows = [...new Map([...(primaryResult.data || []), ...credited].map((podcast) => [podcast.id, podcast])).values()]
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (!cancelled) setCache((prev) => ({ ...prev, podcast: rows }));
        return;
      }

      if (activeTab === 'interviews') {
        const { data } = await supabase
          .from('interviews')
          .select('id, title, image_url, duration_minutes, created_at')
          .eq('is_public', true)
          .eq('subject_artist_id', artistId)
          .order('created_at', { ascending: false });
        if (!cancelled) setCache((prev) => ({ ...prev, interviews: data || [] }));
      }
    }

    load().finally(() => {
      if (!cancelled) setLoadingTab(null);
    });

    return () => { cancelled = true; };
  }, [activeTab, artistId, organizerId, cache]);

  if (tabs.length <= 1 && !organizerId) return null;

  const items = cache[activeTab];
  const isLoading = loadingTab === activeTab && items === undefined;

  return (
    <div>
      <div
        className="flex gap-1 p-1 rounded-xl overflow-x-auto"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'none' }}
      >
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = key === activeTab;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0"
              style={{
                minWidth: 92,
                background: isActive ? editorialAccent(0.13) : 'transparent',
                color: isActive ? EDITORIAL_ACCENT : 'rgba(255,255,255,0.45)',
                boxShadow: isActive ? `inset 0 0 0 1px ${editorialAccent(0.20)}` : 'none',
              }}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {isLoading && <LoadingSkeleton rows={3} />}

            {!isLoading && activeTab === 'events' && (
              items && items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((event) => (
                    <PreviewRow
                      key={event.id}
                      to={`/e/${event.id}`}
                      image={getEventImage(event, 'compact')}
                      title={event.title}
                      subtitle={[event.venue || event.city, formatEventDate(event.date)].filter(Boolean).join(' · ')}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Calendar} label="Sin eventos por ahora" subtitle="Cuando haya eventos, aparecerán aquí." />
              )
            )}

            {!isLoading && activeTab === 'music' && (
              items && items.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((album) => (
                    <Link
                      key={album.id}
                      to={`/music/${album.id}`}
                      className="rounded-xl overflow-hidden"
                      style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="aspect-square overflow-hidden bg-white/5">
                        <img src={album.cover_url || FALLBACK_IMAGE} alt="" loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-bold text-white truncate">{album.title}</p>
                        {album.release_year && <p className="text-[10px] text-white/35">{album.release_year}</p>}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Disc3} label="Sin música publicada" subtitle="Los álbumes de este artista aparecerán aquí." />
              )
            )}

            {!isLoading && activeTab === 'podcast' && (
              items && items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((podcast) => (
                    <PreviewRow
                      key={podcast.id}
                      to={`/podcasts/${podcast.id}`}
                      image={podcast.cover_url}
                      title={podcast.title}
                      subtitle={formatDuration(podcast.duration)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Headphones} label="Sin episodios todavía" subtitle="Los podcasts de este artista aparecerán aquí." />
              )
            )}

            {!isLoading && activeTab === 'interviews' && (
              items && items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((interview) => (
                    <PreviewRow
                      key={interview.id}
                      to={`/entrevistas/${interview.id}`}
                      image={interview.image_url}
                      title={interview.title}
                      subtitle={formatDuration(interview.duration_minutes)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Mic} label="Sin entrevistas todavía" subtitle="Las entrevistas de este artista aparecerán aquí." />
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
