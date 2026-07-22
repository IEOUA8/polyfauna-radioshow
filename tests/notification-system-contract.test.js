import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.jsx', 'utf8');
const topBar = readFileSync('src/components/TopBar.jsx', 'utf8');
const rightPanel = readFileSync('src/components/RightPanel.jsx', 'utf8');
const center = readFileSync('src/components/NotificationsCenter.jsx', 'utf8');
const notificationsHook = readFileSync('src/hooks/useNotifications.js', 'utf8');
const pushHook = readFileSync('src/hooks/usePushNotifications.js', 'utf8');
const controlCenter = readFileSync('src/components/ControlCenter.jsx', 'utf8');
const installBanner = readFileSync('src/components/InstallAppBanner.jsx', 'utf8');
const serviceWorker = readFileSync('public/sw.js', 'utf8');
const sendPush = readFileSync('supabase/functions/send-push/index.ts', 'utf8');
const dispatchHelper = readFileSync('supabase/functions/_shared/notifications.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260722000001_notification_delivery_pipeline.sql', 'utf8');
const eventManager = readFileSync('src/components/admin/EventManager.jsx', 'utf8');
const webhook = readFileSync('supabase/functions/webhook-wompi/index.ts', 'utf8');
const messages = readFileSync('supabase/functions/send-message-notification/index.ts', 'utf8');

test('la campana móvil está a la derecha de una búsqueda flexible y desaparece cuando entra el panel xl', () => {
  assert.match(topBar, /className="flex-1 min-w-0 max-w-lg relative"/);
  assert.match(topBar, /<div className="xl:hidden shrink-0">\s*<NotificationsBell[^>]*mobile \/>/);
  assert.match(rightPanel, /<NotificationsBell setCurrentSection=\{setCurrentSection\} \/>/);
});

test('el centro compartido tiene diálogo móvil, badge, estados de carga y marcar como leído', () => {
  assert.match(center, /createPortal\(/);
  assert.match(center, /role="dialog"/);
  assert.match(center, /left-3 right-3/);
  assert.match(center, /safe-area-inset-top/);
  assert.match(center, /No pudimos cargar las notificaciones/);
  assert.match(center, /Marcar todo como leído/);
  assert.match(center, /unreadCount > 9 \? '9\+' : unreadCount/);
  assert.match(center, /futureDiff > 0/);
  assert.match(center, /daysUntil === 1 \? 'Mañana' : `En \$\{daysUntil\}d`/);
});

test('las notificaciones se comparten globalmente y sincronizan lectura y tiempo real', () => {
  assert.match(app, /<NotificationProvider>[\s\S]*<TooltipProvider/);
  assert.match(notificationsHook, /from\('notification_reads'\)/);
  assert.match(notificationsHook, /onConflict: 'notification_id,user_id'/);
  assert.match(notificationsHook, /table: 'notifications'/);
  assert.match(notificationsHook, /table: 'notification_reads'/);
  assert.match(notificationsHook, /setAppBadge|clearAppBadge/);
});

test('Push expone configuración, instalación iOS, bloqueo, suscripción y prueba real', () => {
  assert.match(pushHook, /import\.meta\.env\.VITE_VAPID_PUBLIC_KEY \|\| ''/);
  assert.doesNotMatch(pushHook, /BO[A-Za-z0-9_-]{40,}/);
  assert.match(pushHook, /needsInstall = ios && !standalone/);
  assert.match(pushHook, /'misconfigured'/);
  assert.match(pushHook, /'needs-install'/);
  assert.match(pushHook, /'unsupported'/);
  assert.match(pushHook, /'blocked'/);
  assert.match(pushHook, /functions\.invoke\('send-push'/);
  assert.match(pushHook, /persist: false/);
  assert.match(controlCenter, /function PushPreferenceCard/);
  assert.match(controlCenter, /Enviar prueba/);
  assert.match(installBanner, /polyfauna-show-install/);
});

test('el service worker no colapsa todos los pushes en una sola etiqueta y actualiza el badge', () => {
  assert.match(serviceWorker, /data\.notificationId \? `polyfauna-\$\{data\.notificationId\}` : `polyfauna-\$\{Date\.now\(\)\}`/);
  assert.doesNotMatch(serviceWorker, /tag:\s*data\.tag\s*\|\|\s*'polyfauna-notification'/);
  assert.match(serviceWorker, /setAppBadge/);
  assert.match(serviceWorker, /showNotification/);
});

test('la migración agrega deduplicación, lecturas por usuario, entregas y realtime', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS dedupe_key TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_unique/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.notification_reads/);
  assert.match(migration, /PRIMARY KEY \(notification_id, user_id\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.notification_deliveries/);
  assert.match(migration, /channel IN \('in_app', 'push', 'email'\)/);
  assert.match(migration, /CREATE POLICY "push_own_update"/);
  assert.match(migration, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.notifications/);
  assert.match(migration, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.notification_reads/);
});

test('send-push persiste primero, deduplica y registra entrega incluso si Push no está configurado', () => {
  const persistPosition = sendPush.indexOf(".from('notifications')");
  const configPosition = sendPush.indexOf("if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY)");
  assert.ok(persistPosition > -1 && configPosition > persistPosition);
  assert.match(sendPush, /from\('notification_deliveries'\)/);
  assert.match(sendPush, /reason: 'server_not_configured'/);
  assert.match(sendPush, /reason: 'no_subscriptions'/);
  assert.match(sendPush, /notificationType/);
  assert.match(sendPush, /dedupe_key: safeDedupeKey/);
  assert.match(dispatchHelper, /functions\/v1\/send-push/);
});

test('eventos, pagos y mensajes envían metadatos accionables y deduplicables', () => {
  assert.match(eventManager, /notificationType: 'event'/);
  assert.match(eventManager, /dedupeKey: `event-published\/\$\{createdEvent\?\.id\}`/);
  assert.match(webhook, /notificationType: 'ticket'/);
  assert.match(webhook, /dedupeKey: `ticket-confirmed\/\$\{transaction\.id\}`/);
  assert.match(messages, /notificationType: 'system'/);
  assert.match(messages, /dedupeKey: `direct-message\/\$\{message\.id\}`/);
});
