import React, { useState } from 'react';
import { Loader2, Mail, AlertTriangle } from 'lucide-react';
import { ModalShell, ModalHeader } from './AdminModal';

export function TransferTicketModal({ ticket, eventTitle, onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const accent = '#20C7E8';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || saving) return;
    setSaving(true);
    await onSubmit(email.trim());
    setSaving(false);
  };

  return (
    <ModalShell onClose={onClose} accent={accent}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <ModalHeader
          icon={Mail}
          accent={accent}
          title="Transferir ticket"
          subtitle={`${eventTitle} · #${ticket.ticket_number?.slice(0, 12)}`}
          onClose={onClose}
        />

        <label className="block space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Correo del nuevo destinatario</span>
          <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="destinatario@correo.com"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)' }} />
          <span className="block text-[10px] text-white/28">
            Recibirá el mismo código QR por correo, con el mismo número de ticket. Si aún no tiene cuenta en Polyfauna, se le invita a crear una para activarlo; si ya tiene cuenta, queda listo de inmediato en su Ticket Vault.
          </span>
        </label>

        <button type="submit" disabled={saving || !email.trim()}
          className="w-full rounded-xl py-3 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: accent, color: '#031014' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {saving ? 'Enviando…' : 'Enviar QR'}
        </button>
      </form>
    </ModalShell>
  );
}

export function VoidTicketModal({ ticket, eventTitle, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const accent = '#FF6B6B';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    await onSubmit(reason.trim() || undefined);
    setSaving(false);
  };

  return (
    <ModalShell onClose={onClose} accent={accent}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <ModalHeader
          icon={AlertTriangle}
          accent={accent}
          title="Anular ticket"
          subtitle={`${eventTitle} · #${ticket.ticket_number?.slice(0, 12)}`}
          onClose={onClose}
        />

        <div className="rounded-xl p-3" style={{ background: `${accent}0F`, border: `1px solid ${accent}30` }}>
          <p className="text-xs" style={{ color: '#FFB4B4' }}>
            El código QR dejará de servir para entrar y el cupo del evento se libera. Esta acción no se puede deshacer.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Motivo (opcional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. correo equivocado, duplicado…"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)' }} />
        </label>

        <button type="submit" disabled={saving}
          className="w-full rounded-xl py-3 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: accent, color: '#2A0A0A' }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          {saving ? 'Anulando…' : 'Anular ticket'}
        </button>
      </form>
    </ModalShell>
  );
}
