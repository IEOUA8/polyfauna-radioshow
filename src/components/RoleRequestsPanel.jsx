import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Clock, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';
import { useToast } from '@/components/ui/use-toast';

const ROLE_LABELS = {
  artist:   { label: 'Artista',             color: '#A855F7' },
  promoter: { label: 'Promotor',            color: '#F97316' },
  club:     { label: 'Club / Venue',        color: '#EF4444' },
  sello:    { label: 'Sello Discográfico',  color: '#10B981' },
};

const STATUS_LABELS = {
  pending:  { label: 'Pendiente', color: '#F59E0B' },
  approved: { label: 'Aprobado',  color: '#10B981' },
  rejected: { label: 'Rechazado', color: '#EF4444' },
};

function RequestCard({ req, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading]   = useState(null);
  const [reason, setReason]     = useState('');
  const { toast } = useToast();

  const roleInfo   = ROLE_LABELS[req.requested_role] || { label: req.requested_role, color: '#888' };
  const statusInfo = STATUS_LABELS[req.status]       || { label: req.status, color: '#888' };

  const handle = async (action) => {
    setLoading(action);
    const updates = {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      ...(action === 'reject' && reason.trim() ? { rejection_reason: reason.trim() } : {}),
    };

    const { error: reqErr } = await supabase
      .from('role_requests')
      .update(updates)
      .eq('id', req.id);

    if (reqErr) {
      toast({ title: 'Error', description: reqErr.message, variant: 'destructive' });
      setLoading(null);
      return;
    }

    if (action === 'approve') {
      await supabase
        .from('profiles')
        .update({ role: req.requested_role })
        .eq('id', req.user_id);
    }

    // Send decision email (email comes from form_data since profiles has no email column)
    const userEmail = req.form_data?.email;
    if (userEmail) {
      supabase.functions.invoke('send-role-decision', {
        body: {
          userEmail,
          userName: req.profiles?.display_name || req.form_data?.name || 'Usuario',
          requestedRole: req.requested_role,
          decision: action === 'approve' ? 'approved' : 'rejected',
          rejectionReason: action === 'reject' ? reason.trim() : null,
        },
      }).catch(() => {});
    }

    toast({
      title: action === 'approve' ? 'Solicitud aprobada' : 'Solicitud rechazada',
      description: `${req.profiles?.display_name || 'Usuario'} → ${roleInfo.label}`,
    });

    onAction();
    setLoading(null);
  };

  const formData = req.form_data || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(11,16,15,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black"
          style={{ background: `${roleInfo.color}18`, color: roleInfo.color }}>
          {(req.profiles?.display_name || '?')[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {req.profiles?.display_name || req.form_data?.name || 'Usuario'}
          </p>
          <p className="text-xs text-white/40 truncate">{req.form_data?.email}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: `${roleInfo.color}18`, color: roleInfo.color }}>
            {roleInfo.label}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: `${statusInfo.color}14`, color: statusInfo.color }}>
            {statusInfo.label}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {/* Expanded detail + actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="pt-3 space-y-1.5 text-xs text-white/50">
                <p><span className="text-white/30">Fecha:</span> {new Date(req.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                {formData.name  && <p><span className="text-white/30">Nombre:</span> {formData.name}</p>}
                {formData.email && <p><span className="text-white/30">Email:</span> {formData.email}</p>}
                {req.rejection_reason && (
                  <p><span className="text-white/30">Motivo rechazo:</span> {req.rejection_reason}</p>
                )}
              </div>

              {req.status === 'pending' && (
                <div className="space-y-2 pt-1">
                  <input
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Motivo de rechazo (opcional)"
                    className="w-full text-xs px-3 py-2 rounded-lg outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'white' }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handle('approve')}
                      disabled={!!loading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}
                    >
                      {loading === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => handle('reject')}
                      disabled={!!loading}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.22)' }}
                    >
                      {loading === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Rechazar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function RoleRequestsPanel() {
  const [filter, setFilter] = useState('pending');

  const { data: requests, loading, refetch } = useSupabaseQuery(
    () => supabase
      .from('role_requests')
      .select('*, profiles(display_name, avatar_url)')
      .eq('status', filter)
      .order('created_at', { ascending: false }),
    [filter]
  );

  const filters = [
    { id: 'pending',  label: 'Pendientes' },
    { id: 'approved', label: 'Aprobados'  },
    { id: 'rejected', label: 'Rechazados' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white">Solicitudes de rol</h3>
        <span className="text-xs text-white/30">{(requests || []).length} resultados</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {filters.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: filter === f.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
              color: filter === f.id ? 'white' : 'rgba(255,255,255,0.35)',
              border: `1px solid ${filter === f.id ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-white/30" />
        </div>
      )}

      {!loading && (requests || []).length === 0 && (
        <div className="text-center py-10">
          <Clock className="w-8 h-8 text-white/15 mx-auto mb-3" />
          <p className="text-sm text-white/30">No hay solicitudes {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobadas' : 'rechazadas'}</p>
        </div>
      )}

      <div className="space-y-2">
        {(requests || []).map(req => (
          <RequestCard key={req.id} req={req} onAction={refetch} />
        ))}
      </div>
    </div>
  );
}
