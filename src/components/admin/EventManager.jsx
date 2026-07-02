import React, { useState, useEffect } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2, Ticket, Users, X, Save, Mail, Phone, User, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UploadField } from './UploadField';

const EMPTY = {
  title: '', date: '', venue: '', city: '', lineup: '',
  image_url: '', price: '', description: '',
  tickets_total: '100', ticket_type: 'General',
  featured: false, featured_order: '',
};

const TICKET_TYPES = ['General', 'VIP', 'Early', 'Anytime'];

/* ── Attendees Modal ─────────────────────────────────────── */
function AttendeesModal({ event, onClose }) {
  const { toast } = useToast();
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ display_name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAttendees();
  }, [event.id]);

  const fetchAttendees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_event_attendees', { p_event_id: event.id });
      if (error) throw error;
      setAttendees(data || []);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (attendee) => {
    setEditingId(attendee.user_id);
    setEditForm({ display_name: attendee.display_name || '', phone: attendee.phone || '' });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({ display_name: '', phone: '' }); };

  const saveEdit = async (userId) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_attendee_profile', {
        p_user_id:      userId,
        p_display_name: editForm.display_name,
        p_phone:        editForm.phone,
      });
      if (error) throw error;
      toast({ title: 'Datos actualizados' });
      setEditingId(null);
      fetchAttendees();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Lista de asistentes</h2>
            <p className="text-sm text-muted-foreground truncate">{event.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {attendees.length} {attendees.length === 1 ? 'comprador' : 'compradores'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-background transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          ) : attendees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Users className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Nadie ha comprado entradas aún</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendees.map((a) => (
                <div
                  key={a.ticket_id}
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                >
                  {editingId === a.user_id ? (
                    /* ── Edit mode ── */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Nombre completo</Label>
                          <Input
                            value={editForm.display_name}
                            onChange={(e) => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                            className="bg-card border-border text-foreground h-9 text-sm"
                            placeholder="Nombre del asistente"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Teléfono</Label>
                          <Input
                            value={editForm.phone}
                            onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                            className="bg-card border-border text-foreground h-9 text-sm"
                            placeholder="+57 300 000 0000"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => saveEdit(a.user_id)} disabled={saving}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 gap-1.5">
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground font-medium truncate">
                            {a.display_name || <span className="text-muted-foreground italic">Sin nombre</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-muted-foreground truncate">{a.email || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-muted-foreground">{a.phone || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[11px] font-mono text-muted-foreground truncate">
                            {a.wompi_reference || a.ticket_number?.slice(0, 20) || '—'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: a.ticket_status === 'used' ? 'rgba(255,255,255,0.06)' : 'rgba(34,197,94,0.1)',
                            color: a.ticket_status === 'used' ? 'rgba(255,255,255,0.3)' : '#22c55e',
                          }}>
                          {a.ticket_status === 'used' ? 'USADO' : 'VÁLIDO'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(a)}
                          title="Editar datos"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Ticket number footer */}
                  {editingId !== a.user_id && (
                    <p className="text-[10px] font-mono text-muted-foreground/40 pt-1 border-t border-border">
                      Ticket #{a.ticket_number?.slice(0, 32)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Event Manager ───────────────────────────────────────── */
const EventManager = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [attendeesEvent, setAttendeesEvent] = useState(null);

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
    setFormError('');
    try {
      const { ticket_type, featured_order: fo, ...rest } = formData;
      const payload = {
        ...rest,
        price:          formData.price         ? parseFloat(formData.price)         : null,
        tickets_total:  formData.tickets_total  ? parseInt(formData.tickets_total)   : 100,
        ticket_types: Array.isArray(editingEvent?.ticket_types) && editingEvent.ticket_types.length > 1
          ? editingEvent.ticket_types
          : [{
              name: ticket_type,
              price: formData.price ? parseFloat(formData.price) : 0,
              capacity: formData.tickets_total ? parseInt(formData.tickets_total) : 100,
            }],
        featured_order: formData.featured && fo ? parseInt(fo) : null,
        owner_id:       currentUser.id,
        status:         'upcoming',
        lineup:         formData.lineup
          ? formData.lineup.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      };

      if (editingEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEvent.id);
        if (error) throw error;
        toast({ title: 'Evento actualizado' });
      } else {
        const { data: createdEvent, error } = await supabase.from('events').insert([payload]).select('id, title, venue, city, date, image_url').single();
        if (error) throw error;
        supabase.functions.invoke('send-push', {
          body: {
            broadcast: true,
            title: 'Nuevo evento en Polyfauna',
            body: [createdEvent?.title, createdEvent?.venue || createdEvent?.city].filter(Boolean).join(' · '),
            url: `${window.location.origin}/?section=events&event=${createdEvent?.id}`,
            image: createdEvent?.image_url || undefined,
          },
        }).catch(() => {});
        toast({ title: '¡Evento publicado!' });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchEvents();
    } catch (err) {
      setFormError(err.message || 'Error al guardar el evento');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      title:          event.title || '',
      date:           event.date ? event.date.slice(0, 16) : '',
      venue:          event.venue || '',
      city:           event.city || '',
      lineup:         Array.isArray(event.lineup) ? event.lineup.join(', ') : (event.lineup || ''),
      image_url:      event.image_url || '',
      price:          event.price || '',
      description:    event.description || '',
      tickets_total:  event.tickets_total || '100',
      ticket_type:    event.ticket_types?.[0]?.name || 'General',
      featured:       event.featured || false,
      featured_order: event.featured_order != null ? String(event.featured_order) : '',
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

  const resetForm = () => { setEditingEvent(null); setFormData(EMPTY); setFormError(''); };
  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  return (
    <>
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
                      className="w-full h-10 bg-background border border-border text-foreground rounded-md px-3 [color-scheme:dark]">
                      {TICKET_TYPES.map(t => <option className="bg-[#101615] text-white" key={t} value={t}>{t}</option>)}
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

                {/* Banner destacado */}
                <div
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${formData.featured ? 'rgba(255,138,31,0.35)' : 'hsl(var(--border))'}`, transition: 'border-color 0.2s' }}
                >
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div className="relative shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={formData.featured}
                        onChange={(e) => set('featured', e.target.checked)}
                      />
                      <div
                        className="w-10 h-6 rounded-full transition-colors duration-200"
                        style={{ background: formData.featured ? 'rgba(255,138,31,0.85)' : 'rgba(255,255,255,0.1)' }}
                      />
                      <div
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                        style={{ left: formData.featured ? '22px' : '4px' }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Mostrar en banner destacado</p>
                      <p className="text-xs text-muted-foreground">Aparece en el slider principal de la sección Eventos</p>
                    </div>
                  </label>

                  {formData.featured && (
                    <div className="flex items-center gap-3 pt-1 border-t border-border">
                      <Label className="text-xs whitespace-nowrap text-muted-foreground">Posición en banner</Label>
                      <Input
                        type="number"
                        min="1"
                        max="99"
                        value={formData.featured_order}
                        onChange={(e) => set('featured_order', e.target.value)}
                        placeholder="1"
                        className="bg-background border-border text-foreground w-24 h-8 text-sm"
                      />
                      <p className="text-xs text-muted-foreground">1 = primero en el slider</p>
                    </div>
                  )}
                </div>

                {formError && (
                  <div className="rounded-lg px-4 py-3 text-sm font-medium text-red-300 text-center"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {formError}
                  </div>
                )}

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-foreground font-semibold truncate">{event.title}</p>
                      {event.featured && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: 'rgba(255,138,31,0.15)', color: 'rgba(255,138,31,0.90)', border: '1px solid rgba(255,138,31,0.25)' }}
                        >
                          Banner {event.featured_order != null ? `#${event.featured_order}` : ''}
                        </span>
                      )}
                    </div>
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
                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttendeesEvent(event)}
                      className="text-xs gap-1.5 text-muted-foreground hover:text-foreground h-8 px-3"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Ver lista
                    </Button>
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

      {attendeesEvent && (
        <AttendeesModal
          event={attendeesEvent}
          onClose={() => setAttendeesEvent(null)}
        />
      )}
    </>
  );
};

export default EventManager;
