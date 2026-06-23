import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Disc3, ExternalLink, Globe, Headphones, Instagram, Music, Play, Share2, Twitter } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { lineupIncludesArtist } from '@/lib/artistIdentity';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop';

const SOCIAL_LINKS = [
  { key: 'instagram',  icon: Instagram, label: 'Instagram',  color: '#E1306C', build: h => `https://instagram.com/${h}` },
  { key: 'twitter',    icon: Twitter,   label: 'Twitter/X',  color: '#94A3B8', build: h => `https://x.com/${h}` },
  { key: 'soundcloud', icon: Music,     label: 'SoundCloud', color: '#FF5500', build: h => `https://soundcloud.com/${h}` },
  { key: 'bandcamp',   icon: Music,     label: 'Bandcamp',   color: '#1DA0C3', build: h => h.includes('.') ? `https://${h}` : `https://${h}.bandcamp.com` },
  { key: 'website',    icon: Globe,     label: 'Web',        color: '#C8C8C8', build: h => h.startsWith('http') ? h : `https://${h}` },
];

function SocialBtn({ href, icon: Icon, label, color }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      title={label}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}18`; }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </a>
  );
}

export default function ArtistPublicPage() {
  const { slug } = useParams();
  const [artist,  setArtist]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [content, setContent] = useState({ albums: [], tracks: [], podcasts: [], events: [] });

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('artists')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setArtist(data);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!artist?.id) return;

    const loadArtistContent = async () => {
      const [albumsRes, tracksRes, podcastsRes, eventsRes] = await Promise.all([
        supabase
          .from('albums')
          .select('id, title, cover_url, genre, release_year')
          .eq('artist_id', artist.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('tracks')
          .select('id, title, duration, genre, audio_url, albums(title, cover_url)')
          .eq('artist_id', artist.id)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('podcasts')
          .select('id, title, cover_url, duration, genre, created_at')
          .eq('artist_id', artist.id)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('events')
          .select('id, title, date, venue, city, image_url, lineup')
          .gte('date', new Date().toISOString())
          .order('date', { ascending: true })
          .limit(40),
      ]);

      setContent({
        albums: albumsRes.data || [],
        tracks: tracksRes.data || [],
        podcasts: podcastsRes.data || [],
        events: (eventsRes.data || []).filter(event => lineupIncludesArtist(event.lineup, artist)).slice(0, 4),
      });
    };

    loadArtistContent();
  }, [artist]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: artist?.name, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen poly-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
      </div>
    );
  }

  if (notFound || !artist) {
    return (
      <div className="min-h-screen poly-bg flex flex-col items-center justify-center p-8 text-center">
        <Disc3 className="w-12 h-12 text-white/15 mb-4" />
        <h1 className="text-xl font-black text-white mb-2">Artista no encontrado</h1>
        <p className="text-sm text-white/40 mb-6">Este perfil no existe o fue removido.</p>
        <Link to="/" className="px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}>
          Ir a POLYFAUNA
        </Link>
      </div>
    );
  }

  const img    = artist.image_url || FALLBACK;
  const links  = typeof artist.social_links === 'object' && artist.social_links ? artist.social_links : {};
  const genres = artist.genres
    ? (Array.isArray(artist.genres) ? artist.genres : String(artist.genres).split(',').map(g => g.trim()))
    : [];
  const canonicalUrl = `https://www.polyfauna.com/artist/${artist.slug || slug}`;
  const seoDescription = artist.bio || `${artist.name}, artista de música electrónica en POLYFAUNA Radio, podcasts y eventos.`;
  const sameAs = Object.values(links).filter(value => typeof value === 'string' && /^https?:\/\//.test(value));
  const hasContent = content.albums.length > 0 || content.tracks.length > 0 || content.podcasts.length > 0 || content.events.length > 0;

  return (
    <>
      <Helmet>
        <title>{artist.name} — POLYFAUNA</title>
        <meta name="description" content={seoDescription} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:site_name"   content="POLYFAUNA" />
        <meta property="og:locale"      content="es_CO" />
        <meta property="og:title"       content={`${artist.name} — POLYFAUNA`} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image"       content={img} />
        <meta property="og:image:alt"   content={`${artist.name} en POLYFAUNA`} />
        <meta property="og:url"         content={canonicalUrl} />
        <meta property="og:type"        content="profile" />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content={`${artist.name} — POLYFAUNA`} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image"      content={img} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          name: artist.name,
          description: seoDescription,
          image: img,
          genre: genres,
          url: canonicalUrl,
          sameAs,
          memberOf: { '@type': 'Organization', name: 'POLYFAUNA', url: 'https://www.polyfauna.com/' },
        })}</script>
      </Helmet>

      <div className="min-h-screen poly-bg text-white font-sans">
        {/* Top nav */}
        <nav className="sticky top-0 z-30 flex items-center justify-between px-5 py-4"
          style={{ background: 'rgba(5,9,10,0.85)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Link to="/"
            className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            POLYFAUNA
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.09)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            >
              <Share2 className="w-3.5 h-3.5" />
              {copied ? '¡Copiado!' : 'Compartir'}
            </button>
          </div>
        </nav>

        {/* Hero */}
        <div className="relative" style={{ height: 320 }}>
          <img src={img} alt={artist.name}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'brightness(0.35) saturate(0.7)' }} />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(5,9,10,0.95) 100%)' }} />
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-5">
          {/* Avatar + name */}
          <div className="flex items-end gap-5 -mt-20 relative z-10 mb-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-28 h-28 rounded-2xl overflow-hidden shrink-0"
              style={{ border: '3px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)' }}
            >
              <img src={img} alt={artist.name} className="w-full h-full object-cover" />
            </motion.div>
            <div className="pb-2 min-w-0">
              {artist.type && (
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wider"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>
                  {artist.type}
                </span>
              )}
              <h1 className="text-3xl font-black text-white leading-none truncate">{artist.name}</h1>
            </div>
          </div>

          {/* Genres */}
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {genres.map((g) => (
                <span key={g} className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(32,199,232,0.10)', color: 'rgba(32,199,232,0.85)', border: '1px solid rgba(32,199,232,0.18)' }}>
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Bio */}
          {artist.bio && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="mb-8 p-5 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{artist.bio}</p>
            </motion.div>
          )}

          {/* Social links */}
          {Object.keys(links).length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="mb-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Redes & Links</p>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_LINKS.map(({ key, icon, label, color, build }) =>
                  links[key] ? (
                    <SocialBtn key={key} href={build(links[key])} icon={icon} label={label} color={color} />
                  ) : null
                )}
              </div>
            </motion.div>
          )}

          {/* Artist content */}
          {hasContent && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              className="mb-10 space-y-8">
              {content.albums.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3 flex items-center gap-2">
                    <Disc3 className="w-3.5 h-3.5" />
                    Música
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {content.albums.map((album) => (
                      <Link
                        key={album.id}
                        to="/"
                        className="group rounded-xl overflow-hidden transition-colors"
                        style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div className="aspect-square bg-white/5 overflow-hidden">
                          <img src={album.cover_url || img} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-bold text-white truncate">{album.title}</p>
                          <p className="text-[11px] text-white/35 truncate">{[album.genre, album.release_year].filter(Boolean).join(' · ') || artist.name}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {content.tracks.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3 flex items-center gap-2">
                    <Play className="w-3.5 h-3.5" />
                    Tracks
                  </p>
                  <div className="space-y-2">
                    {content.tracks.map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
                          <img src={track.albums?.cover_url || img} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{track.title}</p>
                          <p className="text-[11px] text-white/35 truncate">{track.albums?.title || track.genre || artist.name}</p>
                        </div>
                        <Link
                          to="/"
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(32,199,232,0.10)', border: '1px solid rgba(32,199,232,0.20)' }}
                          title="Escuchar en POLYFAUNA"
                        >
                          <Play className="w-4 h-4" style={{ color: 'rgba(125,231,255,0.95)' }} />
                        </Link>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {content.podcasts.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3 flex items-center gap-2">
                    <Headphones className="w-3.5 h-3.5" />
                    Podcasts / Mixes
                  </p>
                  <div className="space-y-2">
                    {content.podcasts.map((podcast) => (
                      <Link
                        key={podcast.id}
                        to="/"
                        className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                        style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
                          <img src={podcast.cover_url || img} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{podcast.title}</p>
                          <p className="text-[11px] text-white/35 truncate">{podcast.genre || 'Mix POLYFAUNA'}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-white/25 shrink-0" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {content.events.length > 0 && (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3 flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Próximos eventos
                  </p>
                  <div className="space-y-2">
                    {content.events.map((event) => (
                      <Link
                        key={event.id}
                        to={`/e/${event.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                        style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
                          <img src={event.image_url || img} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{event.title}</p>
                          <p className="text-[11px] text-white/35 truncate">
                            {[event.venue || event.city, event.date && new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-white/25 shrink-0" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {/* CTA to platform */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mb-12 p-5 rounded-2xl text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs text-white/35 mb-4 font-medium">
              Escucha sus mixes, sigue sus eventos y conecta en la comunidad.
            </p>
            <Link to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all"
              style={{ background: 'rgba(255,255,255,0.92)', color: '#080B14' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; }}
            >
              <ExternalLink className="w-4 h-4" />
              Abrir en POLYFAUNA
            </Link>
          </motion.div>
        </div>
      </div>
    </>
  );
}
