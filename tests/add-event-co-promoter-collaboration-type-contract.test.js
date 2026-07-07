import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20260707091200_co_promoters_collaboration_type_and_collective_role.sql',
  'utf8'
);
const eventManagerSource = readFileSync('src/components/admin/EventManager.jsx', 'utf8');

test('la firma anterior de 2 argumentos se elimina antes de crear la de 3', () => {
  assert.match(migration, /DROP FUNCTION IF EXISTS public\.add_event_co_promoter\(UUID, TEXT\);/);
});

test('add_event_co_promoter(UUID, TEXT, TEXT) mantiene default seguro y permisos', () => {
  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.add_event_co_promoter\(\s*p_event_id UUID,\s*p_email TEXT,\s*p_collaboration_type TEXT DEFAULT 'ticket_reseller'\s*\)/
  );
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.add_event_co_promoter\(UUID, TEXT, TEXT\) FROM PUBLIC, anon;/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.add_event_co_promoter\(UUID, TEXT, TEXT\) TO authenticated;/);
});

test('collaboration_type solo acepta co_organizer o ticket_reseller', () => {
  assert.match(
    migration,
    /CHECK \(collaboration_type IN \('co_organizer', 'ticket_reseller'\)\)/
  );
});

test('el puente a event_organizers solo ocurre para co_organizer, nunca para reventa de boletas', () => {
  const bridgeBlock = migration.slice(
    migration.indexOf("IF p_collaboration_type = 'co_organizer' THEN"),
    migration.indexOf('END IF;', migration.indexOf("IF p_collaboration_type = 'co_organizer' THEN"))
  );
  assert.match(bridgeBlock, /INSERT INTO public\.event_organizers/);
});

test('EventManager.jsx siempre pasa collaboration_type explícito (co_organizer o ticket_reseller)', () => {
  assert.match(
    eventManagerSource,
    /rpc\('add_event_co_promoter', \{\s*p_event_id: eventId,\s*p_email: email\.trim\(\),\s*p_collaboration_type: collaborationType,\s*\}\)/
  );
  assert.match(eventManagerSource, /handleAdd\('co_organizer'\)/);
  assert.match(eventManagerSource, /handleAdd\('ticket_reseller'\)/);
});

test('el default DB-side sigue existiendo para llamadas legacy fuera de EventManager.jsx', () => {
  assert.match(migration, /p_collaboration_type TEXT DEFAULT 'ticket_reseller'/);
});
