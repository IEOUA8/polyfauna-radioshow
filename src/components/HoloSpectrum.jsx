import React from 'react';
import { motion } from 'framer-motion';

const N = 38;

const BAR_DATA = Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1);
  const hue = 188 + t * 122;
  const env = 0.55 + Math.sin(t * Math.PI) * 0.45;
  const raw = 28 + Math.sin(i * 0.72) * 22 + Math.sin(i * 0.21 + 1.1) * 12;
  const maxH = Math.max(14, raw * env);
  return {
    maxH,
    minH: maxH * 0.10 + 2,
    hue,
    dur: 0.26 + (i % 8) * 0.065,
    del: (i % 6) * 0.052,
  };
});

export default function HoloSpectrum({ isPlaying = false, height = 80, className = '' }) {
  return (
    <div className={`relative ${className}`} style={{ height }}>

      {/* Bloom glow (blurred duplicate) */}
      <div
        className="absolute inset-0 flex items-end"
        style={{ gap: '2px', padding: '0 1px', filter: 'blur(7px)', opacity: 0.5, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {BAR_DATA.map((bar, i) => (
          <motion.div
            key={i}
            className="flex-1"
            style={{ borderRadius: '2px 2px 0 0', background: `hsl(${bar.hue}, 100%, 62%)` }}
            animate={isPlaying
              ? { height: [`${bar.minH}%`, `${bar.maxH}%`] }
              : { height: `${bar.minH * 0.5}%` }
            }
            transition={{ duration: bar.dur, repeat: Infinity, repeatType: 'reverse', delay: bar.del, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Main crisp bars */}
      <div
        className="absolute inset-0 flex items-end"
        style={{ gap: '2px', padding: '0 1px' }}
      >
        {BAR_DATA.map((bar, i) => (
          <motion.div
            key={i}
            className="flex-1"
            style={{
              borderRadius: '2px 2px 0 0',
              background: `linear-gradient(to top, hsl(${bar.hue - 30}, 55%, 25%), hsl(${bar.hue}, 100%, 62%))`,
            }}
            animate={isPlaying
              ? { height: [`${bar.minH}%`, `${bar.maxH}%`] }
              : { height: `${bar.minH * 0.5}%` }
            }
            transition={{ duration: bar.dur, repeat: Infinity, repeatType: 'reverse', delay: bar.del, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Floor line — holographic gradient */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent 0%, rgba(32,199,232,0.7) 20%, rgba(123,92,240,0.6) 55%, rgba(236,72,153,0.5) 80%, transparent 100%)',
          boxShadow: '0 0 10px rgba(32,199,232,0.35), 0 0 20px rgba(123,92,240,0.2)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Ground reflection glow */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '35%',
          background: 'linear-gradient(to top, rgba(32,199,232,0.05), transparent)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
