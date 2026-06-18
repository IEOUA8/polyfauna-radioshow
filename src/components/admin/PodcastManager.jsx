import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UploadField } from './UploadField';

const PodcastManager = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [podcasts, setPodcasts] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPodcast, setEditingPodcast] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: '',
    cover_url: '',
    audio_url: '',
    genre: '',
    artist_id: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [podcastsRes, artistsRes] = await Promise.all([
        supabase.from('podcasts').select('*, artists(name)').order('created_at', { ascending: false }),
        supabase.from('artists').select('id, name').order('name'),
      ]);

      if (podcastsRes.error) throw podcastsRes.error;
      if (artistsRes.error) throw artistsRes.error;

      setPodcasts(podcastsRes.data || []);
      setArtists(artistsRes.data || []);
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
      if (editingPodcast && currentUser?.role !== 'admin') {
        toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can update podcasts." });
        return;
      }

      const podcastData = {
        ...formData,
        duration: parseInt(formData.duration),
        artist_id: formData.artist_id || null,
      };

      if (editingPodcast) {
        const { error } = await supabase
          .from('podcasts')
          .update(podcastData)
          .eq('id', editingPodcast.id);

        if (error) throw error;
        toast({ title: "Podcast updated successfully" });
      } else {
        const { error } = await supabase
          .from('podcasts')
          .insert([podcastData]);

        if (error)throw error;
        toast({ title: "Podcast created successfully" });
      }

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
      duration: podcast.duration,
      cover_url: podcast.cover_url || '',
      audio_url: podcast.audio_url || '',
      genre: podcast.genre || '',
      artist_id: podcast.artist_id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (currentUser?.role !== 'admin') {
      toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can delete podcasts." });
      return;
    }

    if (!confirm('Are you sure you want to delete this podcast?')) return;

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
      duration: '',
      cover_url: '',
      audio_url: '',
      genre: '',
      artist_id: '',
    });
  };

  return (
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
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Duración (segundos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Input
                    id="genre"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="bg-background border-border text-foreground"
                  />
                </div>
              </div>
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
              <UploadField
                label="Portada"
                bucket="podcast-covers"
                accept="image/jpeg,image/png,image/webp"
                value={formData.cover_url}
                onChange={(url) => setFormData({ ...formData, cover_url: url })}
              />
              <UploadField
                label="Archivo de audio"
                bucket="podcast-audio"
                accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav"
                value={formData.audio_url}
                onChange={(url) => setFormData({ ...formData, audio_url: url })}
              />
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
                    {podcast.duration} min • {podcast.artists?.name || 'No artist'}
                  </p>
                </div>
                <div className="flex gap-2">
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
  );
};

export default PodcastManager;