import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const podcastsPage = readFileSync('src/components/PodcastsPage.jsx', 'utf8');
const artistsPage = readFileSync('src/components/ArtistsPage.jsx', 'utf8');
const polyfaunaOS = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');

test('el control principal de reproducción conserva contraste y estados play/pause', () => {
  assert.match(podcastsPage, /aria-label=\{isCurrentlyPlaying \? `Pausar/);
  assert.match(podcastsPage, /linear-gradient\(135deg, #F7FAF8 0%, #C8D1CC 100%\)/);
  assert.match(podcastsPage, /<Pause[\s\S]*Pausar/);
  assert.match(podcastsPage, /<Play[\s\S]*Reproducir/);
});

test('la descripción usa acordeón en escritorio y modal accesible en móvil', () => {
  assert.match(podcastsPage, /useMediaQuery\('\(max-width: 767px\)'\)/);
  assert.match(podcastsPage, /setDescriptionExpanded/);
  assert.match(podcastsPage, /Leer menos/);
  assert.match(podcastsPage, /setDescriptionModalOpen\(true\)/);
  assert.match(podcastsPage, /role="dialog"/);
  assert.match(podcastsPage, /aria-modal="true"/);
  assert.match(podcastsPage, /id="podcast-description-content"/);
});

test('los créditos de artistas son visibles y abren el perfil dentro del shell', () => {
  assert.match(podcastsPage, /podcast_artist_credits\(artists\(id, name, slug\)\)/);
  assert.match(podcastsPage, /Abrir perfil de \$\{artist\.name\}/);
  assert.match(podcastsPage, /openInSection\(setCurrentSection, 'artists', 'artist'/);
  assert.match(polyfaunaOS, /<PodcastsPage[\s\S]*setCurrentSection=\{setCurrentSection\}/);
  assert.match(artistsPage, /a\.slug === artistParam \|\| a\.id === artistParam/);
});
