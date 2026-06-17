import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Mic, Video } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { LoadingSkeleton, EmptyState, ErrorState } from '@/components/SectionStates';

const FALLBACK = 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop';

const FORMAT_ICONS = { video: Video, audio: Mic, text: Mic };

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function InterviewCard({ interview, index }) {
  const FormatIcon = FORMAT_ICONS[interview.format?.toLowerCase()] || Mic;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="flex gap-4 p-4 rounded-xl cursor-pointer group transition-colors"
      style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,207,255,0.2)')}
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
            style={{ background: 'rgba(0,207,255,0.85)', color: '#080B14' }}
          >
            <FormatIcon className="w-2.5 h-2.5" />
            {interview.format}
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
        <div>
          {interview.subject && (
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: '#00CFFF' }}>
              {interview.subject}
            </p>
          )}
          <h3 className="text-sm font-bold text-white leading-snug">{interview.title}</h3>
          {interview.excerpt && (
            <p className="text-xs text-white/40 mt-1.5 line-clamp-2 leading-relaxed">{interview.excerpt}</p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 text-[10px] text-white/30">
          {interview.created_at && (
            <span>{formatDate(interview.created_at)}</span>
          )}
          {interview.duration_minutes && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {interview.duration_minutes} min
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function InterviewsSection() {
  const { data: interviews, loading, error, refetch } = useSupabaseQuery(
    () => supabase.from('interviews').select('*').order('created_at', { ascending: false }),
    []
  );

  return (
    <div className="p-5 space-y-5">
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
            <InterviewCard key={interview.id} interview={interview} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
