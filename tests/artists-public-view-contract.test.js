import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewMigration = readFileSync('supabase/migrations/20260708033522_artists_public_view.sql', 'utf8');
const rotatingArtistsMigration = readFileSync('supabase/migrations/20260711000002_rotating_artists.sql', 'utf8');
const artistsPage = readFileSync('src/components/ArtistsPage.jsx', 'utf8');
const topBar = readFileSync('src/components/TopBar.jsx', 'utf8');
const rightPanel = readFileSync('src/components/RightPanel.jsx', 'utf8');

test('artists_public excluye fichas espejo de cuentas promoter/club, no por type', () => {
  // Bug real: artists.type='collective' tambien es un descriptor artistico
  // libre en ArtistManager.jsx (ARTIST_TYPES incluye 'collective' para
  // grupos/bandas, sin relacion con Colonia). Filtrar por type habria
  // excluido por error un grupo musical legitimo cargado a mano sin cuenta
  // propia. La señal correcta es el vinculo user_id -> profiles.role.
  const sqlOnly = viewMigration
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(sqlOnly, /a\.type\s*(<>|!=|NOT IN)/);
  assert.match(viewMigration, /WHERE p\.role IS NULL OR p\.role NOT IN \('promoter', 'club'\)/);
});

test('Artists & Labels (grid, detalle, deep-link y búsqueda global) usan artists_public, no artists', () => {
  // ArtistPublicPage.jsx (la vieja pagina standalone /profiles/:slug) se
  // retiro: ese detalle ahora vive dentro de ArtistsPage.jsx (ArtistDetail),
  // que reusa artists_public tanto en el grid como en el fallback de
  // deep-link — una sola fuente, no dos implementaciones divergentes.
  assert.doesNotMatch(artistsPage, /supabase\.from\('artists'\)/);
  assert.match(artistsPage, /supabase\.from\('artists_public'\)/);
  assert.doesNotMatch(topBar, /supabase\.from\('artists'\)/);
  assert.match(topBar, /supabase\.from\('artists_public'\)/);
});

test('RightPanel usa get_rotating_artists, y esa RPC lee de artists_public, no de artists', () => {
  // RightPanel rota el subconjunto cada 25 min via RPC (ver
  // 20260711000002_rotating_artists.sql) en vez de un SELECT directo, pero
  // la garantia de seguridad (excluir fichas espejo de promoter/club) debe
  // seguir cumpliendose adentro de esa funcion.
  assert.doesNotMatch(rightPanel, /supabase\.from\('artists'\)/);
  assert.doesNotMatch(rightPanel, /supabase\.from\('artists_public'\)/);
  assert.match(rightPanel, /supabase\.rpc\('get_rotating_artists'/);
  assert.doesNotMatch(rotatingArtistsMigration, /FROM public\.artists\b/);
  assert.match(rotatingArtistsMigration, /FROM public\.artists_public/);
});
