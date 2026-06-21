import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Clock, Disc3, FileText, Headphones, Menu, Music, Radio, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { supabase } from '@/lib/customSupabaseClient';

const TYPE_META = {
  events:        { label: 'Evento',   icon: Calendar,   section: 'events',   imgKey: 'image_url',          nameKey: 'title' },
  podcasts:      { label: 'Podcast',  icon: Headphones,  section: 'podcasts', imgKey: 'cover_url',          nameKey: 'title' },
  artists:       { label: 'Artista',  icon: Disc3,       section: 'artists',  imgKey: 'image_url',          nameKey: 'name'  },
  albums:        { label: 'Álbum',    icon: Music,       section: 'music',    imgKey: 'cover_url',          nameKey: 'title' },
  blog_articles: { label: 'Blog',     icon: FileText,    section: 'blog',     imgKey: 'featured_image_url', nameKey: 'title' },
};

const FALLBACK  = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=80&auto=format&fit=crop';
const RECENT_KEY = 'pf_recent_searches_v1';
const MAX_RECENT = 5;

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function saveSearch(term) {
  if (!term || term.length < 2) return;
  const existing = getRecentSearches().filter(s => s !== term);
  localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...existing].slice(0, MAX_RECENT)));
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function TopBar({ setCurrentSection, setMobileMenuOpen }) {
  const { isOnline, isLive, streamerName } = useNowPlaying();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(getRecentSearches);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(query, 280);

  const runSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    setFocusedIndex(-1);
    try {
      const [evRes, podRes, artRes, albRes, blogRes] = await Promise.all([
        supabase.from('events').select('id, title, image_url').ilike('title', `%${q}%`).limit(3),
        supabase.from('podcasts').select('id, title, cover_url').ilike('title', `%${q}%`).limit(3),
        supabase.from('artists').select('id, name, image_url').ilike('name', `%${q}%`).limit(3),
        supabase.from('albums').select('id, title, cover_url').ilike('title', `%${q}%`).limit(2),
        supabase.from('blog_articles').select('id, title, featured_image_url').ilike('title', `%${q}%`).limit(2),
      ]);
      const merged = [
        ...(evRes.data  || []).map(r => ({ ...r, _type: 'events'        })),
        ...(podRes.data || []).map(r => ({ ...r, _type: 'podcasts'      })),
        ...(artRes.data || []).map(r => ({ ...r, _type: 'artists'       })),
        ...(albRes.data || []).map(r => ({ ...r, _type: 'albums'        })),
        ...(blogRes.data|| []).map(r => ({ ...r, _type: 'blog_articles' })),
      ];
      setResults(merged);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => { runSearch(debouncedQuery); }, [debouncedQuery, runSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (item) => {
    const meta = TYPE_META[item._type];
    setCurrentSection?.(meta.section);
    saveSearch(item[meta.nameKey]);
    setRecentSearches(getRecentSearches());
    setQuery('');
    setResults([]);
    setShowResults(false);
    setFocusedIndex(-1);
    inputRef.current?.blur();
    // Abrir el ítem específico después de que la sección monte
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pf:open-item', { detail: { type: item._type, id: item.id } }));
    }, 120);
  };

  const handleRecentSelect = (term) => {
    setQuery(term);
    setShowResults(true);
    inputRef.current?.focus();
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecentSearches([]);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showResults) return;

    const total = query.length >= 2 ? results.length : 0;
    if (total === 0) {
      if (e.key === 'Escape') { setShowResults(false); setFocusedIndex(-1); inputRef.current?.blur(); }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => (i <= 0 ? total - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && results[focusedIndex]) {
        handleSelect(results[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
      setFocusedIndex(-1);
      inputRef.current?.blur();
    }
  };

  const showDropdown = showResults && (query.length >= 2 || (query.length === 0 && recentSearches.length > 0));

  return (
    <>
      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="h-16 flex items-center gap-3 px-4 md:px-5 shrink-0 sticky top-0 z-30"
        style={{
          background: 'rgba(8, 12, 11, 0.80)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          borderBottom: '1px solid transparent',
          backgroundClip: 'padding-box',
          boxShadow: '0 1px 0 0 rgba(184,207,166,0.10), 0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen?.(true)}
          className="lg:hidden p-2 rounded-lg transition-colors shrink-0"
          style={{ color: 'rgba(255,255,255,0.50)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.80)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.50)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-lg relative" ref={searchRef}>
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.28)' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar eventos, podcasts, artistas..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowResults(true); setFocusedIndex(-1); }}
              onFocus={() => setShowResults(true)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 pl-10 pr-10 rounded-xl text-sm placeholder:text-white/30 focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.80)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'; }}
              onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />
            {query && (
              <button type="button"
                onClick={() => { setQuery(''); setResults([]); setFocusedIndex(-1); inputRef.current?.focus(); }}
                className="absolute right-3 transition-colors"
                style={{ color: 'rgba(255,255,255,0.30)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.30)'; }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 shadow-2xl"
                style={{ background: 'rgba(7,11,10,0.99)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}
              >
                {/* Recent searches (shown when query is empty) */}
                {query.length < 2 && recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-3 pt-3 pb-1">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.30)' }}>
                        <Clock className="w-3 h-3" />
                        Búsquedas recientes
                      </span>
                      <button type="button" onClick={clearRecent}
                        className="text-[10px] transition-colors"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}>
                        Borrar
                      </button>
                    </div>
                    {recentSearches.map((term) => (
                      <button key={term} type="button"
                        onClick={() => handleRecentSelect(term)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                        style={{ color: 'rgba(255,255,255,0.55)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.80)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}>
                        <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.20)' }} />
                        <span className="text-sm">{term}</span>
                      </button>
                    ))}
                    <div className="mx-3 my-1" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                )}

                {/* Search results */}
                {query.length >= 2 && searching && (
                  <div className="p-4 text-center">
                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin mx-auto" />
                  </div>
                )}
                {query.length >= 2 && !searching && results.length === 0 && (
                  <div className="px-4 py-5 text-center">
                    <Search className="w-5 h-5 text-white/15 mx-auto mb-2" />
                    <p className="text-sm text-white/30">Sin resultados para <span className="text-white/50">"{query}"</span></p>
                  </div>
                )}
                {query.length >= 2 && !searching && results.length > 0 && (
                  <div className="py-1 max-h-80 overflow-y-auto">
                    {results.map((item, idx) => {
                      const meta = TYPE_META[item._type];
                      const Icon = meta.icon;
                      const name = item[meta.nameKey];
                      const img  = item[meta.imgKey];
                      const isFocused = focusedIndex === idx;
                      return (
                        <button
                          key={`${item._type}-${item.id}`}
                          type="button"
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                          style={{ background: isFocused ? 'rgba(255,255,255,0.07)' : 'transparent' }}
                          onMouseEnter={e => { if (!isFocused) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; setFocusedIndex(idx); }}
                          onMouseLeave={e => { if (!isFocused) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                            <img src={img || FALLBACK} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: isFocused ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.80)' }}>{name}</p>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-bold shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Keyboard hint */}
                {query.length >= 2 && results.length > 1 && (
                  <div className="px-3 py-2 border-t flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <span className="text-[10px] text-white/20">↑↓ navegar</span>
                    <span className="text-[10px] text-white/20">↵ abrir</span>
                    <span className="text-[10px] text-white/20">Esc cerrar</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live indicator */}
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: isOnline ? 'rgba(255,112,67,0.10)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isOnline ? 'rgba(255,112,67,0.28)' : 'rgba(255,255,255,0.07)'}`,
          }}
        >
          <motion.span
            animate={isOnline ? { opacity: [1, 0.3, 1] } : { opacity: 0.35 }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: isOnline ? '#FF8A1F' : 'rgba(255,255,255,0.25)' }}
          />
          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: isOnline ? '#FF8A1F' : 'rgba(255,255,255,0.35)' }}>
            {isOnline ? (isLive ? `En vivo — ${streamerName || 'DJ'}` : 'Live') : 'Offline'}
          </span>
        </div>
      </motion.header>
    </>
  );
}
