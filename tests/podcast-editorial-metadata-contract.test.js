import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const podcastManager = readFileSync('src/components/admin/PodcastManager.jsx', 'utf8');
const podcastsPage = readFileSync('src/components/PodcastsPage.jsx', 'utf8');
const r2UploadField = readFileSync('src/components/admin/R2UploadField.jsx', 'utf8');
const migration = readFileSync('supabase/migrations/20260716234500_podcast_footer_description.sql', 'utf8');

test('el editor usa áreas multilínea y elimina la duración manual', () => {
  assert.match(podcastManager, /<Textarea[\s\S]*id="description"/);
  assert.match(podcastManager, /id="footer_description"/);
  assert.doesNotMatch(podcastManager, /id="duration"/);
});

test('la duración se extrae del archivo de audio y se guarda en segundos', () => {
  assert.match(podcastManager, /audio\.onloadedmetadata/);
  assert.match(podcastManager, /Math\.round\(audio\.duration\)/);
  assert.match(podcastManager, /extractMetadata=\{extractAudioMetadata\}/);
  assert.match(r2UploadField, /await extractMetadata\(file\)/);
  assert.match(r2UploadField, /onChange\(publicUrl, metadata\)/);
});

test('la descripción al pie existe en base de datos y en el detalle público', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS footer_description TEXT/);
  assert.match(podcastManager, /footer_description: podcast\.footer_description \|\| ''/);
  assert.match(podcastsPage, /pod\.footer_description/);
  assert.match(podcastsPage, /Notas del episodio/);
});
