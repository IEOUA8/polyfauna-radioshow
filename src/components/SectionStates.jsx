import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';

function Shimmer() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
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

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

export function EmptyState({ label = 'No hay contenido aún', icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 gap-3 text-center"
    >
      {Icon && (
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
          style={{ background: 'rgba(32,199,232,0.08)', border: '1px solid rgba(32,199,232,0.12)' }}
        >
          <Icon className="w-5 h-5" style={{ color: '#20C7E8' }} />
        </motion.div>
      )}
      <p className="text-sm font-semibold text-white/50">{label}</p>
      <p className="text-xs text-white/25">El contenido aparecerá aquí cuando esté disponible.</p>
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 gap-3 text-center"
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <AlertCircle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm font-semibold text-red-400">Error al cargar</p>
      <p className="text-xs text-white/30 max-w-xs">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg mt-1 transition-all"
          style={{ background: 'rgba(32,199,232,0.1)', color: '#20C7E8', border: '1px solid rgba(32,199,232,0.15)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(32,199,232,0.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(32,199,232,0.1)'; }}
        >
          <RefreshCw className="w-3 h-3" />
          Reintentar
        </button>
      )}
    </motion.div>
  );
}

export function LoginRequired({ message = 'Inicia sesión para ver este contenido' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 gap-3 text-center"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(32,199,232,0.08)', border: '1px solid rgba(32,199,232,0.15)' }}
      >
        <svg className="w-5 h-5" style={{ color: '#20C7E8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-white/60">{message}</p>
      <a
        href="/login"
        className="text-xs font-bold px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
        style={{ background: '#20C7E8', color: '#080B14' }}
      >
        Iniciar sesión
      </a>
    </motion.div>
  );
}
