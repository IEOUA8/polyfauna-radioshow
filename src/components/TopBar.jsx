import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Disc3, FileText, Headphones, Menu, Radio, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { supabase } from '@/lib/customSupabaseClient';

const TYPE_META = {
  events:        { label: 'Evento',   icon: Calendar,   section: 'events',   imgKey: 'image_url',          nameKey: 'title' },
  podcasts:      { label: 'Podcast',  icon: Headphones,  section: 'podcasts', imgKey: 'cover_url',          nameKey: 'title' },
  artists:       { label: 'Artista',  icon: Disc3,       section: 'artists',  imgKey: 'image_url',          nameKey: 'name'  },
  blog_articles: { label: 'Blog',     icon: FileText,    section: 'blog',     imgKey: 'featured_image_url', nameKey: 'title' },
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
  const { isOnline, isLive, streamerName } = useNowPlaying();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

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
                e.currentTarget.style.borderColor = 'rgba(32,199,232,0.4)';
                e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.1)';
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
                style={{ background: 'rgba(8, 12, 11, 0.98)', border: '1px solid rgba(255,255,255,0.09)' }}
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
                          <span className="flex items-center gap-1 text-[10px] font-bold shrink-0" style={{ color: 'rgba(255,255,255,0.9)' }}>
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
            style={{ background: isOnline ? '#FF8A1F' : 'rgba(255,255,255,0.3)' }}
          />
          <span className="text-sm font-semibold" style={{ color: isOnline ? '#FF8A1F' : 'rgba(255,255,255,0.4)' }}>
            {isOnline ? (isLive ? `En vivo — ${streamerName || 'DJ'}` : 'Live') : 'Offline'}
          </span>
        </div>

      </motion.header>
    </>
  );
}
