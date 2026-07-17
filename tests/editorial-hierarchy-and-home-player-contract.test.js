import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/index.css', 'utf8');
const theme = readFileSync('src/lib/editorialTheme.js', 'utf8');
const radio = readFileSync('src/components/RadioConsolePage.jsx', 'utf8');
const player = readFileSync('src/components/GlobalPlayer.jsx', 'utf8');
const shell = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');
const profileTabs = readFileSync('src/components/ProfileContentTabs.jsx', 'utf8');

const editorialPages = [
  'PodcastsPage.jsx',
  'MusicPage.jsx',
  'ArtistsPage.jsx',
  'OrganizersPage.jsx',
  'BlogInterviewsSection.jsx',
  'EventTerminal.jsx',
].map((name) => readFileSync(`src/components/${name}`, 'utf8'));

test('la jerarquía editorial comparte un único dorado y clases semánticas', () => {
  assert.match(theme, /EDITORIAL_ACCENT = '#D6A456'/);
  assert.match(css, /--pf-editorial-accent:\s*#D6A456/);
  for (const className of ['pf-page-title', 'pf-detail-title', 'pf-section-label', 'pf-meta', 'pf-author', 'pf-chip']) {
    assert.match(css, new RegExp(`\\.${className}`));
  }
  for (const page of editorialPages) {
    assert.match(page, /pf-(?:page|detail)-(?:title|subtitle)|pf-section-label|pf-chip/);
  }
  assert.match(profileTabs, /EDITORIAL_ACCENT/);
  assert.match(profileTabs, /editorialAccent\(0\.13\)/);
});

test('Inicio refleja la fuente global seleccionada y mantiene el regreso a Radio', () => {
  assert.match(radio, /const isOnDemand = Boolean\(currentTrack\)/);
  assert.match(radio, /const displayTitle = isOnDemand/);
  assert.match(radio, /A demanda · \$\{contentKind\}/);
  assert.match(radio, /En vivo ahora/);
  assert.match(radio, /Volver a Radio/);
  assert.match(radio, /setCurrentTrack\?\.\(null\)/);
  assert.match(radio, /setIsPlaying\(true\)/);
  assert.match(shell, /<RadioConsolePage[^>]*currentTrack=\{currentTrack\}[^>]*setCurrentTrack=\{setCurrentTrack\}/);
});

test('volver a Radio descarta una cola on-demand anterior', () => {
  assert.match(player, /if \(!currentTrack\) \{[\s\S]*setPlaybackQueue\(null\);[\s\S]*queueRef\.current = null;/);
});

test('el dorado editorial no sustituye el naranja semántico de Radio en vivo', () => {
  assert.match(radio, /#FF8A1F/);
  assert.match(radio, /Radio en vivo/);
});
