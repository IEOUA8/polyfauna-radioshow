export const TICKET_SALES_CHANNELS = Object.freeze({
  POLYFAUNA: 'polyfauna',
  WHATSAPP: 'whatsapp',
});

export function buildDefaultWhatsAppMessage(eventTitle = '') {
  return `Hola! Deseo comprar la entrada del evento (${String(eventTitle).trim()}).`;
}

export function normalizeWhatsAppNumber(value = '') {
  return String(value).replace(/\D/g, '');
}

export function isValidWhatsAppNumber(value = '') {
  return /^[1-9][0-9]{7,14}$/.test(normalizeWhatsAppNumber(value));
}

export function usesWhatsAppTicketSales(event) {
  return event?.ticket_sales_channel === TICKET_SALES_CHANNELS.WHATSAPP;
}

export function buildWhatsAppTicketUrl(event) {
  if (!usesWhatsAppTicketSales(event)) return '';
  const number = normalizeWhatsAppNumber(event?.whatsapp_number);
  if (!isValidWhatsAppNumber(number)) return '';
  const message = String(event?.whatsapp_message || buildDefaultWhatsAppMessage(event?.title)).trim();
  if (!message) return '';
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
