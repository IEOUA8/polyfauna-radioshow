import React, { useState, useEffect } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { R2UploadField } from './R2UploadField';
import { useConfirmDialog } from './ConfirmDialog';
import ArtistCreditSelector from './ArtistCreditSelector';
import CreatorVisibilityControl from './CreatorVisibilityControl';

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '';
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function extractAudioMetadata(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(objectUrl);
    };

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration);
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('No fue posible detectar la duración del archivo de audio.'));
        return;
      }
      resolve({ duration });
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('No fue posible leer los metadatos del archivo de audio.'));
    };
    audio.src = objectUrl;
  });
}

const PodcastManager = ({ ownerId = null }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [podcasts, setPodcasts] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    footer_description: '',
    duration: '',
    cover_url: '',
    audio_url: '',
    genre: '',
    artist_id: '',
    credited_artist_ids: [],
  });

  const myArtist = ownerId ? artists.find(a => a.user_id === ownerId) : null;
  const canTagArtists = !ownerId
    || (currentUser?.role === 'promoter' && currentUser?.organizer_type === 'collective');

  useEffect(() => {
    fetchData();
  }, [ownerId]);

  const fetchData = async () => {
    try {
      let podcastsQuery = supabase.from('podcasts').select('*, artists:artists!podcasts_artist_id_fkey(name), podcast_artist_credits(artist_id)').order('created_at', { ascending: false });
      if (ownerId) podcastsQuery = podcastsQuery.eq('uploaded_by', ownerId);

      const [podcastsRes, artistsRes, ownerArtistRes] = await Promise.all([
        podcastsQuery,
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

      if (podcastsRes.error) throw podcastsRes.error;
      setPodcasts(podcastsRes.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const { credited_artist_ids: creditedArtistIds, ...podcastFields } = formData;
      const podcastData = {
        ...podcastFields,
        duration: Number.isFinite(Number(formData.duration)) && Number(formData.duration) > 0
          ? Math.round(Number(formData.duration))
          : null,
        artist_id: ownerId ? (myArtist?.id || null) : (formData.artist_id || null),
      };

      let podcastId = editingPodcast?.id;

      if (editingPodcast) {
        const { error } = await supabase
          .from('podcasts')
          .update(podcastData)
          .eq('id', editingPodcast.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('podcasts')
          .insert([{ ...podcastData, uploaded_by: currentUser.id }])
          .select('id')
          .single();

        if (error)throw error;
        podcastId = data.id;
      }

      const { error: creditsError } = await supabase.rpc('set_podcast_artist_credits', {
        p_podcast_id: podcastId,
        p_artist_ids: canTagArtists ? creditedArtistIds : [],
      });
      if (creditsError) throw creditsError;

      toast({ title: editingPodcast ? 'Podcast actualizado' : 'Podcast creado' });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error saving podcast",
        description: error.message,
      });
    }
  };

  const handleEdit = (podcast) => {
    setEditingPodcast(podcast);
    setFormData({
      title: podcast.title,
      description: podcast.description || '',
      footer_description: podcast.footer_description || '',
      duration: podcast.duration || '',
      cover_url: podcast.cover_url || '',
      audio_url: podcast.audio_url || '',
      genre: podcast.genre || '',
      artist_id: podcast.artist_id || '',
      credited_artist_ids: (podcast.podcast_artist_credits || [])
        .map((credit) => credit.artist_id)
        .filter((artistId) => artistId !== podcast.artist_id),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!(await confirm({
      title: 'Eliminar podcast',
      message: 'Esta acción no se puede deshacer. El podcast dejará de estar disponible para los oyentes.',
      confirmLabel: 'Eliminar podcast',
      variant: 'destructive',
    }))) return;

    try {
      const { error } = await supabase.from('podcasts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Podcast deleted successfully" });
      fetchData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error deleting podcast",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setEditingPodcast(null);
    setFormData({
      title: '',
      description: '',
      footer_description: '',
      duration: '',
      cover_url: '',
      audio_url: '',
      genre: '',
      artist_id: '',
      credited_artist_ids: [],
    });
  };

  return (
    <>
    {ConfirmDialogElement}
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Podcasts Management</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Podcast
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPodcast ? 'Edit Podcast' : 'Create Podcast'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción principal</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Presenta el episodio, sus invitados y el contenido que encontrará el oyente…"
                  rows={6}
                  maxLength={5000}
                  className="min-h-36 resize-y bg-background border-border text-foreground"
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {formData.description.length}/5000
                </p>
              </div>
              <div>
                <Label htmlFor="genre">Género</Label>
                <Input
                  id="genre"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="bg-background border-border text-foreground"
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
                  <Label htmlFor="artist_id">Artist</Label>
                  <select
                    id="artist_id"
                    value={formData.artist_id}
                    onChange={(e) => setFormData({ ...formData, artist_id: e.target.value })}
                    className="w-full h-10 bg-background border border-border text-foreground rounded-md px-3"
                  >
                    <option value="">Select an artist</option>
                    {artists.map((artist) => (
                      <option key={artist.id} value={artist.id}>{artist.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {canTagArtists && (
                <ArtistCreditSelector
                  artists={artists}
                  selectedIds={formData.credited_artist_ids}
                  primaryArtistId={ownerId ? myArtist?.id : formData.artist_id}
                  onChange={(ids) => setFormData({ ...formData, credited_artist_ids: ids })}
                />
              )}
              <R2UploadField
                label="Portada"
                folder="podcasts/covers"
                accept="image/jpeg,image/png,image/webp"
                imagePreset="square"
                value={formData.cover_url}
                onChange={(url) => setFormData({ ...formData, cover_url: url })}
                previewAspect="1 / 1"
              />
              <R2UploadField
                label="Archivo de audio"
                folder="podcasts/audio"
                accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav"
                value={formData.audio_url}
                extractMetadata={extractAudioMetadata}
                onChange={(url, metadata) => setFormData((current) => ({
                  ...current,
                  audio_url: url,
                  duration: url ? (metadata?.duration || current.duration) : '',
                }))}
              />
              {formData.duration && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  Duración detectada automáticamente: {formatDuration(formData.duration)}
                </p>
              )}
              <div>
                <Label htmlFor="footer_description">Descripción al pie</Label>
                <p className="mb-1 text-[11px] text-muted-foreground">
                  Se mostrará al final de la página de detalle del podcast.
                </p>
                <Textarea
                  id="footer_description"
                  value={formData.footer_description}
                  onChange={(e) => setFormData({ ...formData, footer_description: e.target.value })}
                  placeholder="Añade créditos, enlaces, agradecimientos, referencias o información complementaria…"
                  rows={6}
                  maxLength={5000}
                  className="min-h-36 resize-y bg-background border-border text-foreground"
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {formData.footer_description.length}/5000
                </p>
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0">
                {editingPodcast ? 'Update Podcast' : 'Create Podcast'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : podcasts.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No podcasts yet</p>
        ) : (
          <div className="space-y-3">
            {podcasts.map((podcast) => (
              <div
                key={podcast.id}
                className="flex items-center justify-between p-4 bg-background rounded-xl border border-border"
              >
                <div className="flex-1">
                  <h3 className="text-foreground font-semibold">{podcast.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(podcast.duration) || 'Duración no disponible'} • {podcast.artists?.name || 'No artist'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <CreatorVisibilityControl
                    entityType="podcasts"
                    item={podcast}
                    ownerId={podcast.uploaded_by}
                    noun="Podcast"
                    onChanged={(updated) => setPodcasts((current) => current.map((item) => item.id === podcast.id ? { ...item, ...updated } : item))}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(podcast)}
                    className="text-secondary hover:text-secondary/80"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(podcast.id)}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
};

export default PodcastManager;
