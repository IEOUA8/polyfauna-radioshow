import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260703004745_fix_get_event_attendees_amount_cast.sql', 'utf8');

test('get_event_attendees castea amount_total a numeric (transactions.amount_total es bigint)', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_event_attendees/);
  assert.match(migration, /transaction\.amount_total::NUMERIC/);
});
