import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UploadField } from './UploadField';

const EMPTY = { title: '', album_id: '', artist_id: '', audio_url: '', duration: '', track_number: '', genre: '' };

function secondsToMMSS(secs) {
  if (!secs) return null;
  const m = Math.floor(Number(secs) / 60);
  const s = Number(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const TrackManager = () => {
  const { toast } = useToast();
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [artists, setArtists] = useState([]);
  const [filterAlbum, setFilterAlbum] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tracksRes, albumsRes, artistsRes] = await Promise.all([
        supabase.from('tracks').select('*, albums(title), artists(name)').order('created_at', { ascending: false }),
        supabase.from('albums').select('id, title, artists(name)').order('title'),
        supabase.from('artists').select('id, name').order('name'),
      ]);
      if (tracksRes.error) throw tracksRes.error;
      if (albumsRes.error) throw albumsRes.error;
      if (artistsRes.error) throw artistsRes.error;
      setTracks(tracksRes.data || []);
      setAlbums(albumsRes.data || []);
      setArtists(artistsRes.data || []);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        duration: form.duration ? parseInt(form.duration) : null,
        track_number: form.track_number ? parseInt(form.track_number) : null,
        album_id: form.album_id || null,
        artist_id: form.artist_id || null,
      };
      if (editing) {
        const { error } = await supabase.from('tracks').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Track actualizado' });
      } else {
        const { error } = await supabase.from('tracks').insert([payload]);
        if (error) throw error;
        toast({ title: 'Track creado' });
      }
      setIsDialogOpen(false);
      reset();
      fetchData();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (track) => {
    setEditing(track);
    setForm({
      title: track.title,
      album_id: track.album_id || '',
      artist_id: track.artist_id || '',
      audio_url: track.audio_url || '',
      duration: track.duration || '',
      track_number: track.track_number || '',
      genre: track.genre || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este track?')) return;
    try {
      const { error } = await supabase.from('tracks').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Track eliminado' });
      fetchData();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const reset = () => { setEditing(null); setForm(EMPTY); };

  const filtered = filterAlbum ? tracks.filter((t) => t.album_id === filterAlbum) : tracks;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="text-foreground">Gestión de Tracks</CardTitle>
        <div className="flex gap-3 items-center">
          <select
            value={filterAlbum}
            onChange={(e) => setFilterAlbum(e.target.value)}
            className="h-9 bg-background border border-border text-foreground rounded-md px-3 text-sm"
          >
            <option value="">Todos los álbumes</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) reset(); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Track
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Track' : 'Crear Track'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Álbum</Label>
                    <select
                      value={form.album_id}
                      onChange={(e) => setForm({ ...form, album_id: e.target.value })}
                      className="w-full h-10 bg-background border border-border text-foreground rounded-md px-3"
                    >
                      <option value="">Sin álbum</option>
                      {albums.map((a) => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Artista</Label>
                    <select
                      value={form.artist_id}
                      onChange={(e) => setForm({ ...form, artist_id: e.target.value })}
                      className="w-full h-10 bg-background border border-border text-foreground rounded-md px-3"
                    >
                      <option value="">Sin artista</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Número de track</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.track_number}
                      onChange={(e) => setForm({ ...form, track_number: e.target.value })}
                      className="bg-background border-border text-foreground"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label>Duración (segundos)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      className="bg-background border-border text-foreground"
                      placeholder="245"
                    />
                  </div>
                </div>
                <div>
                  <Label>Género</Label>
                  <Input
                    value={form.genre}
                    onChange={(e) => setForm({ ...form, genre: e.target.value })}
                    className="bg-background border-border text-foreground"
                    placeholder="Techno, Ambient…"
                  />
                </div>
                <UploadField
                  label="Archivo de audio"
                  bucket="track-audio"
                  accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/flac"
                  value={form.audio_url}
                  onChange={(url) => setForm({ ...form, audio_url: url })}
                />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editing ? 'Guardar cambios' : 'Crear track'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            {filterAlbum ? 'No hay tracks en este álbum' : 'No hay tracks aún'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((track) => (
              <div key={track.id} className="flex items-center gap-4 p-4 bg-background rounded-xl border border-border">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--primary),0.1)' }}>
                  <Music className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-semibold truncate">
                    {track.track_number ? `${track.track_number}. ` : ''}{track.title}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {track.albums?.title || 'Sin álbum'}
                    {track.artists?.name && ` · ${track.artists.name}`}
                    {track.duration && ` · ${secondsToMMSS(track.duration)}`}
                    {!track.audio_url && ' · ⚠ Sin audio'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(track)} className="text-secondary hover:text-secondary/80">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(track.id)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrackManager;
