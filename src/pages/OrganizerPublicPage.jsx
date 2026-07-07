import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ExternalLink, Globe, Instagram,
  Link2, Loader2, MapPin, Twitter, Users,
} from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { normalizeArtistKey } from '@/lib/artistIdentity';
import ProfileContentTabs from '@/components/ProfileContentTabs';

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop';

const TYPE_LABEL = { club: 'Club', promoter: 'Promotor', collective: 'Colectivo', hybrid: 'Híbrido' };

const SOCIAL_DETAIL = [
  { key: 'instagram', icon: Instagram, label: 'Instagram', color: '#E1306C', build: (h) => `https://instagram.com/${h}` },
  { key: 'twitter',   icon: Twitter,   label: 'Twitter / X', color: '#94A3B8', build: (h) => `https://x.com/${h}` },
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
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      <Icon className="w-4 h-4" />
    </a>
  );
}

export default function OrganizerPublicPage() {
  const { slug } = useParams();

  const [organizer, setOrganizer] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [mirrorArtistId, setMirrorArtistId] = useState(null);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('organizers')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setOrganizer(data);
        setLoading(false);
      });
  }, [slug]);

  // Un organizador puede tener una fila espejo en `artists` si además sube
  // contenido propio (música/podcast/entrevistas). Se resuelve por slug,
  // ya que no existe una columna de vínculo explícita entre ambas tablas.
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

  const canonicalUrl = `https://www.polyfauna.com/organizadores/${slug}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${organizer?.name} en POLYFAUNA`, url: canonicalUrl });
      } else {
        await navigator.clipboard.writeText(canonicalUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (_) {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080B14' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'rgba(255,255,255,0.25)' }} />
      </div>
    );
  }

  /* ── Not found ── */
  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center" style={{ background: '#080B14' }}>
        <p className="text-2xl font-black text-white">Organizador no encontrado</p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
          El enlace puede haber caducado o el perfil fue eliminado.
        </p>
        <Link to="/" className="mt-2 text-sm font-bold transition-colors" style={{ color: 'rgba(255,255,255,0.45)' }}>
          ← Ir a PolyFauna
        </Link>
      </div>
    );
  }

  const links = typeof organizer.social_links === 'object' && organizer.social_links ? organizer.social_links : {};
  const img = organizer.image_url || FALLBACK;
  const seoDescription = organizer.bio
    ? organizer.bio.slice(0, 300)
    : `${organizer.name} en POLYFAUNA — escena electrónica underground de Colombia.`;
  const sameAs = SOCIAL_DETAIL
    .map(({ key, build }) => (links[key] ? build(links[key]) : null))
    .filter(Boolean);

  return (
    <>
      <Helmet>
        <title>{organizer.name} — POLYFAUNA</title>
        <meta name="description" content={seoDescription} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:site_name"   content="POLYFAUNA" />
        <meta property="og:locale"      content="es_CO" />
        <meta property="og:title"       content={`${organizer.name} — POLYFAUNA`} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image"       content={img} />
        <meta property="og:image:alt"   content={organizer.name} />
        <meta property="og:url"         content={canonicalUrl} />
        <meta property="og:type"        content="profile" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={`${organizer.name} — POLYFAUNA`} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image"       content={img} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: organizer.name,
          description: seoDescription,
          image: img,
          url: canonicalUrl,
          ...(organizer.city ? { address: { '@type': 'PostalAddress', addressLocality: organizer.city } } : {}),
          ...(sameAs.length > 0 ? { sameAs } : {}),
        })}</script>
      </Helmet>

      <div className="min-h-screen" style={{ background: '#080B14' }}>

        {/* Cover */}
        <div className="relative w-full overflow-hidden" style={{ height: 220 }}>
          <img
            src={organizer.cover_url || img}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110"
            style={{ filter: 'blur(6px) brightness(0.4) saturate(0.7)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080B14] via-black/40 to-black/20" />

          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-5 sm:pt-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-bold transition-colors"
              style={{ color: 'rgba(255,255,255,0.70)', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}
            >
              <ArrowLeft className="w-4 h-4" />
              PolyFauna
            </Link>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl transition-all"
              style={{
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: copied ? '#22c55e' : 'rgba(255,255,255,0.85)',
              }}
            >
              <Link2 className="w-4 h-4" />
              {copied ? '¡Copiado!' : 'Compartir'}
            </button>
          </div>
        </div>

        {/* Avatar + info */}
        <div className="max-w-xl mx-auto px-5">
          <div className="flex items-end gap-4 relative" style={{ marginTop: -56 }}>
            <div
              className="rounded-full overflow-hidden shrink-0"
              style={{
                width: 112, height: 112,
                border: '3px solid #080B14',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.13), 0 10px 32px rgba(0,0,0,0.75)',
              }}
            >
              <img src={img} alt={organizer.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              {organizer.type && (
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  {TYPE_LABEL[organizer.type] || organizer.type}
                </span>
              )}
              <h1 className="text-2xl font-black text-white leading-tight">{organizer.name}</h1>
              {organizer.city && (
                <span className="text-xs font-medium text-white/45 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5" /> {organizer.city}
                </span>
              )}
            </div>
          </div>

          {sameAs.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-4">
              {SOCIAL_DETAIL.map(({ key, icon, label, color, build }) =>
                links[key] ? <SocialButton key={key} href={build(links[key])} icon={icon} label={label} color={color} /> : null
              )}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-4 mt-6 pb-24"
          >
            {organizer.bio && (
              <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">Sobre {organizer.name}</h2>
                <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{organizer.bio}</p>
              </div>
            )}

            {(organizer.address || organizer.capacity) && (
              <div className="p-5 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-3">Venue</h2>
                <div className="space-y-2 text-sm text-white/60">
                  {organizer.address && (
                    <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-white/35" /> {organizer.address}</p>
                  )}
                  {organizer.capacity && (
                    <p className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-white/35" /> Capacidad para {organizer.capacity}</p>
                  )}
                </div>
              </div>
            )}

            <ProfileContentTabs organizerId={organizer.id} artistId={mirrorArtistId || undefined} />

            <div className="text-center">
              <Link
                to={`/?section=organizadores&organizer=${encodeURIComponent(slug || '')}`}
                className="inline-flex items-center gap-2 text-sm font-bold transition-colors"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              >
                Ver perfil completo en PolyFauna
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
