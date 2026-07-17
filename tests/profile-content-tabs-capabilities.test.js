import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profileContentTabs = readFileSync('src/components/ProfileContentTabs.jsx', 'utf8');
const artistsPage = readFileSync('src/components/ArtistsPage.jsx', 'utf8');
const organizersPage = readFileSync('src/components/OrganizersPage.jsx', 'utf8');

test('las pestañas varían por tipo de perfil, no las mismas 4 para todos', () => {
  // Bug real: un sello (no toca en vivo) o un promotor (no sube contenido
  // propio) mostraban las mismas 4 pestañas que un artista, con tabs vacíos
  // que no tenían sentido para su rol.
  assert.match(profileContentTabs, /label:\s*\{ events: false, music: true, podcast: true, interviews: true \}/);
  assert.match(profileContentTabs, /club:\s*\{ events: true, music: false, podcast: true,\s*interviews: true \}/);
  assert.match(profileContentTabs, /promoter:\s*\{ events: true, music: false, podcast: false, interviews: true \}/);
  assert.match(profileContentTabs, /collective:\s*\{ events: true, music: true,\s*podcast: true,\s*interviews: true \}/);
});

test('las capacidades del organizador usan su tipo real además de la fila espejo', () => {
  assert.match(profileContentTabs, /if \(organizerId\) return ORGANIZER_TAB_CAPABILITIES\[organizerType\] \|\| DEFAULT_ORGANIZER_CAPABILITIES;/);
});

test('música y podcasts incluyen contenido donde el artista fue etiquetado', () => {
  assert.match(profileContentTabs, /\.from\('album_artist_credits'\)/);
  assert.match(profileContentTabs, /\.from\('podcast_artist_credits'\)/);
});

test('ArtistsPage y OrganizersPage pasan el type real a ProfileContentTabs', () => {
  assert.match(artistsPage, /<ProfileContentTabs artistId=\{artist\.id\} artistType=\{artist\.type\} \/>/);
  assert.match(organizersPage, /<ProfileContentTabs organizerId=\{organizer\.id\} organizerType=\{organizer\.type\}/);
});
