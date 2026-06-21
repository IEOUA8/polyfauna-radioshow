import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Disc3, Headphones, Heart, Music, Music2, Trash2 } from 'lucide-react';
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
  { id: 'album',   label: 'Álbumes',  icon: Music      },
  { id: 'track',   label: 'Tracks',   icon: Music2     },
];

const TABLE_MAP = {
  event:   'events',
  podcast: 'podcasts',
  artist:  'artists',
  album:   'albums',
  track:   'tracks',
};

const SELECT_MAP = {
  event:   '*',
  podcast: '*, artists(name)',
  artist:  '*',
  album:   '*',
  track:   '*, albums(cover_url, title)',
};

function getImage(item, type) {
  if (type === 'track') return item.albums?.cover_url || FALLBACK;
  return item.image_url || item.cover_url || FALLBACK;
}

function getTitle(item, type) {
  return item.title || item.name || '—';
}

function getSubtitle(item, type) {
  if (type === 'podcast') return item.artists?.name;
  if (type === 'event')   return item.date ? new Date(item.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : null;
  if (type === 'artist')  return item.type;
  if (type === 'album')   return item.genre || null;
  if (type === 'track')   return item.albums?.title || null;
  return null;
}

function FavCard({ item, type, onRemove }) {
  const image    = getImage(item, type);
  const title    = getTitle(item, type);
  const subtitle = getSubtitle(item, type);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="rounded-xl overflow-hidden flex flex-col group relative"
      style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(239,68,68,0.80)' }}
        >
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-white leading-tight truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-white/40 mt-0.5 truncate">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

export default function MyFavorites() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('event');
  const { favorites, toggle, loading: favsLoading } = useFavorites();

  const favIds = favorites.filter(f => f.item_type === activeTab).map(f => f.item_id);

  const { data: items, loading } = useSupabaseQuery(
    () => favIds.length > 0
      ? supabase.from(TABLE_MAP[activeTab]).select(SELECT_MAP[activeTab]).in('id', favIds)
      : Promise.resolve({ data: [], error: null }),
    [activeTab, favIds.join(',')]
  );

  if (!currentUser) return <LoginRequired message="Inicia sesión para ver tus favoritos." />;

  const emptyLabels = {
    event:   'eventos',
    podcast: 'podcasts',
    artist:  'artistas',
    album:   'álbumes',
    track:   'tracks',
  };

  return (
    <div className="space-y-4">
      {/* Tabs — horizontal scroll on small screens */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = favorites.filter(f => f.item_type === id).length;
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all shrink-0"
              style={{
                background: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.05)',
                color:      active ? '#080B14' : 'rgba(255,255,255,0.5)',
                border:     active ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Icon className="w-3 h-3" />
              {label}
              {count > 0 && (
                <span
                  className="text-[10px] font-black px-1.5 rounded-full"
                  style={{ background: active ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(loading || favsLoading) && <LoadingSkeleton rows={2} />}

      {!loading && !favsLoading && favIds.length === 0 && (
        <EmptyState
          label={`No tienes ${emptyLabels[activeTab]} en favoritos`}
          subtitle="Guarda tus favoritos tocando el ícono de corazón en cualquier contenido."
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
