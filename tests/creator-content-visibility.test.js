import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260718010000_creator_visibility_controls.sql', 'utf8');
const control = readFileSync('src/components/admin/CreatorVisibilityControl.jsx', 'utf8');
const podcastManager = readFileSync('src/components/admin/PodcastManager.jsx', 'utf8');
const albumManager = readFileSync('src/components/admin/AlbumManager.jsx', 'utf8');
const eventManager = readFileSync('src/components/admin/EventManager.jsx', 'utf8');
const createPayment = readFileSync('supabase/functions/create-payment/index.ts', 'utf8');

const publicSurfaces = [
  'src/components/EventTerminal.jsx',
  'src/components/MusicPage.jsx',
  'src/components/PodcastsPage.jsx',
  'src/components/Organism.jsx',
  'src/components/ProfileContentTabs.jsx',
  'src/components/RadioConsolePage.jsx',
  'src/components/RightPanel.jsx',
  'src/components/TopBar.jsx',
  'src/hooks/useNotifications.js',
].map((path) => readFileSync(path, 'utf8')).join('\n');

test('la visibilidad del creador es independiente de la moderación administrativa', () => {
  assert.match(migration, /creator_is_public BOOLEAN NOT NULL DEFAULT true/);
  assert.match(migration, /is_public AND creator_is_public/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.set_creator_visibility/);
  assert.match(migration, /Solo el creador puede cambiar esta visibilidad/);
});

test('podcasts, álbumes y eventos exponen el mismo control en el panel operativo', () => {
  assert.match(podcastManager, /entityType="podcasts"/);
  assert.match(albumManager, /entityType="albums"/);
  assert.match(eventManager, /entityType="events"/);
  assert.match(control, /supabase\.rpc\('set_creator_visibility'/);
  assert.match(control, /Oculto por administración/);
  assert.match(control, /Oculto por ti/);
});

test('un co-promotor no puede ocultar un evento ajeno', () => {
  assert.match(migration, /WHEN 'events'[\s\S]*owner_id = \(SELECT auth\.uid\(\)\)/);
  assert.doesNotMatch(migration.match(/CREATE OR REPLACE FUNCTION public\.set_creator_visibility[\s\S]*?\$\$;/)?.[0] || '', /event_co_promoters/);
  assert.match(eventManager, /ownerId=\{event\.owner_id\}/);
});

test('las superficies públicas exigen ambas capas de visibilidad', () => {
  const creatorFilters = publicSurfaces.match(/eq\('creator_is_public', true\)/g) || [];
  assert.ok(creatorFilters.length >= 15, `se esperaban filtros creator_is_public; encontrados: ${creatorFilters.length}`);
});

test('ocultar un evento bloquea compras nuevas pero conserva datos para compradores existentes', () => {
  assert.match(createPayment, /event\.creator_is_public === false/);
  assert.match(createPayment, /event\.is_public === false/);
  assert.match(migration, /purchase_ticket_visibility_impl/);
  assert.match(migration, /current_user_has_event_ticket/);
  assert.match(migration, /status NOT IN \('cancelled', 'refunded'\)/);
});
