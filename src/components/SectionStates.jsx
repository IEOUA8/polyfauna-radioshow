import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function LoadingSkeleton({ rows = 4, cols = 1 }) {
  return (
    <div className={`grid gap-4 ${cols > 1 ? `grid-cols-${cols}` : ''}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
          className="rounded-xl h-24"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
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
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
          className="rounded-xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <div className="aspect-video" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-3/4 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="h-2 w-1/2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function EmptyState({ label = 'No hay contenido aún', icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {Icon && (
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
          style={{ background: 'rgba(0,207,255,0.08)' }}
        >
          <Icon className="w-5 h-5" style={{ color: '#00CFFF' }} />
        </div>
      )}
      <p className="text-sm font-semibold text-white/50">{label}</p>
      <p className="text-xs text-white/25">El contenido aparecerá aquí cuando esté disponible.</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p className="text-sm font-semibold text-red-400">Error al cargar</p>
      <p className="text-xs text-white/30 max-w-xs">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg mt-1 transition-colors"
          style={{ background: 'rgba(0,207,255,0.1)', color: '#00CFFF' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,207,255,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,207,255,0.1)')}
        >
          <RefreshCw className="w-3 h-3" />
          Reintentar
        </button>
      )}
    </div>
  );
}

export function LoginRequired({ message = 'Inicia sesión para ver este contenido' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(0,207,255,0.08)', border: '1px solid rgba(0,207,255,0.15)' }}
      >
        <svg className="w-5 h-5" style={{ color: '#00CFFF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-white/60">{message}</p>
      <a
        href="/login"
        className="text-xs font-bold px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
        style={{ background: '#00CFFF', color: '#080B14' }}
      >
        Iniciar sesión
      </a>
    </div>
  );
}
