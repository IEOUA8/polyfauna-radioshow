import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Calendar, ChevronDown, Disc3, FileText, Headphones, LogOut, Menu, Radio, Search, Settings, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { supabase } from '@/lib/customSupabaseClient';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_LABEL = { citizen: 'Wave Citizen', artist: 'Artista', promoter: 'Promotor', club: 'Club', admin: 'Admin' };

const TYPE_META = {
  events:        { label: 'Evento',   icon: Calendar,   section: 'events',   imgKey: 'image_url',          nameKey: 'title' },
  podcasts:      { label: 'Podcast',  icon: Headphones,  section: 'podcasts', imgKey: 'cover_url',          nameKey: 'title' },
  artists:       { label: 'Artista',  icon: Disc3,       section: 'artists',  imgKey: 'image_url',          nameKey: 'name'  },
  blog_articles: { label: 'Blog',     icon: FileText,    section: 'blog',     imgKey: 'featured_image_url', nameKey: 'title' },
};

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=80&auto=format&fit=crop';

const DEMO_NOTIFS = [
  { id: 1, icon: Radio,     color: '#FF7043', title: 'Polyfauna Radio en vivo',       body: 'Underground Frequencies con Nox Vega.',   time: 'Hace 5 min' },
  { id: 2, icon: Headphones, color: '#00CFFF', title: 'Nuevo podcast disponible',       body: 'Frecuencias Oscuras #12 — HVBER.',         time: 'Hace 1h'    },
  { id: 3, icon: Calendar,   color: '#FBBF24', title: 'Evento próximo: Subterranea',    body: 'Este lunes — Teatro Metropol.',            time: 'Hace 3h'    },
  { id: 4, icon: FileText,   color: '#A78BFA', title: 'Nuevo artículo en el blog',      body: 'El sonido del techno industrial colombiano.', time: 'Ayer'    },
];

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function NotificationsModal({ open, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          />
          {/* Panel */}
          <motion.div
            ref={ref}
            className="fixed top-20 right-4 z-50 w-80 rounded-2xl overflow-hidden shadow-2xl"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            style={{
              background: 'rgba(10, 13, 24, 0.97)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Notificaciones</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,112,67,0.2)', color: '#FF7043' }}>
                  {DEMO_NOTIFS.length}
                </span>
              </div>
              <button type="button" onClick={onClose}
                className="p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto py-1">
              {DEMO_NOTIFS.map((n, i) => {
                const Icon = n.icon;
                return (
                  <motion.button
                    key={n.id}
                    type="button"
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/4"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={onClose}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${n.color}18`, border: `1px solid ${n.color}30` }}>
                      <Icon className="w-4 h-4" style={{ color: n.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white leading-tight">{n.title}</p>
                      <p className="text-[11px] text-white/45 leading-snug mt-0.5">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-white/30 shrink-0 mt-0.5">{n.time}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <button type="button" className="text-xs font-semibold transition-colors hover:opacity-80"
                style={{ color: '#FF7043' }} onClick={onClose}>
                Marcar todo como leído
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function TopBar({ setCurrentSection, setMobileMenuOpen }) {
  const { currentUser, userRole, logout } = useAuth();
  const { profile } = useProfile();
  const { isOnline, isLive, streamerName } = useNowPlaying();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  const displayName = profile?.display_name || currentUser?.email?.split('@')[0] || 'Wave Citizen';
  const displayRole = profile ? (ROLE_LABEL[profile.role] || 'Wave Citizen') : (currentUser ? 'Wave Citizen' : 'Invitado');

  const runSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const [evRes, podRes, artRes, blogRes] = await Promise.all([
        supabase.from('events').select('id, title, image_url').ilike('title', `%${q}%`).limit(3),
        supabase.from('podcasts').select('id, title, cover_url').ilike('title', `%${q}%`).limit(3),
        supabase.from('artists').select('id, name, image_url').ilike('name', `%${q}%`).limit(3),
        supabase.from('blog_articles').select('id, title, featured_image_url').ilike('title', `%${q}%`).limit(2),
      ]);
      const merged = [
        ...(evRes.data || []).map(r => ({ ...r, _type: 'events' })),
        ...(podRes.data || []).map(r => ({ ...r, _type: 'podcasts' })),
        ...(artRes.data || []).map(r => ({ ...r, _type: 'artists' })),
        ...(blogRes.data || []).map(r => ({ ...r, _type: 'blog_articles' })),
      ];
      setResults(merged);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => { runSearch(debouncedQuery); }, [debouncedQuery, runSearch]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (item) => {
    const meta = TYPE_META[item._type];
    setCurrentSection?.(meta.section);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <NotificationsModal open={notifOpen} onClose={() => setNotifOpen(false)} />

      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="h-16 flex items-center gap-3 px-4 md:px-5 shrink-0 sticky top-0 z-30"
        style={{
          background: 'rgba(8, 10, 22, 0.80)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderBottom: '1px solid transparent',
          backgroundClip: 'padding-box',
          boxShadow: '0 1px 0 0 rgba(0,207,255,0.12), 0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen?.(true)}
          className="lg:hidden p-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-lg relative" ref={searchRef}>
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar eventos, podcasts, artistas..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
              onFocus={(e) => {
                setShowResults(true);
                e.currentTarget.style.borderColor = 'rgba(0,207,255,0.4)';
                e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,207,255,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              className="w-full h-10 pl-10 pr-10 rounded-xl text-sm text-white/80 placeholder:text-white/30 focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); setResults([]); }}
                className="absolute right-3 text-white/30 hover:text-white/60 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showResults && query.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 shadow-2xl"
                style={{ background: 'rgba(12, 15, 28, 0.98)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                {searching && <div className="p-3 text-center text-xs text-white/30">Buscando...</div>}
                {!searching && results.length === 0 && (
                  <div className="p-4 text-center text-sm text-white/30">Sin resultados para "{query}"</div>
                )}
                {!searching && results.length > 0 && (
                  <div className="py-1 max-h-80 overflow-y-auto">
                    {results.map((item) => {
                      const meta = TYPE_META[item._type];
                      const Icon = meta.icon;
                      const name = item[meta.nameKey];
                      const img = item[meta.imgKey];
                      return (
                        <button
                          key={`${item._type}-${item.id}`}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                            <img src={img || FALLBACK} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{name}</p>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold shrink-0" style={{ color: '#00CFFF' }}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Live indicator — orange when on air */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{
            background: isOnline ? 'rgba(255,112,67,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isOnline ? 'rgba(255,112,67,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <motion.span
            animate={isOnline ? { opacity: [1, 0.3, 1] } : { opacity: 0.4 }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: isOnline ? '#FF7043' : 'rgba(255,255,255,0.3)' }}
          />
          <span className="text-sm font-semibold" style={{ color: isOnline ? '#FF7043' : 'rgba(255,255,255,0.4)' }}>
            {isOnline ? (isLive ? `En vivo — ${streamerName || 'DJ'}` : 'Live') : 'Offline'}
          </span>
        </div>

        {/* Right group: notifications + user */}
        <div className="flex items-center gap-1.5 ml-2">
          {/* Notification bell */}
          <button
            type="button"
            onClick={() => setNotifOpen(v => !v)}
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: notifOpen ? '#FF7043' : 'rgba(255,255,255,0.5)' }}
            onMouseEnter={e => { if (!notifOpen) e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Bell className="w-5 h-5" />
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
              style={{ background: '#FF7043' }}
            >
              {DEMO_NOTIFS.length}
            </span>
          </button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 rounded-xl transition-colors hover:bg-white/5">
                <div
                  className="w-8 h-8 rounded-full overflow-hidden shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF7043 0%, #7B5CF0 100%)' }}
                >
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                    : <User className="w-4 h-4 text-white m-auto mt-1.5" />
                  }
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
                  <p className="text-xs leading-tight" style={{ color: '#FF7043' }}>{displayRole}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/40 hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[180px] border"
              style={{ background: 'rgba(15, 19, 34, 0.98)', borderColor: 'rgba(255,255,255,0.1)' }}
            >
              {currentUser ? (
                <>
                  <DropdownMenuItem onClick={() => setCurrentSection?.('mi-panel')}
                    className="cursor-pointer text-white/80 hover:text-white hover:bg-white/8 focus:bg-white/8">
                    <User className="w-4 h-4 mr-2 text-white/50" />Mi Panel
                  </DropdownMenuItem>
                  {(profile?.role === 'promoter' || profile?.role === 'club' || userRole === 'admin') && (
                    <DropdownMenuItem onClick={() => setCurrentSection?.('promoter')}
                      className="cursor-pointer text-white/80 hover:text-white hover:bg-white/8 focus:bg-white/8">
                      <Settings className="w-4 h-4 mr-2 text-white/50" />Promoter Hub
                    </DropdownMenuItem>
                  )}
                  {userRole === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}
                      className="cursor-pointer text-white/80 hover:text-white hover:bg-white/8 focus:bg-white/8">
                      <Settings className="w-4 h-4 mr-2 text-white/50" />Admin Panel
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}
                    className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-white/8 focus:bg-white/8">
                    <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => navigate('/login')}
                    className="cursor-pointer text-white/80 hover:text-white hover:bg-white/8 focus:bg-white/8">
                    Login
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/signup')}
                    className="cursor-pointer text-white/80 hover:text-white hover:bg-white/8 focus:bg-white/8">
                    Registrarse
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.header>
    </>
  );
}
