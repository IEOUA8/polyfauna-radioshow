import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListMusic, Plus, Trash2, X, Loader2, Lock, Globe } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState, LoadingSkeleton, LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';

const FALLBACK = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=200&auto=format&fit=crop';

function CreatePlaylistModal({ onClose, onCreated }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('playlists')
      .insert({ user_id: currentUser.id, name: name.trim(), description: desc.trim(), is_public: isPublic })
      .select().single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Playlist creada', description: `"${data.name}" lista.` });
      onCreated(data);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: '#0F1322', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Nueva Playlist</h3>
          <button onClick={onClose} type="button" className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la playlist"
          className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
          onFocus={e => (e.target.style.borderColor = '#00CFFF')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)" rows={2}
          className="w-full text-sm px-3 py-2.5 rounded-lg outline-none resize-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
          onFocus={e => (e.target.style.borderColor = '#00CFFF')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
        <button type="button" onClick={() => setIsPublic(p => !p)}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg w-full transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', color: isPublic ? '#00CFFF' : 'rgba(255,255,255,0.4)' }}>
          {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {isPublic ? 'Pública — visible para todos' : 'Privada — solo tú'}
        </button>
        <button type="button" onClick={handleCreate} disabled={!name.trim() || saving}
          className="w-full py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: '#00CFFF', color: '#080B14' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saving ? 'Creando…' : 'Crear playlist'}
        </button>
      </motion.div>
    </div>
  );
}

function PlaylistCard({ playlist, onDelete }) {
  const { data: tracks } = useSupabaseQuery(
    () => supabase.from('playlist_tracks').select('podcast_id, podcasts(cover_url)').eq('playlist_id', playlist.id).limit(4),
    [playlist.id]
  );

  const covers = (tracks || []).map(t => t.podcasts?.cover_url).filter(Boolean);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden flex flex-col group"
      style={{ background: 'rgba(15, 19, 34, 0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Cover grid */}
      <div className="relative aspect-square grid grid-cols-2 gap-0.5 overflow-hidden bg-black">
        {covers.length >= 4
          ? covers.slice(0, 4).map((c, i) => <img key={i} src={c} alt="" className="w-full h-full object-cover" />)
          : <img src={covers[0] || FALLBACK} alt={playlist.name} className="col-span-2 row-span-2 w-full h-full object-cover" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {playlist.is_public
            ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,207,255,0.15)', color: '#00CFFF' }}>Pública</span>
            : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>Privada</span>
          }
        </div>
        <button type="button" onClick={onDelete}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(239,68,68,0.8)' }}>
          <Trash2 className="w-3 h-3 text-white" />
        </button>
      </div>
      <div className="p-3">
        <p className="text-xs font-bold text-white truncate">{playlist.name}</p>
        <p className="text-[11px] text-white/40 mt-0.5">{(tracks || []).length} track{(tracks || []).length !== 1 ? 's' : ''}</p>
      </div>
    </motion.div>
  );
}

export default function MyPlaylists() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

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
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40">{(playlists || []).length} playlist{(playlists || []).length !== 1 ? 's' : ''}</p>
        <button type="button" onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(0,207,255,0.1)', color: '#00CFFF', border: '1px solid rgba(0,207,255,0.2)' }}>
          <Plus className="w-3.5 h-3.5" />
          Nueva
        </button>
      </div>

      {loading && <LoadingSkeleton rows={2} />}
      {!loading && (!playlists || playlists.length === 0) && (
        <EmptyState label="Aún no tienes playlists" icon={ListMusic} />
      )}
      {!loading && playlists && playlists.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {playlists.map(pl => (
            <PlaylistCard key={pl.id} playlist={pl} onDelete={() => handleDelete(pl.id, pl.name)} />
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
    </div>
  );
}
