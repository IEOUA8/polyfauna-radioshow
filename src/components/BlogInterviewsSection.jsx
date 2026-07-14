import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CalendarDays, Check, ExternalLink, FileText, Heart, Mic, Play, Share2, Video } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useToast } from '@/components/ui/use-toast';
import { CardSkeleton, EmptyState, ErrorState, LoadingSkeleton } from '@/components/SectionStates';

const SITE_URL = 'https://www.polyfauna.com';
const LIKED_KEY = 'pf_liked_articles_v1';

function readLikedIds() {
  try { return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'); } catch { return []; }
}
function writeLikedIds(ids) {
  try { localStorage.setItem(LIKED_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

// Barra de acciones del artículo: corazón (like con contador, apto para
// invitados vía RPC + guardia localStorage) y compartir (hoja nativa del SO
// —WhatsApp, redes— con fallback a copiar el enlace).
function ArticleActions({ article }) {
  const { toast } = useToast();
  const [liked, setLiked] = useState(() => readLikedIds().includes(article.id));
  const [count, setCount] = useState(article.like_count || 0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = article.slug ? `${SITE_URL}/blog/${article.slug}` : SITE_URL;

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    const next = !liked;
    // Optimista.
    setLiked(next);
    setCount(c => Math.max(0, c + (next ? 1 : -1)));
    const ids = readLikedIds().filter(id => id !== article.id);
    writeLikedIds(next ? [...ids, article.id] : ids);
    try {
      const { data, error } = await supabase.rpc('toggle_article_like', { p_article_id: article.id, p_liked: next });
      if (error) throw error;
      if (typeof data === 'number') setCount(data);
    } catch {
      // Revertir si falla el servidor.
      setLiked(!next);
      setCount(c => Math.max(0, c + (next ? -1 : 1)));
      writeLikedIds(next ? ids : [...ids, article.id]);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const payload = { title: `${article.title} — POLYFAUNA`, text: article.excerpt || article.title, url: shareUrl };
    try {
      if (navigator.share) { await navigator.share(payload); return; }
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Enlace copiado', description: 'Ya puedes pegarlo donde quieras compartirlo.' });
    } catch { /* usuario canceló la hoja de compartir */ }
  };

  return (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={toggleLike} aria-pressed={liked}
        aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all"
        style={{
          background: liked ? 'rgba(255,138,31,0.14)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${liked ? 'rgba(255,138,31,0.4)' : 'rgba(255,255,255,0.12)'}`,
          color: liked ? '#FF8A1F' : 'rgba(255,255,255,0.75)',
        }}>
        <Heart className="w-4 h-4" style={{ fill: liked ? '#FF8A1F' : 'transparent' }} />
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>
      <button type="button" onClick={share} aria-label="Compartir artículo"
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
        {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        <span>{copied ? 'Copiado' : 'Compartir'}</span>
      </button>
    </div>
  );
}

const BLOG_FALLBACK  = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?q=80&w=600&auto=format&fit=crop';
const IVTW_FALLBACK  = 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop';

const CATEGORY_COLORS = {
  'Crónica':    '#B8CFA6', 'Entrevista': '#D946EF', 'Reseña':    '#7C5CFF',
  'Noticias':   'rgba(255,255,255,0.9)',              'Opinión':   '#FF8A1F',
  'Tutorial':   '#5DE0A3',
};

const FORMAT_ICONS = { video: Video, audio: Mic, text: Mic };

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// La portada usó cover_url durante mucho tiempo pero la tabla real guarda
// featured_image_url; aceptamos ambas para no romper datos viejos ni nuevos.
function coverOf(item, fallback = BLOG_FALLBACK) {
  return item.cover_url || item.featured_image_url || fallback;
}

// ── Cuerpo editorial rico (content_format === 'blocks') ───────────────────────
// El contenido llega como un arreglo JSON de bloques tipados. Cada tipo se
// pinta con su propio tratamiento tipográfico —capitular, cita, secciones,
// la tabla de hábitats, figuras— honrando el diseño del archivo editorial
// pero en una sola columna apta para el panel angosto de la app.

const MONO = "'IBM Plex Mono', monospace";
const DISPLAY = "'Jost', sans-serif";

function FigureBlock({ src, alt, caption }) {
  return (
    <figure className="my-6">
      {src ? (
        <img src={src} alt={alt || caption || ''} loading="lazy" decoding="async"
          className="w-full rounded-xl object-cover"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
      ) : (
        <div className="rounded-xl flex items-end p-4" style={{
          height: 200,
          background: 'repeating-linear-gradient(135deg,rgba(255,255,255,0.05) 0 2px,transparent 2px 12px)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
            [ imagen pendiente ]
          </span>
        </div>
      )}
      {caption && (
        <figcaption className="mt-2" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', color: 'rgba(255,255,255,0.32)' }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function ArticleBody({ blocks }) {
  return (
    <div className="space-y-1">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'section':
            return (
              <div key={i} className="pt-2 pb-1" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                § {b.label}
              </div>
            );
          case 'p':
            return (
              <p key={i} className="text-[15px] leading-[1.85]" style={{ color: 'rgba(255,255,255,0.72)', textWrap: 'pretty', marginTop: b.dropcap ? 4 : 12 }}>
                {b.dropcap && (
                  <span style={{ float: 'left', fontFamily: DISPLAY, fontWeight: 300, fontSize: 62, lineHeight: 0.8, color: '#ECECEC', margin: '4px 12px -4px 0' }}>
                    {b.text.charAt(0)}
                  </span>
                )}
                {b.dropcap ? b.text.slice(1) : b.text}
              </p>
            );
          case 'pullquote':
            return (
              <blockquote key={i} className="my-6 pl-5"
                style={{ borderLeft: '1px solid rgba(255,255,255,0.22)', fontFamily: DISPLAY, fontWeight: 300, fontSize: 26, lineHeight: 1.3, color: '#ECECEC', textWrap: 'balance' }}>
                «{b.text}»
              </blockquote>
            );
          case 'heading':
            return (
              <h2 key={i} className="mt-8 mb-1" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 34, lineHeight: 1.05, color: '#ECECEC' }}>
                {b.text}
              </h2>
            );
          case 'lead':
            return (
              <p key={i} className="mb-4 text-[14px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {b.text}
              </p>
            );
          case 'habitats':
            return (
              <div key={i} className="my-4">
                {b.items.map((it, j) => (
                  <div key={j} className="py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>{it.code}</span>
                      <span style={{ fontFamily: DISPLAY, fontStyle: 'italic', fontWeight: 300, fontSize: 22, color: '#ECECEC' }}>{it.species}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>· {it.city}</span>
                    </div>
                    <p className="mt-2 text-[14.5px] leading-[1.8]" style={{ color: 'rgba(255,255,255,0.68)', textWrap: 'pretty' }}>{it.text}</p>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }} />
              </div>
            );
          case 'stratum':
            // Bloque de mención destacado: marcador grande (p. ej. ≈1999) +
            // etiqueta, separado por una línea del texto, con una nota-fuente
            // debajo del recuadro. Reproduce la marginalia del diseño impreso.
            return (
              <div key={i} className="my-6">
                <div className="rounded-xl p-4 sm:p-5 flex items-stretch gap-4"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div className="flex flex-col justify-center items-center shrink-0 pr-4 text-center"
                    style={{ borderRight: '1px solid rgba(255,255,255,0.12)' }}>
                    <span style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: 40, lineHeight: 1, color: '#ECECEC', whiteSpace: 'nowrap' }}>
                      {b.marker}
                    </span>
                    {b.label && (
                      <span className="mt-2" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                        {b.label}
                      </span>
                    )}
                  </div>
                  <p className="self-center text-[14px] leading-[1.75]" style={{ color: 'rgba(255,255,255,0.72)', textWrap: 'pretty' }}>
                    {b.text}
                  </p>
                </div>
                {b.note && (
                  <div className="mt-2" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', color: 'rgba(255,255,255,0.3)' }}>
                    {b.note}
                  </div>
                )}
              </div>
            );
          case 'figure':
            return <FigureBlock key={i} src={b.src} alt={b.alt} caption={b.caption} />;
          case 'signoff':
            return (
              <div key={i} className="mt-8 pt-5 flex items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', lineHeight: 1.8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                  {b.text}
                </span>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

// ── Blog article detail ───────────────────────────────────────────────────────

function ArticleDetail({ article, onBack }) {
  // content_format 'blocks' → cuerpo editorial estructurado. Cualquier otra
  // cosa (o JSON inválido) cae al render de texto plano legado.
  let blocks = null;
  if (article.content_format === 'blocks' && article.content) {
    try {
      const parsed = JSON.parse(article.content);
      if (Array.isArray(parsed)) blocks = parsed;
    } catch { /* cae a texto plano */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="p-5 space-y-5"
    >
      <button type="button" onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Blog & Entrevistas
      </button>
      <div className="relative aspect-video rounded-2xl overflow-hidden">
        <img src={coverOf(article)} alt={article.title}
          loading="eager" fetchPriority="high" decoding="async"
          className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          {article.category && (
            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded mb-2"
              style={{ background: 'rgba(0,0,0,0.55)', color: CATEGORY_COLORS[article.category] || 'white' }}>
              {article.category}
            </span>
          )}
          <h1 className="text-xl font-black text-white leading-tight">{article.title}</h1>
          <p className="text-xs text-white/50 mt-1.5">{formatDate(article.published_at || article.created_at)}{article.author ? ` · ${article.author}` : ''}</p>
        </div>
      </div>
      {article.excerpt && (
        <p className="text-sm text-white/60 leading-relaxed font-medium">{article.excerpt}</p>
      )}
      <ArticleActions article={article} />
      {blocks
        ? <ArticleBody blocks={blocks} />
        : article.content && (
            <div className="text-sm text-white/50 leading-relaxed space-y-3 whitespace-pre-wrap">
              {article.content}
            </div>
          )}
      {article.external_url && (
        <a href={article.external_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}>
          <ExternalLink className="w-4 h-4" /> Leer artículo completo
        </a>
      )}
    </motion.div>
  );
}

// ── Interview detail ──────────────────────────────────────────────────────────

function InterviewDetail({ interview, onBack }) {
  const FormatIcon = FORMAT_ICONS[interview.format?.toLowerCase()] || Mic;
  const isVideo    = interview.format?.toLowerCase() === 'video';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="p-5 space-y-5"
    >
      <button type="button" onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Blog & Entrevistas
      </button>
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 260 }}>
        {isVideo && interview.video_url ? (
          <iframe src={interview.video_url} title={interview.title}
            className="w-full aspect-video rounded-xl" allowFullScreen
            style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
        ) : (
          <>
            <img src={interview.image_url || IVTW_FALLBACK} alt={interview.title} loading="lazy" decoding="async"
              className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </>
        )}
        {!isVideo && (
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h1 className="text-xl font-black text-white leading-tight">{interview.title}</h1>
            {interview.guest_name && <p className="text-sm text-white/60 mt-1">{interview.guest_name}</p>}
          </div>
        )}
      </div>
      {isVideo && <h1 className="text-xl font-black text-white">{interview.title}</h1>}
      {interview.description && (
        <p className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap">{interview.description}</p>
      )}
      {!isVideo && interview.audio_url && (
        <audio controls src={interview.audio_url} className="w-full mt-2"
          style={{ filter: 'invert(1) hue-rotate(180deg) brightness(0.8)' }} />
      )}
      {interview.external_url && (
        <a href={interview.external_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}>
          <ExternalLink className="w-4 h-4" /> Ver entrevista completa
        </a>
      )}
    </motion.div>
  );
}

// ── Unified card ─────────────────────────────────────────────────────────────

function ContentCard({ item, onClick, idx }) {
  const isInterview = item._type === 'interview';
  const FormatIcon  = FORMAT_ICONS[item.format?.toLowerCase()] || (isInterview ? Mic : FileText);
  const tagColor    = isInterview ? '#D946EF' : (CATEGORY_COLORS[item.category] || 'rgba(255,255,255,0.9)');
  const tag         = isInterview ? (item.format || 'Entrevista') : item.category;
  const cover       = item.cover_url || item.featured_image_url || item.image_url || (isInterview ? IVTW_FALLBACK : BLOG_FALLBACK);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="group cursor-pointer rounded-xl overflow-hidden"
      style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      <div className="relative aspect-video overflow-hidden">
        <img src={cover} alt={item.title} loading="lazy" decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{ background: 'rgba(0,0,0,0.60)', color: tagColor }}>
            {tag}
          </span>
          {isInterview && <FormatIcon className="w-3 h-3 text-white/60" />}
        </div>
        {isInterview && item.format?.toLowerCase() === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
              <Play className="w-4 h-4 text-white fill-current ml-0.5" />
            </div>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-bold text-white leading-snug line-clamp-2">{item.title}</p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[11px] text-white/35 truncate">
            {isInterview ? (item.guest_name || 'POLYFAUNA') : (item.author || 'Redacción')}
          </p>
          <p className="text-[11px] text-white/25 shrink-0 ml-2">{formatDate(item.published_at || item.created_at)}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',        label: 'Todo'         },
  { id: 'blog',       label: 'Blog'         },
  { id: 'interviews', label: 'Entrevistas'  },
];

export default function BlogInterviewsSection() {
  const [activeTab, setActiveTab]       = useState('all');
  const [selected, setSelected]         = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  const { data: articles, loading: blogLoading, error: blogError } = useSupabaseQuery(
    () => supabase.from('blog_articles').select('*').order('published_at', { ascending: false }).limit(100),
    []
  );

  const { data: interviews, loading: ivtwLoading, error: ivtwError } = useSupabaseQuery(
    () => supabase.from('interviews').select('*').order('created_at', { ascending: false }).limit(100),
    []
  );

  const loading = blogLoading || ivtwLoading;
  const error   = blogError || ivtwError;

  const feed = useMemo(() => {
    const tagged = [
      ...(articles  || []).map(a => ({ ...a, _type: 'article'   })),
      ...(interviews || []).map(i => ({ ...i, _type: 'interview' })),
    ].sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));

    if (activeTab === 'blog')       return tagged.filter(i => i._type === 'article');
    if (activeTab === 'interviews') return tagged.filter(i => i._type === 'interview');
    return tagged;
  }, [articles, interviews, activeTab]);

  const openItem = (item) => { setSelected(item); setSelectedType(item._type); };

  // Listen for deep-link from TopBar global search
  useEffect(() => {
    const handler = (e) => {
      const { type, id } = e.detail || {};
      if (type !== 'blog_articles') return;
      const match = (articles || []).find(a => a.id === id);
      if (match) openItem({ ...match, _type: 'article' });
    };
    window.addEventListener('pf:open-item', handler);
    return () => window.removeEventListener('pf:open-item', handler);
  }, [articles]);

  // Deep-link desde /entrevistas/:interview
  useEffect(() => {
    const interviewParam = new URLSearchParams(window.location.search).get('interview');
    if (!interviewParam || !interviews?.length) return;
    const match = interviews.find(i => i.id === interviewParam);
    if (match) openItem({ ...match, _type: 'interview' });
  }, [interviews]);

  // Deep-link desde /blog/:slug (abre el artículo por slug, o por id de respaldo)
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('article');
    if (!param || !articles?.length) return;
    const match = articles.find(a => a.slug === param || a.id === param);
    if (match) openItem({ ...match, _type: 'article' });
  }, [articles]);

  const goBack   = () => { setSelected(null); setSelectedType(null); };

  if (loading) return <div className="p-5"><CardSkeleton count={4} /></div>;
  if (error)   return <div className="p-5"><ErrorState message={error} /></div>;

  return (
    <AnimatePresence mode="wait">
      {selected && selectedType === 'article' && (
        <ArticleDetail key="article" article={selected} onBack={goBack} />
      )}
      {selected && selectedType === 'interview' && (
        <InterviewDetail key="interview" interview={selected} onBack={goBack} />
      )}
      {!selected && (
        <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-5">
          <div>
            <h1 className="text-xl font-black text-white">Blog & Entrevistas</h1>
            <p className="text-sm text-white/40 mt-1">Historias, crónicas y conversaciones de la escena.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5">
            {TABS.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${activeTab === tab.id ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {feed.length === 0
            ? <EmptyState label="No hay contenido publicado aún" icon={FileText} />
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {feed.map((item, idx) => (
                  <ContentCard key={`${item._type}-${item.id}`} item={item} idx={idx} onClick={() => openItem(item)} />
                ))}
              </div>
            )
          }
        </motion.div>
      )}
    </AnimatePresence>
  );
}
