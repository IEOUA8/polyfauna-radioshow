import React, { useState, useEffect } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirmDialog } from './ConfirmDialog';

const ShowManager = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    dj: '',
    schedule: '',
    genre: '',
    description: '',
  });

  useEffect(() => {
    fetchShows();
  }, []);

  const fetchShows = async () => {
    try {
      const { data, error } = await supabase
        .from('radio_shows')
        .select('*')
        .order('name');

      if (error) throw error;
      setShows(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error fetching shows",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingShow && currentUser?.role !== 'admin') {
        toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can update shows." });
        return;
      }

      if (editingShow) {
        const { error } = await supabase
          .from('radio_shows')
          .update(formData)
          .eq('id', editingShow.id);

        if (error) throw error;
        toast({ title: "Show updated successfully" });
      } else {
        const { error } = await supabase
          .from('radio_shows')
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Show created successfully" });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchShows();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error saving show",
        description: error.message,
      });
    }
  };

  const handleEdit = (show) => {
    setEditingShow(show);
    setFormData({
      name: show.name,
      dj: show.dj,
      schedule: show.schedule || '',
      genre: show.genre || '',
      description: show.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (currentUser?.role !== 'admin') {
      toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can delete shows." });
      return;
    }

    if (!(await confirm({
      title: 'Eliminar programa',
      message: 'Esta acción no se puede deshacer. El programa dejará de estar disponible.',
      confirmLabel: 'Eliminar programa',
      variant: 'destructive',
    }))) return;

    try {
      const { error } = await supabase.from('radio_shows').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Show deleted successfully" });
      fetchShows();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error deleting show",
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setEditingShow(null);
    setFormData({
      name: '',
      dj: '',
      schedule: '',
      genre: '',
      description: '',
    });
  };

  return (
    <>
    {ConfirmDialogElement}
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Radio Shows Management</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Show
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingShow ? 'Edit Show' : 'Create Show'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Show Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="dj">DJ/Host</Label>
                <Input
                  id="dj"
                  value={formData.dj}
                  onChange={(e) => setFormData({ ...formData, dj: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div>
                <Label htmlFor="schedule">Schedule</Label>
                <Input
                  id="schedule"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  className="bg-background border-border text-foreground"
                  placeholder="Mon-Fri 8PM-10PM"
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
              <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full min-h-[100px] bg-background border border-border text-foreground rounded-md p-3"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0">
                {editingShow ? 'Update Show' : 'Create Show'}
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
        ) : shows.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No shows yet</p>
        ) : (
          <div className="space-y-3">
            {shows.map((show) => (
              <div
                key={show.id}
                className="flex items-center justify-between p-4 bg-background rounded-xl border border-border"
              >
                <div className="flex-1">
                  <h3 className="text-foreground font-semibold">{show.name}</h3>
                  <p className="text-sm text-muted-foreground">with {show.dj} • {show.schedule}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(show)}
                    className="text-secondary hover:text-secondary/80"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(show.id)}
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

export default ShowManager;