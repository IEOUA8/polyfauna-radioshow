import React, { useState, useEffect } from 'react';
import supabase from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Loader2, Ticket, Users, X, Save, Mail, Phone, User, Hash, IdCard, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UploadField } from './UploadField';
import ArtistMentionInput from '@/components/ArtistMentionInput';
import { TransferTicketModal, VoidTicketModal } from './TicketActionModals';

const EMPTY = {
  title: '', date: '', ends_at: '', venue: '', city: '', lineup: [],
  image_url: '', description: '', courtesy_limit: '0',
  featured: false, featured_order: '',
};

const TICKET_TYPES = ['General', 'VIP', 'Early', 'Anytime', 'Gratis'];
const FREE_TICKET_TYPES = new Set(['Gratis']);
const DEFAULT_TICKET_TYPES = [{ name: 'General', price: '', capacity: '100' }];

/* ── Attendees Modal ─────────────────────────────────────── */
function AttendeesModal({ event, onClose }) {
  const { toast } = useToast();
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ display_name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);

  // Solo tickets manuales/cortesia (sin referencia Wompi real) pueden
  // anularse o transferirse desde aqui; los pagados por pasarela usan
  // el flujo de devoluciones.
  const isVoidable = (a) => !a.wompi_reference || a.wompi_reference.startsWith('BANK-');

  const submitVoid = async (reason) => {
    try {
      const { data, error } = await supabase.functions.invoke('void-ticket', {
        body: { ticketId: voidTarget.ticket_id, reason },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'No fue posible anular el ticket');
      toast({ title: 'Ticket anulado', description: `#${data.ticketNumber} · total anulados: ${data.ticketsVoidedTotal}` });
      setVoidTarget(null);
      fetchAttendees();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const submitTransfer = async (newEmail) => {
    try {
      const { data, error } = await supabase.functions.invoke('transfer-ticket', {
        body: { ticketId: transferTarget.ticket_id, newEmail },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || 'No fue posible transferir el ticket');
      toast({
        title: 'Ticket transferido',
        description: data.pending
          ? `#${data.ticketNumber} · el destinatario debe crear su cuenta para activarlo`
          : `#${data.ticketNumber} · notificado por correo${data.notificationSent ? ' y dentro de la plataforma' : ''}`,
      });
      setTransferTarget(null);
      fetchAttendees();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

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
                        <div className="flex items-center gap-2 min-w-0 sm:col-span-2">
                          <IdCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm text-muted-foreground">
                            {a.full_name || 'Identidad pendiente'}
                            {a.document_number ? ` · ${a.document_type || 'Documento'} ${a.document_number}` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: ['used', 'cancelled'].includes(a.ticket_status)
                              ? 'rgba(255,255,255,0.06)'
                              : a.ticket_status === 'pending_registration'
                                ? 'rgba(167,139,250,0.14)'
                                : 'rgba(34,197,94,0.1)',
                            color: ['used', 'cancelled'].includes(a.ticket_status)
                              ? 'rgba(255,255,255,0.3)'
                              : a.ticket_status === 'pending_registration'
                                ? '#A78BFA'
                                : '#22c55e',
                          }}>
                          {a.ticket_status === 'used' ? 'USADO'
                            : a.ticket_status === 'cancelled' ? 'ANULADO'
                              : a.ticket_status === 'pending_registration' ? 'PENDIENTE' : 'VÁLIDO'}
                        </span>
                        {isVoidable(a) && ['valid', 'pending_registration'].includes(a.ticket_status) && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setTransferTarget(a)}
                              title="Transferir a otro correo"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setVoidTarget(a)}
                              title="Anular ticket"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
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

      {transferTarget && (
        <TransferTicketModal
          ticket={transferTarget}
          eventTitle={event.title}
          onClose={() => setTransferTarget(null)}
          onSubmit={submitTransfer}
        />
      )}
      {voidTarget && (
        <VoidTicketModal
          ticket={voidTarget}
          eventTitle={event.title}
          onClose={() => setVoidTarget(null)}
          onSubmit={submitVoid}
        />
      )}
    </div>
  );
}

/* ── Co-promotores ────────────────────────────────────────── */
const CO_PROMOTER_ERRORS = {
  user_not_found: 'No hay ninguna cuenta con ese correo',
  invalid_role: 'Ese usuario no tiene rol de Promotor o Club',
  cannot_link_owner: 'No puedes vincularte a ti mismo como co-promotor',
  not_authorized: 'No tienes permiso para vincular co-promotores en este evento',
};

function CoPromotersManager({ eventId }) {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('event_co_promoters')
      .select('id, promoter_id, ref_code')
      .eq('event_id', eventId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    const rows = data || [];
    if (rows.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', rows.map(row => row.promoter_id));
      const byId = Object.fromEntries((profs || []).map(p => [p.id, p.display_name]));
      setList(rows.map(row => ({ ...row, display_name: byId[row.promoter_id] || null })));
    } else {
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.rpc('add_event_co_promoter', { p_event_id: eventId, p_email: email.trim() });
      if (error) throw error;
      toast({ title: 'Co-promotor vinculado', description: 'Se le notificó dentro de la plataforma y por correo.' });
      setEmail('');
      load();
      if (data?.promoter_id) {
        supabase.functions.invoke('notify-co-promoter-linked', {
          body: { eventId, promoterId: data.promoter_id },
        }).catch(() => {});
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: CO_PROMOTER_ERRORS[err.message] || err.message });
    } finally {
      setAdding(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      const { error } = await supabase.rpc('revoke_event_co_promoter', { p_id: id });
      if (error) throw error;
      toast({ title: 'Co-promotor revocado' });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const copyLink = (refCode) => {
    const url = `${window.location.origin}/e/${eventId}?ref=${refCode}`;
    navigator.clipboard?.writeText(url);
    toast({ title: 'Link copiado' });
  };

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid hsl(var(--border))' }}>
      <div>
        <Label>Co-promotores</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Vincula promotores o clubes que puedan vender tickets de este evento y emitir tickets manuales, sin poder editarlo.
        </p>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com" className="bg-background border-border text-foreground" />
        <Button type="submit" disabled={adding} className="shrink-0">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vincular'}
        </Button>
      </form>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no hay co-promotores vinculados.</p>
      ) : (
        <div className="space-y-2">
          {list.map(row => (
            <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-sm text-foreground truncate">{row.display_name || 'Promotor'}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button type="button" variant="ghost" size="sm" onClick={() => copyLink(row.ref_code)} className="text-xs h-7 px-2 gap-1.5">
                  <Copy className="w-3 h-3" /> Copiar link
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => handleRevoke(row.id)}
                  className="text-destructive hover:text-destructive/80 h-7 w-7" title="Revocar">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Event Manager ───────────────────────────────────────── */
const EventManager = ({ ownerId = null, isAdmin = false }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [ticketTypes, setTicketTypes] = useState(DEFAULT_TICKET_TYPES);
  const [ticketSales, setTicketSales] = useState({});
  const [loadingTicketSales, setLoadingTicketSales] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [attendeesEvent, setAttendeesEvent] = useState(null);

  useEffect(() => { fetchEvents(); }, [ownerId]);

  const fetchEvents = async () => {
    try {
      // Propios: siempre. Co-promovidos: solo si hay vínculos activos, en una
      // segunda consulta aparte — evita depender de un filtro .or() armado a mano.
      const ownEventsQuery = ownerId
        ? supabase.from('events').select('*').eq('owner_id', ownerId).order('date', { ascending: false })
        : supabase.from('events').select('*').order('date', { ascending: false });

      const [{ data: ownEvents, error: ownError }, { data: linked }] = await Promise.all([
        ownEventsQuery,
        ownerId
          ? supabase.from('event_co_promoters').select('event_id, ref_code').eq('promoter_id', ownerId).eq('status', 'active')
          : Promise.resolve({ data: [] }),
      ]);
      if (ownError) throw ownError;

      const byId = new Map((ownEvents || []).map(event => [event.id, { ...event, _coPromoterRef: null }]));
      const linkedIds = (linked || []).map(row => row.event_id).filter(id => !byId.has(id));
      if (linkedIds.length) {
        const { data: coPromotedEvents, error: coError } = await supabase
          .from('events')
          .select('*')
          .in('id', linkedIds);
        if (coError) throw coError;
        const refByEventId = Object.fromEntries((linked || []).map(row => [row.event_id, row.ref_code]));
        (coPromotedEvents || []).forEach(event => byId.set(event.id, { ...event, _coPromoterRef: refByEventId[event.id] }));
      }

      setEvents([...byId.values()].sort((a, b) => new Date(b.date) - new Date(a.date)));
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
      const normalizedTicketTypes = ticketTypes.map(ticket => ({
        name: ticket.name,
        price: FREE_TICKET_TYPES.has(ticket.name) ? 0 : Math.max(0, Number(ticket.price) || 0),
        capacity: Math.max(0, parseInt(ticket.capacity, 10) || 0),
      }));
      const invalidTicket = normalizedTicketTypes.find((ticket, index) =>
        ticket.capacity < Math.max(1, ticketSales[ticket.name] || 0)
        || (!FREE_TICKET_TYPES.has(ticket.name) && (
          ticketTypes[index].price === '' || Number(ticketTypes[index].price) < 0
        ))
      );
      if (!normalizedTicketTypes.length || invalidTicket) {
        throw new Error('Revisa el precio y el cupo de cada tipo de entrada. El cupo no puede ser menor a los tickets ya emitidos.');
      }

      const courtesyLimit = Math.max(0, parseInt(formData.courtesy_limit, 10) || 0);
      if (courtesyLimit < (editingEvent?.courtesies_issued || 0)) {
        throw new Error(`El evento ya tiene ${editingEvent.courtesies_issued} cortesías emitidas.`);
      }
      const publicCapacity = normalizedTicketTypes.reduce((sum, ticket) => sum + ticket.capacity, 0);
      const ticketsTotal = publicCapacity + courtesyLimit;
      if (ticketsTotal < (editingEvent?.tickets_sold || 0)) {
        throw new Error(`La capacidad no puede ser menor a ${editingEvent.tickets_sold} tickets ya emitidos.`);
      }

      const { featured_order: fo, ...rest } = formData;
      const payload = {
        ...rest,
        price: Math.min(...normalizedTicketTypes.map(ticket => ticket.price)),
        tickets_total: ticketsTotal,
        courtesy_limit: courtesyLimit,
        ticket_types: normalizedTicketTypes,
        featured_order: formData.featured && fo ? parseInt(fo) : null,
        owner_id: editingEvent?.owner_id || currentUser.id,
        status: editingEvent?.status || 'upcoming',
        lineup:         formData.lineup || [],
      };

      if (!formData.ends_at || new Date(formData.ends_at) <= new Date(formData.date)) {
        throw new Error('La fecha de finalización debe ser posterior al inicio.');
      }

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
      if (err.code === '23505' && err.message?.includes('events_owner_title_day_unique')) {
        const dateLabel = formData.date
          ? new Date(formData.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
          : 'esa fecha';
        setFormError(`Ya tienes un evento llamado "${formData.title}" programado el ${dateLabel}. Si es una reedición, cambia el título o edita el evento existente en vez de crear uno nuevo.`);
      } else {
        setFormError(err.message || 'Error al guardar el evento');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (event) => {
    const publicCapacity = Math.max(1, (event.tickets_total || 100) - (event.courtesy_limit || 0));
    const existingTicketTypes = Array.isArray(event.ticket_types) && event.ticket_types.length > 0
      ? event.ticket_types
      : [{ name: 'General', price: event.price || 0, capacity: publicCapacity }];
    setEditingEvent(event);
    setTicketTypes(existingTicketTypes.map(ticket => ({
      name: ticket.name || 'General',
      price: String(FREE_TICKET_TYPES.has(ticket.name) ? 0 : (ticket.price ?? event.price ?? '')),
      capacity: String(ticket.capacity || publicCapacity),
    })));
    setTicketSales({});
    setFormData({
      title:          event.title || '',
      date:           event.date ? event.date.slice(0, 16) : '',
      ends_at:        event.ends_at ? event.ends_at.slice(0, 16) : '',
      venue:          event.venue || '',
      city:           event.city || '',
      lineup:         event.lineup || [],
      image_url:      event.image_url || '',
      description:    event.description || '',
      courtesy_limit: String(event.courtesy_limit || 0),
      featured:       event.featured || false,
      featured_order: event.featured_order != null ? String(event.featured_order) : '',
    });
    setIsDialogOpen(true);
    setLoadingTicketSales(true);
    const { data, error } = await supabase
      .from('user_tickets')
      .select('ticket_type')
      .eq('event_id', event.id)
      .neq('status', 'refunded');
    if (error) {
      toast({ variant: 'destructive', title: 'No se pudo cargar el inventario vendido', description: error.message });
    } else {
      setTicketSales((data || []).reduce((counts, ticket) => {
        const type = ticket.ticket_type || 'General';
        counts[type] = (counts[type] || 0) + 1;
        return counts;
      }, {}));
    }
    setLoadingTicketSales(false);
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

  const resetForm = () => {
    setEditingEvent(null);
    setFormData(EMPTY);
    setTicketTypes(DEFAULT_TICKET_TYPES);
    setTicketSales({});
    setLoadingTicketSales(false);
    setFormError('');
  };
  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));
  const updateTicketType = (index, key, value) => {
    setTicketTypes(current => current.map((ticket, i) => i === index ? { ...ticket, [key]: value } : ticket));
  };
  const addTicketType = (name) => {
    setTicketTypes(current => current.some(ticket => ticket.name === name)
      ? current
      : [...current, { name, price: FREE_TICKET_TYPES.has(name) ? '0' : '', capacity: '50' }]);
  };
  const removeTicketType = (name) => {
    if (ticketSales[name]) return;
    setTicketTypes(current => current.length === 1 ? current : current.filter(ticket => ticket.name !== name));
  };

  const normalizedTicketTypes = ticketTypes.map(ticket => ({
    name: ticket.name,
    price: FREE_TICKET_TYPES.has(ticket.name) ? 0 : Math.max(0, Number(ticket.price) || 0),
    capacity: Math.max(0, parseInt(ticket.capacity, 10) || 0),
  }));
  const ticketTypesValid = normalizedTicketTypes.length > 0
    && normalizedTicketTypes.every((ticket, index) =>
      ticket.capacity >= Math.max(1, ticketSales[ticket.name] || 0)
      && (FREE_TICKET_TYPES.has(ticket.name) || (
        ticketTypes[index].price !== '' && Number(ticketTypes[index].price) >= 0
      ))
    );

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
            <DialogContent className="bg-card border-border text-foreground max-w-3xl w-[calc(100vw-2rem)] sm:w-full max-h-[90dvh] overflow-y-auto overflow-x-hidden pb-28">
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
                  pathPrefix={`events/${currentUser.id}/`}
                />

                {/* Título */}
                <div>
                  <Label>Título *</Label>
                  <Input value={formData.title} onChange={(e) => set('title', e.target.value)}
                    className="bg-background border-border text-foreground" required />
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Inicio *</Label>
                    <Input type="datetime-local" value={formData.date} onChange={(e) => set('date', e.target.value)}
                      className="bg-background border-border text-foreground" required />
                  </div>
                  <div>
                    <Label>Final *</Label>
                    <Input type="datetime-local" value={formData.ends_at} min={formData.date || undefined}
                      onChange={(e) => set('ends_at', e.target.value)}
                      className="bg-background border-border text-foreground" required />
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

                {/* Tipos de entrada */}
                <div className="space-y-3 rounded-xl p-4 border border-border bg-background/40">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Label>Tipos de entrada</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Agrega, edita precios y ajusta cupos sin bajar del inventario ya emitido.
                      </p>
                    </div>
                    <div className="w-36 shrink-0">
                      <Label>Cupos de cortesía</Label>
                      <Input type="number" value={formData.courtesy_limit} onChange={(e) => set('courtesy_limit', e.target.value)}
                        className="bg-background border-border text-foreground mt-1" placeholder="0"
                        min={editingEvent?.courtesies_issued || 0} />
                      {(editingEvent?.courtesies_issued || 0) > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {editingEvent.courtesies_issued} emitidas
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {TICKET_TYPES.map(name => {
                      const active = ticketTypes.some(ticket => ticket.name === name);
                      const hasSales = (ticketSales[name] || 0) > 0;
                      return (
                        <button key={name} type="button"
                          onClick={() => active ? removeTicketType(name) : addTicketType(name)}
                          disabled={active && (ticketTypes.length === 1 || hasSales)}
                          className="rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:opacity-45"
                          style={{
                            background: active ? 'rgba(32,199,232,0.13)' : 'rgba(255,255,255,0.04)',
                            color: active ? '#8BEAFF' : 'rgba(255,255,255,0.55)',
                            border: active ? '1px solid rgba(32,199,232,0.32)' : '1px solid rgba(255,255,255,0.09)',
                          }}>
                          {active ? '✓ ' : '+ '}{name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    {ticketTypes.map((ticket, index) => {
                      const sold = ticketSales[ticket.name] || 0;
                      const isFree = FREE_TICKET_TYPES.has(ticket.name);
                      return (
                        <div key={ticket.name} className="grid grid-cols-1 sm:grid-cols-[minmax(100px,1fr)_1fr_1fr_auto] gap-3 items-end rounded-xl p-3"
                          style={{ background: 'rgba(4,10,10,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div className="self-center">
                            <p className="text-sm font-bold text-foreground">{ticket.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {sold > 0 ? `${sold} emitidos` : isFree ? 'Sin costo' : 'Sin ventas'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs">Precio COP</Label>
                            <Input type="number" value={ticket.price}
                              onChange={(e) => updateTicketType(index, 'price', e.target.value)}
                              className="bg-background border-border text-foreground mt-1"
                              placeholder="35000" min="0" step="1000" disabled={isFree}
                              aria-label={`Precio ${ticket.name}`} />
                          </div>
                          <div>
                            <Label className="text-xs">Cupo</Label>
                            <Input type="number" value={ticket.capacity}
                              onChange={(e) => updateTicketType(index, 'capacity', e.target.value)}
                              className="bg-background border-border text-foreground mt-1"
                              placeholder="100" min={Math.max(1, sold)}
                              aria-label={`Cupo ${ticket.name}`} />
                          </div>
                          <Button type="button" variant="ghost" size="icon"
                            onClick={() => removeTicketType(ticket.name)}
                            disabled={ticketTypes.length === 1 || sold > 0}
                            className="text-destructive hover:text-destructive/80 disabled:opacity-25"
                            title={sold > 0 ? 'No se puede eliminar un tipo con tickets emitidos' : `Eliminar ${ticket.name}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lineup */}
                <div>
                  <Label>DJs / Artistas</Label>
                  <ArtistMentionInput value={formData.lineup} onChange={lineup => set('lineup', lineup)} />
                </div>

                {/* Descripción */}
                <div>
                  <Label>Descripción</Label>
                  <textarea value={formData.description} onChange={(e) => set('description', e.target.value)}
                    rows={3} placeholder="Describe el evento…"
                    className="w-full bg-background border border-border text-foreground rounded-md px-3 py-2 text-sm resize-none" />
                </div>

                {/* Banner destacado — solo el administrador puede activarlo (events_featured_admin_guard) */}
                {isAdmin && (
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
                )}

                {formError && (
                  <div className="rounded-lg px-4 py-3 text-sm font-medium text-red-300 text-center"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {formError}
                  </div>
                )}

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                  disabled={saving || loadingTicketSales || !ticketTypesValid}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {loadingTicketSales ? 'Cargando inventario…' : editingEvent ? 'Guardar todos los cambios' : 'Crear Evento'}
                </Button>
              </form>

              {editingEvent && <CoPromotersManager eventId={editingEvent.id} />}
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
              {events.map((event) => {
                const canEdit = isAdmin || event.owner_id === currentUser?.id;
                return (
                <div key={event.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-background rounded-xl border border-border">
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
                      {!canEdit && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: 'rgba(96,165,250,0.15)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.25)' }}
                        >
                          Co-promotor
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
                  <div className="flex gap-1.5 shrink-0 flex-wrap sm:justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttendeesEvent(event)}
                      className="text-xs gap-1.5 text-muted-foreground hover:text-foreground h-8 px-3"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Ver lista
                    </Button>
                    {canEdit ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(event)}
                          className="text-xs gap-1.5 text-secondary hover:text-secondary/80 border-secondary/25">
                          <Edit className="w-4 h-4" />
                          Editar evento
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(event.id)} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/e/${event.id}?ref=${event._coPromoterRef}`;
                          navigator.clipboard?.writeText(url);
                          toast({ title: 'Link copiado' });
                        }}
                        className="text-xs gap-1.5 text-secondary hover:text-secondary/80 border-secondary/25">
                        <Copy className="w-3.5 h-3.5" />
                        Copiar mi link
                      </Button>
                    )}
                  </div>
                </div>
                );
              })}
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
