import supabase from '@/lib/customSupabaseClient';
import { verifySignedTicketQR } from '@/lib/tickets';
import { evaluateOfflineTicket } from '@/lib/offlineTicketRules';

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
  const verified = await verifySignedTicketQR(raw);
  const pack = eventId ? await getEventPack(eventId) : null;
  const ticketId = verified?.payload?.tid;
  const locallyUsed = ticketId ? await request('used', 'readonly', store => store.get(`${eventId}:${ticketId}`)) : null;
  const result = evaluateOfflineTicket({ verified, eventId, pack, locallyUsed });
  if (result.code !== 'VALID') return result;

  const scan = {
    scanId: crypto.randomUUID(), ticketId, eventId,
    deviceId: getScannerDeviceId(), scannedAt: new Date().toISOString(),
  };
  await request('used', 'readwrite', store => store.put({ key: `${eventId}:${ticketId}`, ...scan }));
  await request('queue', 'readwrite', store => store.put(scan));
  return result;
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
