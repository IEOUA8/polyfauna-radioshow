import { supabase } from '@/lib/customSupabaseClient';
import { verifySignedTicketQR } from '@/lib/tickets';

const DB_NAME = 'polyfauna-entry-control';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('packs')) db.createObjectStore('packs', { keyPath: 'eventId' });
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'scanId' });
      if (!db.objectStoreNames.contains('used')) db.createObjectStore('used', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function request(storeName, mode, operation) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = operation(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

function all(store) {
  return request(store, 'readonly', objectStore => objectStore.getAll());
}

export function getScannerDeviceId() {
  const key = 'polyfauna-scanner-device';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export async function downloadEventPack(eventId) {
  const { data, error } = await supabase.rpc('get_event_offline_pack', { p_event_id: eventId });
  if (error) throw error;
  const pack = { ...data, cachedAt: new Date().toISOString() };
  await request('packs', 'readwrite', store => store.put(pack));
  return pack;
}

export const getEventPack = eventId => request('packs', 'readonly', store => store.get(eventId));

export async function getOfflineScannerState(eventId) {
  const [pack, queue] = await Promise.all([eventId ? getEventPack(eventId) : null, all('queue')]);
  return {
    ready: !!pack,
    cachedAt: pack?.cachedAt || null,
    ticketCount: pack?.tickets?.length || 0,
    pending: queue.filter(item => !eventId || item.eventId === eventId).length,
  };
}

export async function validateTicketOffline(raw, eventId) {
  if (!eventId) return { code: 'OFFLINE_NO_EVENT', error: 'Selecciona un evento antes de trabajar sin conexión' };
  const verified = await verifySignedTicketQR(raw);
  if (!verified.valid) return { code: 'OFFLINE_UNSIGNED', error: verified.error };
  if (verified.payload.eid !== eventId) return { code: 'WRONG_EVENT', error: 'El ticket pertenece a otro evento' };

  const pack = await getEventPack(eventId);
  if (!pack) return { code: 'OFFLINE_NOT_READY', error: 'Este evento no fue descargado para uso offline' };
  const ticket = pack.tickets?.find(item => item.id === verified.payload.tid);
  if (!ticket) return { code: 'NOT_FOUND', error: 'El ticket no aparece en el paquete descargado' };
  if (ticket.status === 'used') return { code: 'ALREADY_USED', error: 'El ticket ya estaba usado al descargar el paquete', ...ticket };
  if (ticket.status !== 'valid') return { code: 'INVALID_STATUS', error: `Ticket no vigente: ${ticket.status}`, ...ticket };

  const usedKey = `${eventId}:${ticket.id}`;
  const locallyUsed = await request('used', 'readonly', store => store.get(usedKey));
  if (locallyUsed) return { code: 'ALREADY_USED', error: 'Ticket ya escaneado en este dispositivo', ...ticket };

  const scan = {
    scanId: crypto.randomUUID(), ticketId: ticket.id, eventId,
    deviceId: getScannerDeviceId(), scannedAt: new Date().toISOString(),
  };
  await request('used', 'readwrite', store => store.put({ key: usedKey, ...scan }));
  await request('queue', 'readwrite', store => store.put(scan));
  return {
    code: 'VALID', success: true, offline: true, pendingSync: true,
    event_title: pack.eventTitle, ticket_type: ticket.type, ticket_number: ticket.number,
  };
}

export async function syncOfflineScans() {
  const queue = await all('queue');
  if (!queue.length) return [];
  const { data, error } = await supabase.rpc('sync_offline_ticket_scans', { p_scans: queue });
  if (error) throw error;
  await Promise.all((data || []).map(result =>
    request('queue', 'readwrite', store => store.delete(result.scanId))
  ));
  return data || [];
}

