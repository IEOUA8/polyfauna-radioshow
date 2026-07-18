import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260718000000_public_visibility_controls.sql', 'utf8');
const dashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');
const manager = readFileSync('src/components/admin/VisibilityManager.jsx', 'utf8');

const publicSurfaces = [
  'src/components/ArtistsPage.jsx',
  'src/components/OrganizersPage.jsx',
  'src/components/BlogInterviewsSection.jsx',
  'src/components/InterviewsSection.jsx',
  'src/components/MusicPage.jsx',
  'src/components/PodcastsPage.jsx',
  'src/components/RightPanel.jsx',
  'src/components/TopBar.jsx',
].map((path) => readFileSync(path, 'utf8')).join('\n');

test('la migración agrega moderación reversible a todos los perfiles y contenidos solicitados', () => {
  for (const entity of ['artists', 'organizers', 'podcasts', 'blog_articles', 'interviews', 'albums']) {
    assert.match(migration, new RegExp(`['\"]${entity}['\"]`));
  }
  assert.match(migration, /is_public BOOLEAN NOT NULL DEFAULT true/);
  assert.match(migration, /visibility_reason TEXT/);
  assert.match(migration, /content_visibility_audit/);
});

test('solo admin puede cambiar visibilidad y ocultar exige un motivo', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.set_public_visibility/);
  assert.match(migration, /role = 'admin'/);
  assert.match(migration, /IF NOT p_is_public AND clean_reason IS NULL/);
  assert.match(migration, /guard_public_visibility_fields/);
  assert.match(migration, /Solo un administrador puede cambiar la visibilidad publica/);
});

test('RLS excluye registros ocultos y los tracks heredan la visibilidad del álbum', () => {
  for (const policy of [
    'artists_visible_read',
    'organizers_visible_read',
    'podcasts_visible_read',
    'blog_articles_visible_read',
    'interviews_visible_read',
    'albums_visible_read',
    'tracks_visible_read',
  ]) {
    assert.match(migration, new RegExp(policy));
  }
  assert.match(migration, /albums\.id = tracks\.album_id AND albums\.is_public/);
});

test('el panel admin expone un centro de visibilidad con ocultar, restaurar y motivo', () => {
  assert.match(dashboard, /id: 'visibility'/);
  assert.match(dashboard, /<VisibilityManager/);
  assert.match(manager, /supabase\.rpc\('set_public_visibility'/);
  assert.match(manager, /Motivo \*/);
  assert.match(manager, /Volver a publicar/);
});

test('las superficies públicas aplican is_public aunque navegue un admin o propietario', () => {
  assert.match(publicSurfaces, /eq\('is_public', true\)/);
  const filters = publicSurfaces.match(/eq\('is_public', true\)/g) || [];
  assert.ok(filters.length >= 15, `se esperaban filtros públicos explícitos; encontrados: ${filters.length}`);
});
