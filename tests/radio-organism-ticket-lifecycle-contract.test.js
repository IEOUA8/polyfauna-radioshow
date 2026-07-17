import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260716190000_radio_organism_ticket_lifecycle.sql', 'utf8');
const radio = readFileSync('src/components/RadioConsolePage.jsx', 'utf8');
const organism = readFileSync('src/components/Organism.jsx', 'utf8');
const vault = readFileSync('src/components/TicketVault.jsx', 'utf8');

test('radio stream no se guarda en Organismo y el corazón apunta a un set UUID', () => {
  assert.doesNotMatch(radio, /Guardar sesión|Abrir sala en vivo|toggleFav\('session'/);
  assert.match(radio, /useActiveRadioSet/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.radio_sets/);
  assert.match(migration, /PRIMARY KEY \(set_id, user_id\)/);
});

test('podcasts usan user_favorites como corazón único y Organismo no consulta tickets', () => {
  assert.doesNotMatch(organism, /from\('user_likes'\)/);
  assert.doesNotMatch(organism, /user_tickets|Ticket Vault.*select/);
  assert.match(organism, /Tu música/);
  assert.match(organism, /Tu agenda/);
  assert.match(organism, /Siguiendo/);
  assert.match(organism, /flex gap-1 p-1 rounded-xl overflow-x-auto/);
  assert.match(organism, /rgba\(184,207,166,0\.15\)/);
});

test('Ticket Vault solo oculta tickets usados después del fin del evento', () => {
  assert.match(migration, /v_ticket\.status <> 'used'/);
  assert.match(migration, /v_event_end >= now\(\)/);
  assert.match(migration, /hidden_from_vault_at = now\(\)/);
  assert.match(vault, /ticket\.status === 'used'/);
  assert.match(vault, /is\('hidden_from_vault_at', null\)/);
  assert.match(vault, /hide_used_expired_ticket/);
  assert.match(vault, /Eliminar de Ticket Vault/);
  assert.match(vault, /Podrás eliminarlo cuando finalice el evento/);
});
