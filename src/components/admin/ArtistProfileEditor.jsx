import React, { useEffect, useState } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Disc3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { R2UploadField } from './R2UploadField';

function parseGenres(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

const ArtistProfileEditor = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    bio: '',
    genres: '',
    image_url: '',
    social_links: { instagram: '', bandcamp: '', soundcloud: '', twitter: '' },
  });

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (!error && data) {
        setArtist(data);
        setForm({
          name: data.name || '',
          bio: data.bio || '',
          genres: Array.isArray(data.genres) ? data.genres.join(', ') : '',
          image_url: data.image_url || '',
          social_links: {
            instagram: data.social_links?.instagram || '',
            bandcamp: data.social_links?.bandcamp || '',
            soundcloud: data.social_links?.soundcloud || '',
            twitter: data.social_links?.twitter || '',
          },
        });
      }
      setLoading(false);
    };
    load();
  }, [currentUser.id]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const setSocial = (key, val) => setForm(prev => ({ ...prev, social_links: { ...prev.social_links, [key]: val } }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'El nombre es obligatorio' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('artists')
      .update({
        name: form.name.trim(),
        bio: form.bio,
        genres: parseGenres(form.genres),
        image_url: form.image_url,
        social_links: form.social_links,
      })
      .eq('user_id', currentUser.id);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
    } else {
      toast({ title: 'Perfil público actualizado' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!artist) {
    return (
      <p className="text-muted-foreground text-center py-12">
        Tu ficha pública aún no se ha generado. Si acabas de ser aprobado, refresca en unos minutos.
      </p>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center gap-2">
        <Disc3 className="w-5 h-5 text-primary" />
        <CardTitle className="text-foreground">Mi perfil público</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground -mt-2">
          Así te ven en Artists &amp; Labels: <a href={`/profiles/${artist.slug}`} target="_blank" rel="noreferrer" className="text-primary underline">/profiles/{artist.slug}</a>
        </p>
        <div>
          <Label>Nombre</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="bg-background border-border text-foreground" required />
        </div>
        <R2UploadField
          label="Foto / logo"
          folder="artists"
          accept="image/jpeg,image/png,image/webp"
          value={form.image_url}
          onChange={(url) => set('image_url', url)}
        />
        <div>
          <Label>Bio</Label>
          <textarea
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
            rows={4}
            className="w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm resize-none"
            placeholder="Cuéntale al público quién eres…"
          />
        </div>
        <div>
          <Label>Géneros</Label>
          <Input
            value={form.genres}
            onChange={(e) => set('genres', e.target.value)}
            className="bg-background border-border text-foreground"
            placeholder="Techno, Ambient…"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Instagram</Label>
            <Input value={form.social_links.instagram} onChange={(e) => setSocial('instagram', e.target.value)} className="bg-background border-border text-foreground" placeholder="https://instagram.com/…" />
          </div>
          <div>
            <Label>SoundCloud</Label>
            <Input value={form.social_links.soundcloud} onChange={(e) => setSocial('soundcloud', e.target.value)} className="bg-background border-border text-foreground" placeholder="https://soundcloud.com/…" />
          </div>
          <div>
            <Label>Bandcamp</Label>
            <Input value={form.social_links.bandcamp} onChange={(e) => setSocial('bandcamp', e.target.value)} className="bg-background border-border text-foreground" placeholder="https://…bandcamp.com" />
          </div>
          <div>
            <Label>Twitter / X</Label>
            <Input value={form.social_links.twitter} onChange={(e) => setSocial('twitter', e.target.value)} className="bg-background border-border text-foreground" placeholder="https://x.com/…" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar cambios
        </Button>
      </CardContent>
    </Card>
  );
};

export default ArtistProfileEditor;
