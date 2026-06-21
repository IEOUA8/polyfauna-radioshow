import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CalendarDays, ExternalLink, FileText, Mic, Play, Video } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { CardSkeleton, EmptyState, ErrorState, LoadingSkeleton } from '@/components/SectionStates';

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

// ── Blog article detail ───────────────────────────────────────────────────────

function ArticleDetail({ article, onBack }) {
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
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 220 }}>
        <img src={article.cover_url || BLOG_FALLBACK} alt={article.title}
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
          <p className="text-xs text-white/50 mt-1.5">{formatDate(article.published_at)}{article.author ? ` · ${article.author}` : ''}</p>
        </div>
      </div>
      {article.excerpt && (
        <p className="text-sm text-white/60 leading-relaxed font-medium">{article.excerpt}</p>
      )}
      {article.content && (
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
            <img src={interview.image_url || IVTW_FALLBACK} alt={interview.title}
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
  const cover       = item.cover_url || item.image_url || (isInterview ? IVTW_FALLBACK : BLOG_FALLBACK);

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
        <img src={cover} alt={item.title}
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
    () => supabase.from('blog_articles').select('*').order('published_at', { ascending: false }),
    []
  );

  const { data: interviews, loading: ivtwLoading, error: ivtwError } = useSupabaseQuery(
    () => supabase.from('interviews').select('*').order('created_at', { ascending: false }),
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
