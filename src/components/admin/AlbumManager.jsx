import React, { useState, useEffect } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2, ChevronRight, Music } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { R2UploadField } from './R2UploadField';
import { useConfirmDialog } from './ConfirmDialog';
import ArtistCreditSelector from './ArtistCreditSelector';

const EMPTY_ALBUM = { title: '', artist_id: '', cover_url: '', release_year: '', genre: '', description: '', credited_artist_ids: [] };
const EMPTY_TRACK = { title: '', artist_id: '', audio_url: '', duration: '', track_number: '', genre: '' };

function secondsToMMSS(secs) {
  if (!secs) return null;
  const m = Math.floor(Number(secs) / 60);
  const s = Number(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const AlbumManager = ({ ownerId = null }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [albums, setAlbums] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ALBUM);
  const [saving, setSaving] = useState(false);
  const [pendingTracks, setPendingTracks] = useState([]);
  const [trackDraft, setTrackDraft] = useState(EMPTY_TRACK);

  const [expandedId, setExpandedId] = useState(null);
  const [tracksByAlbum, setTracksByAlbum] = useState({});
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [trackDialogAlbum, setTrackDialogAlbum] = useState(null);
  const [editingTrack, setEditingTrack] = useState(null);
  const [trackForm, setTrackForm] = useState(EMPTY_TRACK);
  const [savingTrack, setSavingTrack] = useState(false);

  const myArtist = ownerId ? artists.find(a => a.user_id === ownerId) : null;
  const canTagArtists = !ownerId
    || (currentUser?.role === 'promoter' && currentUser?.organizer_type === 'collective');

  useEffect(() => { fetchData(); }, [ownerId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let albumsQuery = supabase.from('albums').select('*, artists:artists!albums_artist_id_fkey(name), album_artist_credits(artist_id)').order('created_at', { ascending: false });
      if (ownerId) albumsQuery = albumsQuery.eq('uploaded_by', ownerId);
      const [albumsRes, artistsRes, ownerArtistRes] = await Promise.all([
        albumsQuery,
        supabase.from('artists_public').select('id, name, user_id').order('name'),
        ownerId
          ? supabase.from('artists').select('id, name, user_id').eq('user_id', ownerId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (artistsRes.error) throw artistsRes.error;
      if (ownerArtistRes.error) throw ownerArtistRes.error;

      const availableArtists = ownerArtistRes.data
        ? [ownerArtistRes.data, ...(artistsRes.data || []).filter((artist) => artist.id !== ownerArtistRes.data.id)]
        : (artistsRes.data || []);
      setArtists(availableArtists);

      if (albumsRes.error) throw albumsRes.error;
      setAlbums(albumsRes.data || []);
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
      const albumArtistId = ownerId ? (myArtist?.id || null) : (form.artist_id || null);
      const { credited_artist_ids: creditedArtistIds, ...albumFields } = form;
      const payload = {
        ...albumFields,
        release_year: form.release_year ? parseInt(form.release_year) : null,
        artist_id: albumArtistId,
      };
      let albumId = editing?.id;
      if (editing) {
        const { error } = await supabase.from('albums').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('albums')
          .insert([{ ...payload, uploaded_by: currentUser.id }])
          .select()
          .single();
        if (error) throw error;
        albumId = data.id;
      }

      const { error: creditsError } = await supabase.rpc('set_album_artist_credits', {
        p_album_id: albumId,
        p_artist_ids: canTagArtists ? creditedArtistIds : [],
      });
      if (creditsError) throw creditsError;

      if (pendingTracks.length > 0) {
        const tracksPayload = pendingTracks.map((t, i) => ({
          title: t.title,
          audio_url: t.audio_url || null,
          duration: t.duration ? parseInt(t.duration) : null,
          track_number: t.track_number ? parseInt(t.track_number) : i + 1,
          genre: t.genre || null,
          album_id: albumId,
          artist_id: albumArtistId,
        }));
        const { error: tracksError } = await supabase.from('tracks').insert(tracksPayload);
        if (tracksError) throw tracksError;
        setTracksByAlbum((prev) => ({ ...prev, [albumId]: undefined }));
      }

      toast({ title: editing ? 'Álbum actualizado' : 'Álbum creado' });

      setIsDialogOpen(false);
      reset();
      fetchData();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addPendingTrack = () => {
    if (!trackDraft.title.trim()) {
      toast({ variant: 'destructive', title: 'El track necesita un título' });
      return;
    }
    setPendingTracks((prev) => [...prev, trackDraft]);
    setTrackDraft(EMPTY_TRACK);
  };

  const removePendingTrack = (index) => {
    setPendingTracks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (album) => {
    setEditing(album);
    setForm({
      title: album.title,
      artist_id: album.artist_id || '',
      cover_url: album.cover_url || '',
      release_year: album.release_year || '',
      genre: album.genre || '',
      description: album.description || '',
      credited_artist_ids: (album.album_artist_credits || [])
        .map((credit) => credit.artist_id)
        .filter((artistId) => artistId !== album.artist_id),
    });
    setPendingTracks([]);
    setTrackDraft(EMPTY_TRACK);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!(await confirm({
      title: 'Eliminar álbum',
      message: 'Se eliminarán también todos sus tracks. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar álbum',
      variant: 'destructive',
    }))) return;
    try {
      const { error } = await supabase.from('albums').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Álbum eliminado' });
      if (expandedId === id) setExpandedId(null);
      fetchData();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const reset = () => { setEditing(null); setForm(EMPTY_ALBUM); setPendingTracks([]); setTrackDraft(EMPTY_TRACK); };

  /* ── Tracks (siempre dentro de un álbum) ────────────────────── */
  const fetchTracks = async (albumId) => {
    setLoadingTracks(true);
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*, artists(name)')
        .eq('album_id', albumId)
        .order('track_number', { ascending: true, nullsFirst: false });
      if (error) throw error;
      setTracksByAlbum((prev) => ({ ...prev, [albumId]: data || [] }));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoadingTracks(false);
    }
  };

  const toggleExpand = (albumId) => {
    if (expandedId === albumId) { setExpandedId(null); return; }
    setExpandedId(albumId);
    if (!tracksByAlbum[albumId]) fetchTracks(albumId);
  };

  const openNewTrack = (albumId) => {
    setTrackDialogAlbum(albumId);
    setEditingTrack(null);
    setTrackForm(EMPTY_TRACK);
  };

  const openEditTrack = (albumId, track) => {
    setTrackDialogAlbum(albumId);
    setEditingTrack(track);
    setTrackForm({
      title: track.title,
      artist_id: track.artist_id || '',
      audio_url: track.audio_url || '',
      duration: track.duration || '',
      track_number: track.track_number || '',
      genre: track.genre || '',
    });
  };

  const closeTrackDialog = () => {
    setTrackDialogAlbum(null);
    setEditingTrack(null);
    setTrackForm(EMPTY_TRACK);
  };

  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    setSavingTrack(true);
    try {
      const payload = {
        ...trackForm,
        album_id: trackDialogAlbum,
        duration: trackForm.duration ? parseInt(trackForm.duration) : null,
        track_number: trackForm.track_number ? parseInt(trackForm.track_number) : null,
        artist_id: ownerId ? (myArtist?.id || null) : (trackForm.artist_id || null),
      };
      if (editingTrack) {
        const { error } = await supabase.from('tracks').update(payload).eq('id', editingTrack.id);
        if (error) throw error;
        toast({ title: 'Track actualizado' });
      } else {
        const { error } = await supabase.from('tracks').insert([payload]);
        if (error) throw error;
        toast({ title: 'Track agregado' });
      }
      closeTrackDialog();
      fetchTracks(trackDialogAlbum);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: err.message });
    } finally {
      setSavingTrack(false);
    }
  };

  const handleDeleteTrack = async (albumId, trackId) => {
    if (!(await confirm({
      title: 'Eliminar track',
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar track',
      variant: 'destructive',
    }))) return;
    try {
      const { error } = await supabase.from('tracks').delete().eq('id', trackId);
      if (error) throw error;
      toast({ title: 'Track eliminado' });
      fetchTracks(albumId);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  return (
    <>
    {ConfirmDialogElement}
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Gestión de Álbumes</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) reset(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Álbum
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Álbum' : 'Crear Álbum'}</DialogTitle>
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
              {ownerId ? (
                <div>
                  <Label>Artista</Label>
                  <p className="h-10 flex items-center px-3 rounded-md border border-border bg-background text-sm text-foreground">
                    {myArtist?.name || 'Tu perfil de artista'}
                  </p>
                </div>
              ) : (
                <div>
                  <Label>Artista</Label>
                  <select
                    value={form.artist_id}
                    onChange={(e) => setForm({ ...form, artist_id: e.target.value })}
                    className="w-full h-10 bg-background border border-border text-foreground rounded-md px-3"
                  >
                    <option value="">Sin artista asignado</option>
                    {artists.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {canTagArtists && (
                <ArtistCreditSelector
                  artists={artists}
                  selectedIds={form.credited_artist_ids}
                  primaryArtistId={ownerId ? myArtist?.id : form.artist_id}
                  onChange={(ids) => setForm({ ...form, credited_artist_ids: ids })}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Año de lanzamiento</Label>
                  <Input
                    type="number"
                    min="1900"
                    max="2099"
                    value={form.release_year}
                    onChange={(e) => setForm({ ...form, release_year: e.target.value })}
                    className="bg-background border-border text-foreground"
                    placeholder="2024"
                  />
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
              </div>
              <R2UploadField
                label="Portada"
                folder="albums"
                accept="image/jpeg,image/png,image/webp"
                imagePreset="square"
                value={form.cover_url}
                onChange={(url) => setForm({ ...form, cover_url: url })}
              />
              <div>
                <Label>Descripción</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm resize-none"
                  placeholder="Descripción del álbum… (para un sencillo, describe la canción)"
                />
              </div>
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Tracks {editing && <span className="text-muted-foreground font-normal">(se agregan a los existentes)</span>}</Label>
                </div>
                {pendingTracks.length > 0 && (
                  <div className="space-y-1.5">
                    {pendingTracks.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border border-border">
                        <Music className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-sm text-foreground flex-1 truncate">
                          {t.track_number ? `${t.track_number}. ` : `${i + 1}. `}{t.title}
                          {!t.audio_url && <span className="text-muted-foreground"> · sin audio</span>}
                        </span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removePendingTrack(i)} className="h-7 w-7 text-destructive hover:text-destructive/80">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Título del track"
                    value={trackDraft.title}
                    onChange={(e) => setTrackDraft({ ...trackDraft, title: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="N° track"
                    value={trackDraft.track_number}
                    onChange={(e) => setTrackDraft({ ...trackDraft, track_number: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <R2UploadField
                  label="Audio del track"
                  folder="tracks"
                  accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/flac"
                  value={trackDraft.audio_url}
                  onChange={(url) => setTrackDraft({ ...trackDraft, audio_url: url })}
                />
                <Button type="button" variant="outline" size="sm" onClick={addPendingTrack} className="w-full gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Agregar track a la lista
                </Button>
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing ? 'Guardar cambios' : 'Crear álbum'}
                {pendingTracks.length > 0 && ` (+${pendingTracks.length} track${pendingTracks.length > 1 ? 's' : ''})`}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <p className="text-xs text-muted-foreground -mt-2 mb-4">
          Un sencillo es un álbum con un solo track — agrégalo desde la ficha del álbum una vez creado.
        </p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : albums.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No hay álbumes aún</p>
        ) : (
          <div className="space-y-3">
            {albums.map((album) => {
              const isOpen = expandedId === album.id;
              const tracks = tracksByAlbum[album.id] || [];
              return (
                <div key={album.id} className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(album.id)}
                    className="w-full flex items-center gap-4 p-4 bg-background text-left"
                  >
                    {album.cover_url && (
                      <img src={album.cover_url} alt={album.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-semibold truncate">{album.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {album.artists?.name || 'Sin artista'}
                        {album.release_year && ` · ${album.release_year}`}
                        {album.genre && ` · ${album.genre}`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(album); }} className="text-secondary hover:text-secondary/80">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(album.id); }} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-border p-4 bg-card space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tracks</p>
                        <Button size="sm" variant="outline" onClick={() => openNewTrack(album.id)} className="gap-1.5">
                          <Plus className="w-3.5 h-3.5" /> Agregar track
                        </Button>
                      </div>
                      {loadingTracks && !tracksByAlbum[album.id] ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        </div>
                      ) : tracks.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Sin tracks aún</p>
                      ) : (
                        tracks.map((track) => (
                          <div key={track.id} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(var(--primary),0.1)' }}>
                              <Music className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground font-semibold truncate">
                                {track.track_number ? `${track.track_number}. ` : ''}{track.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {track.artists?.name}
                                {track.duration && ` · ${secondsToMMSS(track.duration)}`}
                                {!track.audio_url && ' · ⚠ Sin audio'}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" onClick={() => openEditTrack(album.id, track)} className="text-secondary hover:text-secondary/80 h-8 w-8">
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteTrack(album.id, track.id)} className="text-destructive hover:text-destructive/80 h-8 w-8">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!trackDialogAlbum} onOpenChange={(open) => { if (!open) closeTrackDialog(); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTrack ? 'Editar Track' : 'Agregar Track'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTrackSubmit} className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={trackForm.title}
                onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })}
                className="bg-background border-border text-foreground"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {ownerId ? (
                <div>
                  <Label>Artista</Label>
                  <p className="h-10 flex items-center px-3 rounded-md border border-border bg-background text-sm text-foreground">
                    {myArtist?.name || 'Tu perfil de artista'}
                  </p>
                </div>
              ) : (
                <div>
                  <Label>Artista</Label>
                  <select
                    value={trackForm.artist_id}
                    onChange={(e) => setTrackForm({ ...trackForm, artist_id: e.target.value })}
                    className="w-full h-10 bg-background border border-border text-foreground rounded-md px-3"
                  >
                    <option value="">Sin artista</option>
                    {artists.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label>Número de track</Label>
                <Input
                  type="number"
                  min="1"
                  value={trackForm.track_number}
                  onChange={(e) => setTrackForm({ ...trackForm, track_number: e.target.value })}
                  className="bg-background border-border text-foreground"
                  placeholder="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Duración (segundos)</Label>
                <Input
                  type="number"
                  min="1"
                  value={trackForm.duration}
                  onChange={(e) => setTrackForm({ ...trackForm, duration: e.target.value })}
                  className="bg-background border-border text-foreground"
                  placeholder="245"
                />
              </div>
              <div>
                <Label>Género</Label>
                <Input
                  value={trackForm.genre}
                  onChange={(e) => setTrackForm({ ...trackForm, genre: e.target.value })}
                  className="bg-background border-border text-foreground"
                  placeholder="Techno, Ambient…"
                />
              </div>
            </div>
            <R2UploadField
              label="Archivo de audio"
              folder="tracks"
              accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/flac"
              value={trackForm.audio_url}
              onChange={(url) => setTrackForm({ ...trackForm, audio_url: url })}
            />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0" disabled={savingTrack}>
              {savingTrack ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingTrack ? 'Guardar cambios' : 'Agregar track'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
    </>
  );
};

export default AlbumManager;
