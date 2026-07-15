export const EVENT_TERMINAL_RETENTION_MS = 5 * 60 * 60 * 1000;

function toMillis(value) {
  if (!value) return null;
  const millis = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(millis) ? millis : null;
}

export function getEventTerminalExpiry(event) {
  const eventEnd = toMillis(event?.ends_at);
  if (eventEnd !== null) return eventEnd + EVENT_TERMINAL_RETENTION_MS;

  const eventStart = toMillis(event?.date);
  return eventStart === null ? null : eventStart + EVENT_TERMINAL_RETENTION_MS;
}

export function isEventVisibleInTerminal(event, now = Date.now()) {
  if (!event) return false;
  if (event.status && !['published', 'upcoming', 'live'].includes(event.status)) return false;
  const expiresAt = getEventTerminalExpiry(event);
  return expiresAt === null || toMillis(now) < expiresAt;
}

export function getTicketSaleEnd(ticket, event) {
  return toMillis(ticket?.sales_end_at) ?? toMillis(event?.date);
}

export function isTicketSaleOpen(ticket, event, now = Date.now()) {
  const saleEnd = getTicketSaleEnd(ticket, event);
  return saleEnd === null || toMillis(now) <= saleEnd;
}

export function hasOpenTicketSales(event, now = Date.now()) {
  const ticketTypes = Array.isArray(event?.ticket_types) && event.ticket_types.length > 0
    ? event.ticket_types.filter(ticket => ticket?.active !== false)
    : [{ name: 'General', sales_end_at: event?.date }];
  return ticketTypes.some(ticket => Number(ticket?.capacity ?? 1) > 0 && isTicketSaleOpen(ticket, event, now));
}

export function getEarlyEntryRule(ticket, now = Date.now()) {
  if (!/^early$/i.test(String(ticket?.name || ''))) return { expired: false };
  const cutoff = toMillis(ticket?.entry_cutoff_at);
  if (cutoff === null || toMillis(now) <= cutoff) return { expired: false, cutoff };
  return {
    expired: true,
    cutoff,
    lateEntryFee: Math.max(0, Number(ticket?.late_entry_fee) || 0),
  };
}
