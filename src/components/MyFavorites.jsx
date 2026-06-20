import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Heart, Headphones, Disc3, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSkeleton, EmptyState, LoginRequired } from '@/components/SectionStates';

const FALLBACK = 'https://images.unsplash.com/photo-1459749411177-0473ef716175?q=80&w=400&auto=format&fit=crop';

const TABS = [
  { id: 'event',   label: 'Eventos',  icon: Calendar  },
  { id: 'podcast', label: 'Podcasts', icon: Headphones },
  { id: 'artist',  label: 'Artistas', icon: Disc3      },
];

function FavCard({ item, type, onRemove }) {
  const image = item.image_url || item.cover_url || FALLBACK;
  const title = item.title || item.name;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="rounded-xl overflow-hidden flex flex-col group relative"
      style={{ background: 'rgba(11, 16, 15, 0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="relative aspect-video overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button type="button" onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(239,68,68,0.8)' }}>
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-white leading-tight truncate">{title}</p>
        {type === 'podcast' && item.artists?.name && (
          <p className="text-[11px] text-white/40 mt-0.5 truncate">{item.artists.name}</p>
        )}
        {type === 'event' && item.date && (
          <p className="text-[11px] text-white/40 mt-0.5">
            {new Date(item.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </p>
        )}
        {type === 'artist' && item.type && (
          <p className="text-[11px] text-white/40 mt-0.5">{item.type}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function MyFavorites() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('event');
  const { favorites, toggle, loading: favsLoading } = useFavorites();

  const favIds = favorites.filter(f => f.item_type === activeTab).map(f => f.item_id);

  const tableMap = { event: 'events', podcast: 'podcasts', artist: 'artists' };
  const selectMap = { event: '*', podcast: '*, artists(name)', artist: '*' };

  const { data: items, loading } = useSupabaseQuery(
    () => favIds.length > 0
      ? supabase.from(tableMap[activeTab]).select(selectMap[activeTab]).in('id', favIds)
      : Promise.resolve({ data: [], error: null }),
    [activeTab, favIds.join(',')]
  );

  if (!currentUser) return <LoginRequired message="Inicia sesión para ver tus favoritos." />;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
            style={{
              background: activeTab === id ? '#20C7E8' : 'rgba(255,255,255,0.05)',
              color: activeTab === id ? '#080B14' : 'rgba(255,255,255,0.5)',
              border: activeTab === id ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}>
            <Icon className="w-3 h-3" />
            {label}
            {favorites.filter(f => f.item_type === id).length > 0 && (
              <span className="text-[10px] font-black px-1.5 rounded-full"
                style={{ background: activeTab === id ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }}>
                {favorites.filter(f => f.item_type === id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {(loading || favsLoading) && <LoadingSkeleton rows={2} />}

      {!loading && favIds.length === 0 && (
        <EmptyState
          label={`No tienes ${activeTab === 'event' ? 'eventos' : activeTab === 'podcast' ? 'podcasts' : 'artistas'} en favoritos`}
          icon={Heart}
        />
      )}

      {!loading && items && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(item => (
            <FavCard
              key={item.id}
              item={item}
              type={activeTab}
              onRemove={() => toggle(activeTab, item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
