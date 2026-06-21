import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronDown, ChevronUp, Globe, ListMusic, Loader2, Lock, Plus, Search, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState, LoadingSkeleton, LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

const FALLBACK = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=200&auto=format&fit=crop';

// ── CreatePlaylistModal ───────────────────────────────────────────────────────

function CreatePlaylistModal({ onClose, onCreated }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving]   = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('playlists')
      .insert({ user_id: currentUser.id, name: name.trim(), description: desc.trim(), is_public: isPublic })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Playlist creada', description: `"${data.name}" lista.` });
      onCreated(data);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'rgba(11,16,15,0.97)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Nueva Playlist</h3>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nombre de la playlist"
          autoFocus
          className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
          onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.5)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Descripción (opcional)"
          rows={2}
          className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
          onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.5)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
        <button type="button" onClick={() => setIsPublic(p => !p)}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg w-full transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', color: isPublic ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>
          {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {isPublic ? 'Pública — visible para todos' : 'Privada — solo tú'}
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className="w-full py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saving ? 'Creando…' : 'Crear playlist'}
        </button>
      </motion.div>
    </div>
  );
}

// ── AddPodcastModal ───────────────────────────────────────────────────────────

function AddPodcastModal({ playlistId, existingIds, onClose, onAdded }) {
  const { toast } = useToast();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding]   = useState(null);
  const debounceRef           = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('podcasts')
        .select('id, title, cover_url, artists(name)')
        .ilike('title', `%${query}%`)
        .limit(12);
      setResults(data || []);
      setLoading(false);
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleAdd = async (podcast) => {
    if (existingIds.includes(podcast.id)) return;
    setAdding(podcast.id);
    const { error } = await supabase
      .from('playlist_tracks')
      .insert({ playlist_id: playlistId, podcast_id: podcast.id, position: existingIds.length });
    if (error) {
      toast({ title: 'Error al agregar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Agregado', description: podcast.title });
      onAdded(podcast.id);
    }
    setAdding(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full sm:max-w-md flex flex-col"
        style={{
          background: 'rgba(7,12,11,0.97)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '85dvh',
        }}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-sm font-black text-white">Agregar podcast</span>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.28)' }} />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar podcast por título…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/25"
            />
            {loading && <div className="w-3.5 h-3.5 rounded-full border-2 border-white/15 border-t-white/55 animate-spin shrink-0" />}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-1">
          {!query.trim() && (
            <p className="text-xs text-center py-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Escribe el título del podcast que quieres agregar
            </p>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Sin resultados para "{query}"
            </p>
          )}
          {results.map(pod => {
            const isIn   = existingIds.includes(pod.id);
            const isAdding = adding === pod.id;
            return (
              <button
                key={pod.id}
                type="button"
                onClick={() => !isIn && handleAdd(pod)}
                disabled={isIn || isAdding}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors disabled:cursor-default"
                style={{
                  background: isIn ? 'rgba(255,255,255,0.03)' : 'rgba(11,16,15,0.90)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  opacity: isIn ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!isIn) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
              >
                <img
                  src={pod.cover_url || FALLBACK}
                  alt={pod.title}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{pod.title}</p>
                  {pod.artists?.name && (
                    <p className="text-xs text-white/40 truncate">{pod.artists.name}</p>
                  )}
                </div>
                {isIn && (
                  <span className="text-[10px] font-bold shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>En playlist</span>
                )}
                {isAdding && (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }} />
                )}
                {!isIn && !isAdding && (
                  <Plus className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

// ── PlaylistDetail ────────────────────────────────────────────────────────────

function PlaylistDetail({ playlist, onBack }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd]       = useState(false);
  const [localAdded, setLocalAdded] = useState([]);
  const [removing, setRemoving]     = useState(null);
  const [reordering, setReordering] = useState(null);

  const { data: tracks, loading, refetch } = useSupabaseQuery(
    () => supabase
      .from('playlist_tracks')
      .select('id, podcast_id, position, podcasts(id, title, cover_url, artists(name))')
      .eq('playlist_id', playlist.id)
      .order('position', { ascending: true }),
    [playlist.id, localAdded.length]
  );

  const existingIds = (tracks || []).map(t => t.podcast_id).filter(Boolean);

  const handleRemove = async (trackRow) => {
    setRemoving(trackRow.id);
    await supabase.from('playlist_tracks').delete().eq('id', trackRow.id);
    toast({ title: 'Eliminado de la playlist' });
    refetch();
    setRemoving(null);
  };

  const handleReorder = async (row, direction) => {
    const list = tracks || [];
    const idx = list.findIndex(t => t.id === row.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const other = list[swapIdx];
    setReordering(row.id);
    const posA = row.position ?? idx;
    const posB = other.position ?? swapIdx;
    await Promise.all([
      supabase.from('playlist_tracks').update({ position: posB }).eq('id', row.id),
      supabase.from('playlist_tracks').update({ position: posA }).eq('id', other.id),
    ]);
    refetch();
    setReordering(null);
  };

  const handleAdded = (podcastId) => {
    setLocalAdded(prev => [...prev, podcastId]);
    refetch();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold transition-colors"
          style={{ color: 'rgba(255,255,255,0.40)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Playlists
        </button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">{playlist.name}</h2>
          {playlist.description && (
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{playlist.description}</p>
          )}
          <p className="text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {playlist.is_public ? 'Pública' : 'Privada'} · {(tracks || []).length} podcast{(tracks || []).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl shrink-0 transition-all hover:scale-105"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#080B14' }}
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* Track list */}
      {loading && <LoadingSkeleton rows={3} />}

      {!loading && (tracks || []).length === 0 && (
        <EmptyState
          icon={ListMusic}
          label="Playlist vacía"
          subtitle="Agrega podcasts usando el botón de arriba."
          action={() => setShowAdd(true)}
          actionLabel="Agregar podcast"
        />
      )}

      {!loading && (tracks || []).length > 0 && (
        <div className="space-y-2">
          {tracks.map((row, idx) => {
            const pod = row.podcasts;
            if (!pod) return null;
            const isFirst = idx === 0;
            const isLast  = idx === tracks.length - 1;
            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-2 p-3 rounded-xl group"
                style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    disabled={isFirst || reordering === row.id}
                    onClick={() => handleReorder(row, 'up')}
                    className="w-5 h-5 rounded flex items-center justify-center transition-colors disabled:opacity-20"
                    style={{ background: 'rgba(255,255,255,0.07)' }}
                  >
                    <ChevronUp className="w-3 h-3 text-white/60" />
                  </button>
                  <button
                    type="button"
                    disabled={isLast || reordering === row.id}
                    onClick={() => handleReorder(row, 'down')}
                    className="w-5 h-5 rounded flex items-center justify-center transition-colors disabled:opacity-20"
                    style={{ background: 'rgba(255,255,255,0.07)' }}
                  >
                    <ChevronDown className="w-3 h-3 text-white/60" />
                  </button>
                </div>

                <span className="text-[11px] font-black w-5 text-right shrink-0" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  {idx + 1}
                </span>
                <img
                  src={pod.cover_url || FALLBACK}
                  alt={pod.title}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{pod.title}</p>
                  {pod.artists?.name && (
                    <p className="text-xs text-white/40 truncate">{pod.artists.name}</p>
                  )}
                </div>
                {reordering === row.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(row)}
                  disabled={removing === row.id}
                  className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style={{ background: 'rgba(239,68,68,0.75)' }}
                >
                  {removing === row.id
                    ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                    : <Trash2 className="w-3 h-3 text-white" />
                  }
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add modal */}
      <AnimatePresence>
        {showAdd && (
          <AddPodcastModal
            playlistId={playlist.id}
            existingIds={existingIds}
            onClose={() => setShowAdd(false)}
            onAdded={handleAdded}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── PlaylistCard ──────────────────────────────────────────────────────────────

function PlaylistCard({ playlist, onOpen, onDelete }) {
  const { data: tracks } = useSupabaseQuery(
    () => supabase
      .from('playlist_tracks')
      .select('podcast_id, podcasts(cover_url)')
      .eq('playlist_id', playlist.id)
      .limit(4),
    [playlist.id]
  );

  const covers = (tracks || []).map(t => t.podcasts?.cover_url).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden flex flex-col group cursor-pointer"
      style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
      onClick={onOpen}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      {/* Cover grid */}
      <div className="relative aspect-square grid grid-cols-2 gap-0.5 overflow-hidden bg-black">
        {covers.length >= 4
          ? covers.slice(0, 4).map((c, i) => (
              <img key={i} src={c} alt="" className="w-full h-full object-cover" />
            ))
          : (
              <img
                src={covers[0] || FALLBACK}
                alt={playlist.name}
                className="col-span-2 row-span-2 w-full h-full object-cover"
              />
            )
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 left-2">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.7)' }}>
            {playlist.is_public ? 'Pública' : 'Privada'}
          </span>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(239,68,68,0.80)' }}
        >
          <Trash2 className="w-3 h-3 text-white" />
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-white truncate">{playlist.name}</p>
        <p className="text-[11px] text-white/40 mt-0.5">
          {(tracks || []).length} podcast{(tracks || []).length !== 1 ? 's' : ''} · Ver →
        </p>
      </div>
    </motion.div>
  );
}

// ── MyPlaylists ───────────────────────────────────────────────────────────────

export default function MyPlaylists() {
  const { currentUser } = useAuth();
  const { toast }       = useToast();
  const [showCreate, setShowCreate]       = useState(false);
  const [selectedPlaylist, setSelected]   = useState(null);

  const { data: playlists, loading, refetch } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('playlists').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) return <LoginRequired message="Inicia sesión para ver tus playlists." />;

  const handleDelete = async (id, name) => {
    await supabase.from('playlists').delete().eq('id', id);
    toast({ title: `"${name}" eliminada` });
    if (selectedPlaylist?.id === id) setSelected(null);
    refetch();
  };

  return (
    <AnimatePresence mode="wait">
      {selectedPlaylist ? (
        <PlaylistDetail
          key={selectedPlaylist.id}
          playlist={selectedPlaylist}
          onBack={() => setSelected(null)}
        />
      ) : (
        <motion.div
          key="grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">
              {(playlists || []).length} playlist{(playlists || []).length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva
            </button>
          </div>

          {loading && <LoadingSkeleton rows={2} />}

          {!loading && (!playlists || playlists.length === 0) && (
            <EmptyState
              label="Aún no tienes playlists"
              subtitle="Crea una playlist para organizar tus podcasts favoritos."
              icon={ListMusic}
              action={() => setShowCreate(true)}
              actionLabel="Crear playlist"
            />
          )}

          {!loading && playlists && playlists.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {playlists.map(pl => (
                <PlaylistCard
                  key={pl.id}
                  playlist={pl}
                  onOpen={() => setSelected(pl)}
                  onDelete={() => handleDelete(pl.id, pl.name)}
                />
              ))}
            </div>
          )}

          <AnimatePresence>
            {showCreate && (
              <CreatePlaylistModal
                onClose={() => setShowCreate(false)}
                onCreated={() => { setShowCreate(false); refetch(); }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
