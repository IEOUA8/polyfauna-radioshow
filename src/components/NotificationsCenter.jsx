import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarDays, CheckCheck, FileText, Headphones, Music, Radio, RefreshCw, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { openInSection } from '@/lib/openInSection';

const TYPE_META = {
  podcast: { icon: Headphones, color: 'rgba(255,255,255,0.80)' },
  event:   { icon: CalendarDays, color: '#FBBF24' },
  blog:    { icon: FileText, color: '#A78BFA' },
  music:   { icon: Music, color: '#5DE0A3' },
  ticket:  { icon: CheckCheck, color: '#20C7E8' },
  radio:   { icon: Radio, color: '#FF8A1F' },
  system:  { icon: Bell, color: '#FF8A1F' },
};

const SECTION_ITEM_TYPE = {
  events: 'event',
  podcasts: 'podcast',
  music: 'album',
};

function timeAgo(iso) {
  const timestamp = new Date(iso).getTime();
  const futureDiff = timestamp - Date.now();
  if (futureDiff > 0) {
    const minutesUntil = Math.ceil(futureDiff / 60000);
    if (minutesUntil < 60) return `En ${minutesUntil} min`;
    const hoursUntil = Math.ceil(minutesUntil / 60);
    if (hoursUntil < 24) return `En ${hoursUntil}h`;
    const daysUntil = Math.ceil(hoursUntil / 24);
    return daysUntil === 1 ? 'Mañana' : `En ${daysUntil}d`;
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Hace ${minutes || 1} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days}d`;
}

function NotificationsPanel({ open, onClose, setCurrentSection, mobile }) {
  const {
    notifications, loading, error, unreadCount, isRead, markRead, markAllRead, refetch,
  } = useNotifications();

  const handleClick = async (notification) => {
    await markRead(notification.id);
    if (notification.section && notification.actionId && SECTION_ITEM_TYPE[notification.section]) {
      openInSection(
        setCurrentSection,
        notification.section,
        SECTION_ITEM_TYPE[notification.section],
        notification.actionId,
      );
    } else if (notification.section) {
      setCurrentSection?.(notification.section);
    } else if (notification.actionUrl) {
      try {
        const target = new URL(notification.actionUrl, window.location.origin);
        const section = target.searchParams.get('section');
        if (section) setCurrentSection?.(section);
      } catch (_) {
        // La notificación sigue siendo legible aunque su destino sea legado.
      }
    }
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar notificaciones"
            className="fixed inset-0 z-[58] cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(5px)' }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Centro de notificaciones"
            className={mobile
              ? 'fixed left-3 right-3 z-[60] rounded-2xl overflow-hidden flex flex-col'
              : 'fixed top-20 right-4 z-[60] w-80 rounded-2xl overflow-hidden flex flex-col'}
            initial={{ opacity: 0, y: mobile ? -8 : -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            style={{
              ...(mobile ? {
                top: 'calc(72px + env(safe-area-inset-top, 0px))',
                maxHeight: 'calc(100dvh - 150px - env(safe-area-inset-bottom, 0px))',
              } : { maxHeight: 'min(72vh, 560px)' }),
              background: 'rgba(8,12,11,0.985)',
              border: '1px solid rgba(255,255,255,0.11)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.68)',
            }}
          >
            <header className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Notificaciones</h2>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,112,67,0.2)', color: '#FF8A1F' }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <button type="button" onClick={onClose} aria-label="Cerrar"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto py-1 overscroll-contain">
              {loading && (
                <div className="py-10 text-center" role="status">
                  <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin mx-auto" />
                  <p className="text-[11px] text-white/30 mt-2">Actualizando actividad…</p>
                </div>
              )}
              {!loading && error && notifications.length === 0 && (
                <div className="py-9 px-6 text-center">
                  <Bell className="w-5 h-5 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/40">No pudimos cargar las notificaciones.</p>
                  <button type="button" onClick={() => refetch()}
                    className="inline-flex items-center gap-1.5 text-xs font-bold mt-3 px-3 py-2 rounded-lg text-white/70"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <RefreshCw className="w-3 h-3" /> Reintentar
                  </button>
                </div>
              )}
              {!loading && !error && notifications.length === 0 && (
                <div className="py-10 text-center">
                  <Bell className="w-5 h-5 text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/30">Sin actividad reciente</p>
                </div>
              )}
              {!loading && notifications.map((notification, index) => {
                const meta = TYPE_META[notification.type] || TYPE_META.system;
                const Icon = meta.icon;
                const read = isRead(notification.id);
                return (
                  <motion.button
                    key={notification.id}
                    type="button"
                    className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors"
                    style={{ background: read ? 'transparent' : 'rgba(255,255,255,0.025)' }}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.025, 0.2) }}
                    onClick={() => handleClick(notification)}
                  >
                    <div className="relative shrink-0 mt-0.5">
                      {notification.image ? (
                        <div className="w-9 h-9 rounded-lg overflow-hidden">
                          <img src={notification.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}28` }}>
                          <Icon className="w-4 h-4" style={{ color: meta.color }} />
                        </div>
                      )}
                      {!read && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                          style={{ background: '#FF8A1F', boxShadow: '0 0 5px rgba(255,138,31,0.65)' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-tight"
                        style={{ color: read ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.92)' }}>
                        {notification.title}
                      </p>
                      <p className="text-[11px] leading-snug mt-1 line-clamp-2"
                        style={{ color: 'rgba(255,255,255,0.38)' }}>
                        {notification.body}
                      </p>
                      <span className="block text-[9px] mt-1.5 text-white/25">{timeAgo(notification.time)}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {notifications.length > 0 && (
              <footer className="px-4 py-3 shrink-0 text-center"
                style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <button type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: unreadCount > 0 ? '#FF8A1F' : 'rgba(255,255,255,0.30)' }}
                  onClick={() => markAllRead(notifications.map((notification) => notification.id))}>
                  <CheckCheck className="w-3.5 h-3.5" />
                  {unreadCount > 0 ? 'Marcar todo como leído' : 'Sin novedades pendientes'}
                </button>
              </footer>
            )}
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default function NotificationsBell({ setCurrentSection, mobile = false }) {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        className={mobile
          ? 'relative w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-colors'
          : 'relative p-2 rounded-lg shrink-0 transition-colors'}
        style={{
          color: open ? '#FF8A1F' : 'rgba(255,255,255,0.48)',
          background: open ? 'rgba(255,112,67,0.10)' : 'rgba(255,255,255,0.045)',
          border: mobile ? '1px solid rgba(255,255,255,0.075)' : 'none',
        }}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center text-white"
            style={{ background: '#FF8A1F', boxShadow: '0 0 7px rgba(255,138,31,0.55)' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationsPanel
        open={open}
        onClose={() => setOpen(false)}
        setCurrentSection={setCurrentSection}
        mobile={mobile}
      />
    </>
  );
}
