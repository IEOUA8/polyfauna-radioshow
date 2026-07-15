import { getEarlyEntryRule } from './eventTicketRules.js';

export function evaluateOfflineTicket({ verified, eventId, pack, locallyUsed, now = Date.now() }) {
  if (!eventId) return { code: 'OFFLINE_NO_EVENT', error: 'Selecciona un evento antes de trabajar sin conexión' };
  if (!verified?.valid) return { code: 'OFFLINE_UNSIGNED', error: verified?.error || 'Este QR no tiene firma offline' };
  if (verified.payload.eid !== eventId) return { code: 'WRONG_EVENT', error: 'El ticket pertenece a otro evento' };
  if (!pack) return { code: 'OFFLINE_NOT_READY', error: 'Este evento no fue descargado para uso offline' };

  const ticket = pack.tickets?.find(item => item.id === verified.payload.tid);
  if (!ticket) return { code: 'NOT_FOUND', error: 'El ticket no aparece en el paquete descargado' };
  if (ticket.status === 'used') return { code: 'ALREADY_USED', error: 'El ticket ya estaba usado al descargar el paquete', ...ticket };
  if (ticket.status === 'pending_registration') {
    return { code: 'PENDING_REGISTRATION', error: 'Ticket pendiente de activación: el destinatario debe crear su cuenta en Polyfauna antes de poder validar este QR', ...ticket };
  }
  if (ticket.status !== 'valid') return { code: 'INVALID_STATUS', error: `Ticket no vigente: ${ticket.status}`, ...ticket };
  if (locallyUsed) return { code: 'ALREADY_USED', error: 'Ticket ya escaneado en este dispositivo', ...ticket };

  const earlyRule = getEarlyEntryRule({
    name: ticket.type,
    entry_cutoff_at: ticket.entry_cutoff_at,
    late_entry_fee: ticket.late_entry_fee,
  }, now);
  if (earlyRule.expired) {
    return {
      code: 'EARLY_ENTRY_WINDOW_EXPIRED',
      error: 'Ticket Early fuera de su horario de ingreso. Debe pagar el recargo indicado antes de ingresar.',
      offline: true,
      ticket_id: ticket.id,
      event_id: eventId,
      late_entry_fee: earlyRule.lateEntryFee,
      entry_cutoff_at: ticket.entry_cutoff_at,
      event_title: pack.eventTitle,
      ticket_type: ticket.type,
      ticket_number: ticket.number,
      full_name: ticket.full_name,
      document_type: ticket.document_type,
      document_number: ticket.document_number,
    };
  }

  return {
    code: 'VALID',
    success: true,
    offline: true,
    pendingSync: true,
    event_title: pack.eventTitle,
    ticket_type: ticket.type,
    ticket_number: ticket.number,
    full_name: ticket.full_name,
    document_type: ticket.document_type,
    document_number: ticket.document_number,
  };
}
