import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, ExternalLink, Loader2,
  Plus, QrCode, Ticket, TrendingUp, Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { LoadingSkeleton, EmptyState, LoginRequired } from '@/components/SectionStates';
import { useToast } from '@/components/ui/use-toast';
import FormModal, { FField, FInput, FTextarea, FSelect, FImageZone, FSubmit } from '@/components/ui/FormModal';

const TICKET_TYPES = ['GA', 'VIP', 'Early Bird', 'Artist', 'Press'];

// ── Create Event modal ────────────────────────────────────────
function CreateEventModal({ onClose, onCreated }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', date: '', venue: '', city: '',
    price: '', tickets_total: '100', ticket_type: 'GA',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title || !form.date) return;
    setSaving(true);

    let image_url = null;
    if (coverFile) {
      const ext = coverFile.name.split('.').pop();
      const path = `events/${Date.now()}.${ext}`;
      const { data: up, error: upErr } = await supabase.storage
        .from('album-covers')
        .upload(path, coverFile, { upsert: true });
      if (!upErr && up) {
        const { data: { publicUrl } } = supabase.storage.from('album-covers').getPublicUrl(up.path);
        image_url = publicUrl;
      }
    }

    const { data, error } = await supabase.from('events').insert({
      title: form.title,
      description: form.description || null,
      date: form.date,
      venue: form.venue || null,
      city: form.city || null,
      price: parseFloat(form.price) || 0,
      tickets_total: parseInt(form.tickets_total) || 100,
      owner_id: currentUser.id,
      status: 'published',
      image_url,
    }).select().single();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '¡Evento publicado!', description: form.title });
      onCreated(data);
    }
    setSaving(false);
  };

  return (
    <FormModal title="Crear Evento" subtitle="Completa los datos y publica la preventa" onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleCreate} className="space-y-4">
        {/* Imagen de portada */}
        <FImageZone
          file={coverFile}
          onFile={setCoverFile}
          label="Subir imagen del evento"
          hint="JPG, PNG, WEBP · Recomendado 16:9"
          aspect="aspect-video"
        />

        {/* Grid 2 columnas */}
        <div className="grid grid-cols-2 gap-3">
          <FField label="Nombre del evento" required span={2}>
            <FInput value={form.title} onChange={e => set('title', e.target.value)} placeholder="PolyFauna: Opening Night" />
          </FField>

          <FField label="Fecha y hora" required>
            <FInput type="datetime-local" value={form.date} onChange={e => set('date', e.target.value)} />
          </FField>
          <FField label="Tipo de entrada">
            <FSelect value={form.ticket_type} onChange={e => set('ticket_type', e.target.value)}>
              {TICKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </FSelect>
          </FField>

          <FField label="Venue / Lugar">
            <FInput value={form.venue} onChange={e => set('venue', e.target.value)} placeholder="Club Razzmatazz" />
          </FField>
          <FField label="Ciudad">
            <FInput value={form.city} onChange={e => set('city', e.target.value)} placeholder="Bogotá" />
          </FField>

          <FField label="Precio (COP)">
            <FInput type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="35000" min="0" step="1000" />
          </FField>
          <FField label="Total entradas">
            <FInput type="number" value={form.tickets_total} onChange={e => set('tickets_total', e.target.value)} placeholder="100" min="1" />
          </FField>

          <FField label="Descripción" span={2}>
            <FTextarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe el evento, artistas, rooms…" rows={3} />
          </FField>

          <FSubmit loading={saving} disabled={!form.title || !form.date}>
            <Plus className="w-4 h-4" />
            {saving ? 'Publicando…' : 'Publicar Evento'}
          </FSubmit>
        </div>
      </form>
    </FormModal>
  );
}

