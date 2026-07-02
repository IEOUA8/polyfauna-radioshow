import React, { useState, useEffect } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UploadField } from './UploadField';

const EMPTY = { title: '', artist_id: '', cover_url: '', release_year: '', genre: '', description: '' };

const AlbumManager = () => {
  const { toast } = useToast();
  const [albums, setAlbums] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [albumsRes, artistsRes] = await Promise.all([
        supabase.from('albums').select('*, artists(name)').order('created_at', { ascending: false }),
        supabase.from('artists').select('id, name').order('name'),
      ]);
      if (albumsRes.error) throw albumsRes.error;
      if (artistsRes.error) throw artistsRes.error;
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
        release_year: form.release_year ? parseInt(form.release_year) : null,
        artist_id: form.artist_id || null,
      };
      if (editing) {
        const { error } = await supabase.from('albums').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast({ title: 'Álbum actualizado' });
      } else {
        const { error } = await supabase.from('albums').insert([payload]);
        if (error) throw error;
        toast({ title: 'Álbum creado' });
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

  const handleEdit = (album) => {
    setEditing(album);
    setForm({
      title: album.title,
      artist_id: album.artist_id || '',
      cover_url: album.cover_url || '',
      release_year: album.release_year || '',
      genre: album.genre || '',
      description: album.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este álbum? Se eliminarán también todos sus tracks.')) return;
    try {
      const { error } = await supabase.from('albums').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Álbum eliminado' });
      fetchData();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const reset = () => { setEditing(null); setForm(EMPTY); };

  return (
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
              <UploadField
                label="Portada"
                bucket="album-covers"
                accept="image/jpeg,image/png,image/webp"
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
                  placeholder="Descripción del álbum…"
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing ? 'Guardar cambios' : 'Crear álbum'}
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
        ) : albums.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No hay álbumes aún</p>
        ) : (
          <div className="space-y-3">
            {albums.map((album) => (
              <div key={album.id} className="flex items-center gap-4 p-4 bg-background rounded-xl border border-border">
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
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(album)} className="text-secondary hover:text-secondary/80">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(album.id)} className="text-destructive hover:text-destructive/80">
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

export default AlbumManager;
