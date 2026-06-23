import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';

/* ── Shimmer helper ── */
function Shimmer() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
      }}
      animate={{ backgroundPositionX: ['200%', '-200%'] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
    />
  );
}

function SkeletonBlock({ className = '', style = {} }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ background: 'rgba(255,255,255,0.05)', ...style }}>
      <Shimmer />
    </div>
  );
}

/* ── Row skeleton ── */
export function LoadingSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <SkeletonBlock className="w-10 h-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3 rounded" style={{ width: `${55 + (i % 3) * 15}%` }} />
            <SkeletonBlock className="h-2.5 rounded" style={{ width: `${35 + (i % 2) * 20}%` }} />
          </div>
          <SkeletonBlock className="w-12 h-5 rounded-full shrink-0" />
        </motion.div>
      ))}
    </div>
  );
}

/* ── Card skeleton ── */
export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-xl overflow-hidden"
          style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="relative aspect-square overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Shimmer />
          </div>
          <div className="p-3 space-y-2">
            <SkeletonBlock className="h-3" style={{ width: `${60 + (i % 3) * 12}%` }} />
            <SkeletonBlock className="h-2.5" style={{ width: `${40 + (i % 2) * 15}%` }} />
            <div className="flex items-center justify-between pt-1">
              <SkeletonBlock className="h-2 w-16" />
              <SkeletonBlock className="h-2 w-10" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Inline spinner ── */
export function PulseLoader({ size = 'md', label }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <motion.div
        className={`${sz} rounded-full border-2 border-white/15 border-t-white/60`}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      />
      <span className="text-sm text-white/35">{label || 'Sintonizando señal...'}</span>
    </div>
  );
}

/* ── Empty state ── */
export function EmptyState({
  label = 'Aún no hay señales en este hábitat',
  subtitle,
  icon: Icon,
  action,
  actionLabel,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-1 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <motion.span
          className="absolute inset-2 rounded-2xl border border-white/10"
          animate={{ scale: [0.78, 1.12], opacity: [0.35, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
        {Icon ? (
          <Icon className="relative z-10 w-6 h-6" style={{ color: 'rgba(255,255,255,0.50)' }} />
        ) : (
          <div className="relative z-10 flex items-end gap-0.5 h-6">
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="w-1 rounded-full bg-white/45"
                animate={{ height: [6, 18, 8] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.16 }}
              />
            ))}
          </div>
        )}
      </motion.div>
      <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</p>
      <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.22)' }}>
        {subtitle || 'Cuando el bioma despierte contenido nuevo, aparecerá aquí.'}
      </p>
      {action && actionLabel && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={action}
          className="mt-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
          style={{
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Error state ── */
export function ErrorState({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4"
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
        <AlertCircle className="w-6 h-6 text-red-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-red-400">Error al cargar</p>
        {message && <p className="text-xs mt-1 max-w-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>{message}</p>}
      </div>
      {onRetry && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg mt-1 transition-all"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.10)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
        >
          <RefreshCw className="w-3 h-3" />
          Reintentar
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Login required ── */
export function LoginRequired({ message = 'Inicia sesión para ver este contenido', actionLabel = 'Iniciar sesión', actionHref = '/login' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <svg className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.50)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.58)' }}>{message}</p>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.24)' }}>Crea tu cuenta gratis para acceder a todo el contenido.</p>
      </div>
      <div className="flex gap-3 mt-1">
        <a
          href={actionHref}
          className="text-xs font-bold px-4 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.90)', color: '#080B14' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          {actionLabel}
        </a>
        <a
          href="/signup"
          className="text-xs font-bold px-4 py-2 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.10)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
        >
          Crear cuenta
        </a>
      </div>
    </motion.div>
  );
}