// ── Event Card ────────────────────────────────────────────────
function EventCard({ event }) {
  const navigate = useNavigate();
  const sold = event.tickets_sold || 0;
  const total = event.tickets_total || 100;
  const pct = Math.round((sold / total) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'rgba(15,19,34,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight truncate">{event.title}</p>
          {event.date && (
            <p className="text-[11px] text-white/40 mt-0.5">
              {new Date(event.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              {event.venue && ` · ${event.venue}`}
            </p>
          )}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${event.status === 'published' ? '' : 'opacity-60'}`}
          style={{ background: event.status === 'published' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)', color: event.status === 'published' ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
          {event.status === 'published' ? 'Publicado' : event.status}
        </span>
      </div>

      {/* Ticket progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/40">Tickets vendidos</span>
          <span className="font-bold text-white">{sold} / {total}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct >= 80 ? '#F59E0B' : '#00CFFF' }} />
        </div>
        <p className="text-[10px] text-white/30">{pct}% de capacidad</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1 text-xs text-white/50">
          <Ticket className="w-3 h-3" />
          <span>{sold} vendidas</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/50">
          <TrendingUp className="w-3 h-3" />
          <span>{event.price ? `$${Number(event.price).toLocaleString('es-CO')}` : 'Gratis'}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/validate?event=${event.id}`)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors"
        style={{ background: 'rgba(0,207,255,0.08)', color: '#00CFFF', border: '1px solid rgba(0,207,255,0.2)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,207,255,0.14)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,207,255,0.08)')}
      >
        <QrCode className="w-3.5 h-3.5" />
        Validar entradas en puerta
        <ExternalLink className="w-3 h-3 opacity-50" />
      </button>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function PromoterDashboard() {
  const { currentUser } = useAuth();
  const { profile } = useProfile();
  const [showCreate, setShowCreate] = useState(false);

  const { data: myEvents, loading, refetch } = useSupabaseQuery(
    () => currentUser
      ? supabase.from('events').select('*').eq('owner_id', currentUser.id).order('date', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    [currentUser?.id]
  );

  if (!currentUser) return <div className="p-5"><LoginRequired message="Inicia sesión para acceder al dashboard." /></div>;

  const canAccess = ['promoter', 'club', 'admin'].includes(profile?.role);
  if (profile && !canAccess) {
    return (
      <div className="p-5 flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-1"
          style={{ background: 'rgba(0,207,255,0.08)' }}>
          <Users className="w-6 h-6" style={{ color: '#00CFFF' }} />
        </div>
        <p className="text-sm font-bold text-white/60">Acceso restringido</p>
        <p className="text-xs text-white/30 max-w-xs">Este panel es exclusivo para Promotores y Clubs. Edita tu perfil y cambia tu rol para solicitar acceso.</p>
      </div>
    );
  }

  const totalSold    = (myEvents || []).reduce((s, e) => s + (e.tickets_sold || 0), 0);
  const totalRevenue = (myEvents || []).reduce((s, e) => s + ((e.tickets_sold || 0) * (e.price || 0)), 0);

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Promoter Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">Gestiona tus eventos y entradas.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl"
          style={{ background: '#00CFFF', color: '#080B14' }}>
          <Plus className="w-4 h-4" />
          Nuevo Evento
        </button>
      </div>

      {/* Stats */}
      {myEvents && myEvents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Eventos',  value: myEvents.length, icon: Calendar,   color: '#00CFFF' },
            { label: 'Tickets',  value: totalSold,        icon: Ticket,     color: '#A78BFA' },
            { label: 'Ingresos', value: `$${totalRevenue.toLocaleString('es-CO')}`, icon: TrendingUp, color: '#34D399' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: 'rgba(15,19,34,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Icon className="w-4 h-4 mb-2" style={{ color }} />
              <p className="text-lg font-black text-white">{value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Events list */}
      {loading && <LoadingSkeleton rows={3} />}
      {!loading && (!myEvents || myEvents.length === 0) && (
        <EmptyState label="Aún no has creado eventos" icon={Calendar} />
      )}
      {!loading && myEvents && myEvents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myEvents.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateEventModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
