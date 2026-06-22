import React from 'react';
import { motion } from 'framer-motion';

const N = 40;

const BAR_DATA = Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1);
  const env = 0.55 + Math.sin(t * Math.PI) * 0.45;
  const raw = 22 + Math.sin(i * 0.72) * 18 + Math.sin(i * 0.2 + 1.1) * 10;
  const maxH = Math.max(10, raw * env);
  return {
    maxH,
    minH: maxH * 0.08 + 1,
    opacity: 0.35 + Math.sin((i / (N - 1)) * Math.PI) * 0.55,
    dur: 0.28 + (i % 7) * 0.08,
    del: (i % 6) * 0.055,
  };
});

export default function HoloSpectrum({ isPlaying = false, height = 80, className = '' }) {
  return (
    <div className={`relative flex items-end ${className}`} style={{ height, gap: '3px' }}>
      {BAR_DATA.map((bar, i) => (
        <motion.div
          key={i}
          style={{
            flex: '1',
            maxWidth: '4px',
            borderRadius: '1px 1px 0 0',
            background: `rgba(255, 255, 255, ${bar.opacity})`,
          }}
          animate={isPlaying
            ? { height: [`${bar.minH}%`, `${bar.maxH}%`] }
            : { height: `${bar.minH * 0.4}%` }
          }
          transition={{
            duration: bar.dur,
            repeat: Infinity,
            repeatType: 'reverse',
            delay: bar.del,
            ease: 'easeInOut',
          }}
        />
      ))}

      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: '1px', background: 'rgba(255,255,255,0.12)' }}
        aria-hidden="true"
      />
    </div>
  );
}
