import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const organizerProvision = readFileSync(
  'supabase/migrations/20260708014609_organizer_profile_auto_provision.sql',
  'utf8'
);
const eventOwnerSync = readFileSync(
  'supabase/migrations/20260708014846_event_owner_organizer_sync.sql',
  'utf8'
);
const clubArtistProvision = readFileSync(
  'supabase/migrations/20260708015128_provision_artist_profile_for_club.sql',
  'utf8'
);

test('provision_organizer_profile_for cubre promoter y club, con backfill', () => {
  assert.match(organizerProvision, /v_profile\.role = 'promoter' OR v_profile\.role = 'club'/);
  assert.match(organizerProvision, /WHERE role IN \('promoter', 'club'\)/);
});

test('organizers.owner_id es unico (1 ficha por cuenta)', () => {
  assert.match(organizerProvision, /ADD CONSTRAINT organizers_owner_id_unique UNIQUE \(owner_id\)/);
});

test('el trigger de profiles corre en INSERT y UPDATE, no solo en aprobacion inicial', () => {
  assert.match(organizerProvision, /AFTER INSERT OR UPDATE ON public\.profiles/);
});

test('un evento se vincula a la ficha organizers de su propio owner_id con role_in_event=owner', () => {
  assert.match(eventOwnerSync, /VALUES \(p_event_id, v_organizer_id, 'owner'\)/);
  assert.match(eventOwnerSync, /ON CONFLICT \(event_id, organizer_id\) DO NOTHING/);
});

test('el trigger de eventos corre en INSERT y en UPDATE de owner_id', () => {
  assert.match(eventOwnerSync, /AFTER INSERT OR UPDATE OF owner_id ON public\.events/);
});

test('provisionar la ficha de organizador tambien re-sincroniza sus eventos ya existentes', () => {
  assert.match(eventOwnerSync, /FOR r IN SELECT id FROM public\.events WHERE owner_id = p_profile_id LOOP/);
});

test('provision_artist_profile_for ahora incluye role=club (bug de artist_id null en AlbumManager\\/PodcastManager)', () => {
  assert.match(clubArtistProvision, /OR v_profile\.role = 'club'/);
  assert.match(clubArtistProvision, /WHEN v_profile\.role = 'club' THEN 'club'/);
});
