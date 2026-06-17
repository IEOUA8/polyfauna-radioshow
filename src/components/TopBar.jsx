import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Calendar, ChevronDown, Disc3, FileText, Headphones, LogOut, Menu, Search, Settings, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/customSupabaseClient';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_LABEL = { citizen: 'Wave Citizen', artist: 'Artista', promoter: 'Promotor', club: 'Club', admin: 'Admin' };

const TYPE_META = {
  events:       { label: 'Evento',   icon: Calendar,  section: 'events',   imgKey: 'image_url',         nameKey: 'title'  },
  podcasts:     { label: 'Podcast',  icon: Headphones, section: 'podcasts', imgKey: 'cover_url',         nameKey: 'title'  },
  artists:      { label: 'Artista',  icon: Disc3,      section: 'artists',  imgKey: 'image_url',         nameKey: 'name'   },
  blog_articles:{ label: 'Blog',     icon: FileText,   section: 'blog',     imgKey: 'featured_image_url', nameKey: 'title' },
};

const FALLBACK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=80&auto=format&fit=crop';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function TopBar({ setCurrentSection, setMobileMenuOpen }) {
  const { currentUser, userRole, logout } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
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
    <header
      className="h-16 flex items-center gap-3 px-4 md:px-5 shrink-0 sticky top-0 z-30 border-b"
      style={{ background: 'rgba(10, 13, 26, 0.95)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.07)' }}
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
            onFocus={() => setShowResults(true)}
            className="w-full h-10 pl-10 pr-10 rounded-xl text-sm text-white/80 placeholder:text-white/30 focus:outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            onFocus={(e) => {
              setShowResults(true);
              e.currentTarget.style.borderColor = 'rgba(0,207,255,0.4)';
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,207,255,0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); }}
              className="absolute right-3 text-white/30 hover:text-white/60 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results dropdown */}
        <AnimatePresence>
          {showResults && (query.length >= 2) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 shadow-2xl"
              style={{ background: 'rgba(12, 15, 28, 0.98)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              {searching && (
                <div className="p-3 text-center text-xs text-white/30">Buscando...</div>
              )}
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
                        <span className="flex items-center gap-1 text-[10px] font-bold shrink-0"
                          style={{ color: '#00CFFF' }}>
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

      <div className="flex-1" />

      {/* Live indicator */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-sm font-medium text-white/80">Live</span>
      </div>

      {/* Notification bell */}
      <button type="button" className="relative p-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">
        <Bell className="w-5 h-5" />
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
          style={{ background: '#00CFFF' }}>2</span>
      </button>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl transition-colors hover:bg-white/5">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0"
              style={{ background: 'linear-gradient(135deg, #00CFFF 0%, #7B5CF0 100%)' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                : <User className="w-4 h-4 text-white m-auto mt-1.5" />
              }
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
              <p className="text-xs leading-tight" style={{ color: '#00CFFF' }}>{displayRole}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-white/40 hidden md:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px] border"
          style={{ background: 'rgba(15, 19, 34, 0.98)', borderColor: 'rgba(255,255,255,0.1)' }}>
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
    </header>
  );
}
