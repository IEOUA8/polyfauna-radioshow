import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('eventos conservan una portada principal y overrides opcionales para movil y ticket', () => {
  const manager = read('src/components/admin/EventManager.jsx');
  const migration = read('supabase/migrations/20260716133000_event_image_variants.sql');

  assert.match(manager, /mobile_image_url/);
  assert.match(manager, /ticket_image_url/);
  assert.match(manager, /Imagen para móvil/);
  assert.match(manager, /Imagen para ticket y QR/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS mobile_image_url TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS ticket_image_url TEXT/);
});

test('las variantes mantienen fallback hacia la portada principal', () => {
  const helpers = read('src/lib/eventImages.js');
  const vault = read('src/components/TicketVault.jsx');

  assert.match(helpers, /event\.ticket_image_url \|\| event\.image_url/);
  assert.match(helpers, /event\.mobile_image_url \|\| event\.image_url/);
  assert.match(vault, /getEventImage\(event, 'ticket'\)/);
});
