import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CalendarDays, Clock, ExternalLink, Mic, Play, Video } from 'lucide-react';
import supabase from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { LoadingSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';

const FALLBACK = 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop';

const FORMAT_ICONS = { video: Video, audio: Mic, text: Mic };

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Interview detail page ── */
function InterviewDetail({ interview, onBack }) {
  const FormatIcon = FORMAT_ICONS[interview.format?.toLowerCase()] || Mic;
  const isVideo = interview.format?.toLowerCase() === 'video';

  return (
    <motion.div
      key="interview-detail"
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
        Interviews
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 300 }}>
        <img
          src={interview.image_url || FALLBACK}
          alt={interview.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.7)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

        <div className="relative z-10 p-6 flex flex-col justify-end" style={{ minHeight: 300 }}>
          {interview.subject && (
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#D946EF' }}>
              {interview.subject}
            </p>
          )}
          <h1 className="text-2xl font-black text-white leading-tight">{interview.title}</h1>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            {interview.format && (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'rgba(217,70,239,0.15)', color: '#D946EF', border: '1px solid rgba(217,70,239,0.25)' }}
              >
                <FormatIcon className="w-3 h-3" />
                {interview.format}
              </span>
            )}
            {interview.duration_minutes && (
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <Clock className="w-3 h-3" />
                {interview.duration_minutes} min
              </span>
            )}
            {interview.created_at && (
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <CalendarDays className="w-3 h-3" />
                {formatDate(interview.created_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {(interview.excerpt || interview.content) && (
        <div className="p-6 rounded-2xl" style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">
            {interview.content ? 'Entrevista' : 'Sobre esta entrevista'}
          </h2>
          <p className="text-sm text-white/75 leading-loose whitespace-pre-wrap">
            {interview.content || interview.excerpt}
          </p>
        </div>
      )}

      {/* CTA */}
      {interview.video_url && (
        <a
          href={interview.video_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl text-base font-black no-underline"
          style={{
            background: 'linear-gradient(135deg, #D946EF, #9333EA)',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(217,70,239,0.35)',
          }}
        >
          {isVideo ? <Play className="w-5 h-5 fill-white" /> : <Mic className="w-5 h-5" />}
          {isVideo ? 'Ver entrevista' : 'Escuchar entrevista'}
          <ExternalLink className="w-4 h-4 opacity-60" />
        </a>
      )}
    </motion.div>
  );
}

function InterviewCard({ interview, index, onClick }) {
  const FormatIcon = FORMAT_ICONS[interview.format?.toLowerCase()] || Mic;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      onClick={onClick}
      className="flex gap-4 p-4 rounded-xl cursor-pointer group"
      style={{ background: 'rgba(11, 16, 15, 0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(217,70,239,0.25)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0">
        <img
          src={interview.image_url || FALLBACK}
          alt={interview.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        {interview.format && (
          <div
            className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{ background: 'rgba(217,70,239,0.85)', color: '#fff' }}
          >
            <FormatIcon className="w-2.5 h-2.5" />
            {interview.format}
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
        <div>
          {interview.subject && (
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#D946EF' }}>
              {interview.subject}
            </p>
          )}
          <h3 className="text-sm font-bold text-white leading-snug">{interview.title}</h3>
          {interview.excerpt && (
            <p className="text-xs text-white/40 mt-1.5 line-clamp-2 leading-relaxed">{interview.excerpt}</p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 text-[10px] text-white/30">
          {interview.created_at && <span>{formatDateShort(interview.created_at)}</span>}
          {interview.duration_minutes && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {interview.duration_minutes} min
            </span>
          )}
          <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors">Leer más →</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function InterviewsSection() {
  const [selectedInterview, setSelectedInterview] = useState(null);

  const { data: interviews, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('interviews').select('*').eq('is_public', true).order('created_at', { ascending: false }).limit(100),
    []
  );

  return (
    <AnimatePresence mode="wait">
      {selectedInterview ? (
        <InterviewDetail
          key="detail"
          interview={selectedInterview}
          onBack={() => setSelectedInterview(null)}
        />
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="p-5 space-y-5"
        >
          <div>
            <h1 className="text-xl font-black text-white">Interviews</h1>
            <p className="text-sm text-white/40 mt-1">Conversaciones profundas con artistas y figuras del mundo electrónico.</p>
          </div>

          {loading && <LoadingSkeleton rows={5} />}
          {error && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && (!interviews || interviews.length === 0) && (
            <EmptyState label="No hay entrevistas aún" icon={Video} />
          )}
          {!loading && !error && interviews && interviews.length > 0 && (
            <div className="space-y-3">
              {interviews.map((interview, i) => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  index={i}
                  onClick={() => setSelectedInterview(interview)}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
