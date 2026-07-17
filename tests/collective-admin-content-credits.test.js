import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const userManager = readFileSync('src/components/admin/UserManager.jsx', 'utf8');
const albumManager = readFileSync('src/components/admin/AlbumManager.jsx', 'utf8');
const podcastManager = readFileSync('src/components/admin/PodcastManager.jsx', 'utf8');
const migration = readFileSync('supabase/migrations/20260716223000_collective_admin_role_and_content_credits.sql', 'utf8');

test('el panel admin ofrece Colectivo y conserva el modelo promoter + organizer_type', () => {
  assert.match(userManager, /'collective'/);
  assert.match(userManager, /user\.role === 'promoter' && user\.organizer_type === 'collective'/);
  assert.match(userManager, /supabase\.rpc\('set_user_role'/);
  assert.match(migration, /WHEN p_role = 'collective' THEN 'promoter'/);
  assert.match(migration, /WHEN p_role = 'collective' THEN 'collective'/);
});

test('aprobar una solicitud de colectivo no la convierte en promotor común', () => {
  assert.match(migration, /v_request\.form_data->>'organizer_type' = 'collective'/);
  assert.match(migration, /THEN 'collective'/);
});

test('álbumes y podcasts guardan créditos múltiples mediante RPCs autorizados', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.album_artist_credits/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.podcast_artist_credits/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.set_album_artist_credits/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.set_podcast_artist_credits/);
  assert.match(albumManager, /supabase\.rpc\('set_album_artist_credits'/);
  assert.match(podcastManager, /supabase\.rpc\('set_podcast_artist_credits'/);
  assert.match(albumManager, /ArtistCreditSelector/);
  assert.match(podcastManager, /ArtistCreditSelector/);
});

test('las consultas distinguen autor principal de créditos y cargan artistas públicos', () => {
  assert.match(albumManager, /artists:artists!albums_artist_id_fkey\(name\)/);
  assert.match(podcastManager, /artists:artists!podcasts_artist_id_fkey\(name\)/);
  assert.match(albumManager, /from\('artists_public'\)/);
  assert.match(podcastManager, /from\('artists_public'\)/);
});
