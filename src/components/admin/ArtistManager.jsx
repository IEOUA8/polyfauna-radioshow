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

const ArtistManager = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    image_url: '',
    social_links: '',
  });

  useEffect(() => {
    fetchArtists();
  }, []);

  const fetchArtists = async () => {
    try {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .order('name');

      if (error) throw error;
      setArtists(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error fetching artists",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingArtist && currentUser?.role !== 'admin') {
        toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can update artists." });
        return;
      }

      let socialLinks = {};
      if (formData.social_links) {
        try {
          socialLinks = JSON.parse(formData.social_links);
        } catch {
          socialLinks = { links: formData.social_links };
        }
      }

      const artistData = {
        name: formData.name,
        bio: formData.bio,
        image_url: formData.image_url,
        social_links: socialLinks,
      };

      if (editingArtist) {
        const { error } = await supabase
          .from('artists')
          .update(artistData)
          .eq('id', editingArtist.id);

        if (error) throw error;
        toast({ title: "Artist updated successfully" });
      } else {
        const { error } = await supabase
          .from('artists')
          .insert([artistData]);

        if (error) throw error;
        toast({ title: "Artist created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchArtists();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error saving artist",
        description: error.message,
      });
    }
  };

  const handleEdit = (artist) => {
    setEditingArtist(artist);
    setFormData({
      name: artist.name,
      bio: artist.bio || '',
      image_url: artist.image_url || '',
      social_links: JSON.stringify(artist.social_links || {}),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (currentUser?.role !== 'admin') {
      toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can delete artists." });
      return;
    }

    if (!confirm('Are you sure you want to delete this artist?')) return;

    try {
      const { error } = await supabase.from('artists').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Artist deleted successfully" });
      fetchArtists();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error deleting artist",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setEditingArtist(null);
    setFormData({
      name: '',
      bio: '',
      image_url: '',
      social_links: '',
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Artists Management</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Artist
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingArtist ? 'Edit Artist' : 'Create Artist'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Artist Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full min-h-[100px] bg-background border border-border text-foreground rounded-md p-3"
                />
              </div>
              <div>
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div>
                <Label htmlFor="social_links">Social Links (JSON)</Label>
                <Input
                  id="social_links"
                  value={formData.social_links}
                  onChange={(e) => setFormData({ ...formData, social_links: e.target.value })}
                  className="bg-background border-border text-foreground"
                  placeholder='{"instagram": "url", "soundcloud": "url"}'
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0">
                {editingArtist ? 'Update Artist' : 'Create Artist'}
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
        ) : artists.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No artists yet</p>
        ) : (
          <div className="space-y-3">
            {artists.map((artist) => (
              <div
                key={artist.id}
                className="flex items-center justify-between p-4 bg-background rounded-xl border border-border"
              >
                <div className="flex-1">
                  <h3 className="text-foreground font-semibold">{artist.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">{artist.bio || 'No bio'}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(artist)}
                    className="text-secondary hover:text-secondary/80"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(artist.id)}
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

export default ArtistManager;