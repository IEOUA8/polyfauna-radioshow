import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2, Ticket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UploadField } from './UploadField';

const EMPTY = {
  title: '', date: '', venue: '', city: '', lineup: '',
  image_url: '', price: '', description: '',
  tickets_total: '100', ticket_type: 'GA',
};

const TICKET_TYPES = ['GA', 'VIP', 'Early Bird', 'Artist', 'Press'];

const EventManager = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events').select('*').order('date', { ascending: false });
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { ticket_type, ...rest } = formData;
      const payload = {
        ...rest,
        price:        formData.price        ? parseFloat(formData.price)        : null,
        tickets_total: formData.tickets_total ? parseInt(formData.tickets_total) : 100,
        owner_id:     currentUser.id,
        status:       'published',
        lineup:       formData.lineup
          ? formData.lineup.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      };

      if (editingEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEvent.id);
        if (error) throw error;
        toast({ title: 'Evento actualizado' });
      } else {
        const { error } = await supabase.from('events').insert([payload]);
        if (error) throw error;
        toast({ title: 'Evento creado' });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title || '',
      date: event.date ? event.date.slice(0, 16) : '',
      venue: event.venue || '',
      city: event.city || '',
      lineup: event.lineup || '',
      image_url: event.image_url || '',
      price: event.price || '',
      description: event.description || '',
      tickets_total: event.tickets_total || '100',
      ticket_type: event.ticket_type || 'GA',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este evento? Se eliminarán también sus entradas.')) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Evento eliminado' });
      fetchEvents();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const resetForm = () => { setEditingEvent(null); setFormData(EMPTY); };
  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-foreground">Gestión de Eventos</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Editar Evento' : 'Crear Evento'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Portada */}
              <UploadField
                label="Imagen del evento"
                bucket="album-covers"
                accept="image/jpeg,image/png,image/webp"
                value={formData.image_url}
                onChange={(url) => set('image_url', url)}
              />

              {/* Título */}
              <div>
                <Label>Título *</Label>
                <Input value={formData.title} onChange={(e) => set('title', e.target.value)}
                  className="bg-background border-border text-foreground" required />
              </div>

              {/* Fecha + Precio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fecha y hora *</Label>
                  <Input type="datetime-local" value={formData.date} onChange={(e) => set('date', e.target.value)}
                    className="bg-background border-border text-foreground" required />
                </div>
                <div>
                  <Label>Precio (COP)</Label>
                  <Input type="number" value={formData.price} onChange={(e) => set('price', e.target.value)}
                    className="bg-background border-border text-foreground" placeholder="35000" min="0" />
                </div>
              </div>

              {/* Venue + Ciudad */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Venue / Lugar</Label>
                  <Input value={formData.venue} onChange={(e) => set('venue', e.target.value)}
                    className="bg-background border-border text-foreground" placeholder="Club Razzmatazz" />
                </div>
                <div>
                  <Label>Ciudad</Label>
                  <Input value={formData.city} onChange={(e) => set('city', e.target.value)}
                    className="bg-background border-border text-foreground" placeholder="Bogotá" />
                </div>
              </div>

              {/* Tickets total + Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Total entradas</Label>
                  <Input type="number" value={formData.tickets_total} onChange={(e) => set('tickets_total', e.target.value)}
                    className="bg-background border-border text-foreground" placeholder="100" min="1" />
                </div>
                <div>
                  <Label>Tipo de entrada</Label>
                  <select value={formData.ticket_type} onChange={(e) => set('ticket_type', e.target.value)}
                    className="w-full h-10 bg-background border border-border text-foreground rounded-md px-3">
                    {TICKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Lineup */}
              <div>
                <Label>Lineup</Label>
                <Input value={formData.lineup} onChange={(e) => set('lineup', e.target.value)}
                  className="bg-background border-border text-foreground" placeholder="Artista 1, Artista 2…" />
              </div>

              {/* Descripción */}
              <div>
                <Label>Descripción</Label>
                <textarea value={formData.description} onChange={(e) => set('description', e.target.value)}
                  rows={3} placeholder="Describe el evento…"
                  className="w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm resize-none" />
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingEvent ? 'Guardar cambios' : 'Crear Evento'}
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
        ) : events.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No hay eventos aún</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-4 p-4 bg-background rounded-xl border border-border">
                {event.image_url && (
                  <img src={event.image_url} alt={event.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-semibold truncate">{event.title}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {event.venue && ` · ${event.venue}`}
                    {event.city && `, ${event.city}`}
                  </p>
                  {event.tickets_total && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Ticket className="w-3 h-3" />
                      {event.tickets_sold || 0} / {event.tickets_total} entradas
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(event)} className="text-secondary hover:text-secondary/80">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(event.id)} className="text-destructive hover:text-destructive/80">
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

export default EventManager;
