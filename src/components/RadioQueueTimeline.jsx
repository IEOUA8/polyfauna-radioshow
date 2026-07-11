import React, { useMemo } from 'react';
import { Radio } from 'lucide-react';
import { useRadioQueue } from '@/hooks/useRadioQueue';
import { projectQueueTimes, formatDuration } from '@/lib/radioQueueTiming';
import { EmptyState } from '@/components/SectionStates';

const FALLBACK_ART = 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=200&auto=format&fit=crop';
// 3 por defecto: la cola es secundaria, el protagonismo visual es del banner
// de próximos eventos justo debajo. "Ahora" no se repite aquí — ya lo dice
// el reproductor principal arriba, mostrarlo dos veces era redundante.
const MAX_UPCOMING = 3;

export default function RadioQueueTimeline({ isOnline, remainingSeconds }) {
  const { queue } = useRadioQueue();
  const upcoming = useMemo(
    () => projectQueueTimes(queue, remainingSeconds).slice(0, MAX_UPCOMING),
    [queue, remainingSeconds]
  );

  if (!isOnline) return <EmptyState label="La radio está offline" icon={Radio} />;
  if (upcoming.length === 0) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden px-4 py-3"
      style={{
        background: 'rgba(13,20,19,0.54)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid rgba(184,207,166,0.09)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* ── Cola proyectada — hora estimada en Bogotá, se resincroniza cada
          3 min con la cola real de AzuraCast; si alguien salta una pista la
          proyección se corrige sola en el próximo refresco. ── */}
      {upcoming.map((item, i) => {
        const isLast = i === upcoming.length - 1;
        return (
          <div key={i} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center w-4 shrink-0">
              <span className="mt-[18px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'rgba(32,199,232,0.65)' }} />
              {!isLast && <span className="w-px flex-1 my-1" style={{ background: 'rgba(255,255,255,0.08)' }} />}
            </div>
            <div className="flex-1 flex items-center gap-3 py-3 min-w-0" style={{ borderBottom: !isLast ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span className="text-[11px] font-mono font-bold text-white/50 shrink-0 w-11">{item.startsAtLabel}</span>
              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/5">
                <img src={item.art || FALLBACK_ART} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{item.title}</p>
                <p className="text-[10px] text-white/35 truncate">{item.artist}</p>
              </div>
              {item.genre && (
                <span
                  className="hidden sm:inline-block text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
                >
                  {item.genre}
                </span>
              )}
              <span className="text-[10px] text-white/30 shrink-0 w-11 text-right">{formatDuration(item.duration_seconds)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
