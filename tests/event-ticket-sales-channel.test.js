import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDefaultWhatsAppMessage,
  buildWhatsAppTicketUrl,
  isValidWhatsAppNumber,
  normalizeWhatsAppNumber,
  usesWhatsAppTicketSales,
} from '../src/lib/eventTicketSales.js';

const read = (path) => readFileSync(path, 'utf8');
const eventManager = read('src/components/admin/EventManager.jsx');
const eventTerminal = read('src/components/EventTerminal.jsx');
const createPayment = read('supabase/functions/create-payment/index.ts');
const claimFreeTicket = read('supabase/functions/claim-free-ticket/index.ts');
const migration = read('supabase/migrations/20260720120000_event_ticket_sales_channel.sql');

test('el mensaje predeterminado incluye automáticamente el nombre del evento', () => {
  assert.equal(
    buildDefaultWhatsAppMessage('Fauna Nocturna'),
    'Hola! Deseo comprar la entrada del evento (Fauna Nocturna).',
  );
});

test('el enlace de WhatsApp normaliza el número y codifica el mensaje', () => {
  const event = {
    title: 'Fauna Nocturna',
    ticket_sales_channel: 'whatsapp',
    whatsapp_number: '+57 300 123 4567',
    whatsapp_message: '',
  };
  assert.equal(normalizeWhatsAppNumber(event.whatsapp_number), '573001234567');
  assert.equal(isValidWhatsAppNumber(event.whatsapp_number), true);
  assert.equal(usesWhatsAppTicketSales(event), true);
  const url = new URL(buildWhatsAppTicketUrl(event));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/573001234567');
  assert.equal(url.searchParams.get('text'), 'Hola! Deseo comprar la entrada del evento (Fauna Nocturna).');
});

test('el modal permite elegir pasarela o WhatsApp y explica la emisión manual del QR', () => {
  assert.match(eventManager, /Pasarela de pagos Polyfauna/);
  assert.match(eventManager, /Venta directa por WhatsApp/);
  assert.match(eventManager, /Número de WhatsApp \*/);
  assert.match(eventManager, /Mensaje predeterminado \*/);
  assert.match(eventManager, /emisión manual del panel para enviar el ticket QR/);
  assert.match(eventManager, /ticket_sales_channel: ticketSalesChannel/);
});

test('todos los CTA públicos mantienen el texto Comprar Ticket y WhatsApp evita el modal', () => {
  assert.match(eventTerminal, /buildWhatsAppTicketUrl/);
  assert.match(eventTerminal, /window\.open\(whatsappUrl, '_blank', 'noopener,noreferrer'\)/);
  assert.match(eventTerminal, /onBuy=\{handleTicketPurchase\}/);
  assert.doesNotMatch(eventTerminal, /\{salesOpen \? 'Comprar' : 'Venta cerrada'\}/);
  assert.doesNotMatch(eventTerminal, /\{salesOpen \? 'Comprar Ticket' : 'Venta digital cerrada'\}/);
});

test('base de datos y funciones impiden usar la pasarela en eventos de WhatsApp', () => {
  assert.match(migration, /ticket_sales_channel IN \('polyfauna', 'whatsapp'\)/);
  assert.match(migration, /COALESCE\(whatsapp_number ~/);
  assert.match(migration, /btrim\(COALESCE\(whatsapp_message, ''\)\)/);
  assert.match(migration, /WHATSAPP_SALES_ONLY/);
  assert.match(migration, /purchase_ticket_visibility_impl/);
  assert.match(createPayment, /event\.ticket_sales_channel !== 'polyfauna'/);
  assert.match(createPayment, /WHATSAPP_SALES_ONLY/);
  assert.match(claimFreeTicket, /event\.ticket_sales_channel !== 'polyfauna'/);
  assert.match(claimFreeTicket, /WHATSAPP_SALES_ONLY/);
});
