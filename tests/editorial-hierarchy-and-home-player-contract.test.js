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
  assert.match(radio, /PODCAST_IDENTITY_LABEL = 'Loquens · Podcast'/);
  assert.match(radio, /LIVE_RADIO_IDENTITY_LABEL = 'Transmittens · Radio en vivo'/);
  assert.match(radio, /currentTrack\?\.kind === 'podcast'[\s\S]*PODCAST_IDENTITY_LABEL/);
  assert.match(player, /currentTrack\?\.kind === 'podcast'[\s\S]*PODCAST_IDENTITY_LABEL[\s\S]*LIVE_RADIO_IDENTITY_LABEL/);
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
  assert.match(radio, /Transmittens · Radio en vivo/);
});

test('el título de la sesión cabe en una línea y el play flotante usa el dorado editorial', () => {
  assert.match(css, /\.pf-detail-title\.pf-radio-session-title\s*\{[\s\S]*font-size: clamp\(1\.05rem, 2\.2vw, 1\.5rem\);[\s\S]*white-space: nowrap;[\s\S]*text-overflow: ellipsis;/);
  assert.match(radio, /className="pf-detail-title pf-radio-session-title" title=\{displayTitle\}/);
  assert.match(player, /FLOATING_PLAY_BACKGROUND = `linear-gradient\(135deg, #E4BD74, \$\{EDITORIAL_ACCENT\}\)`/);
  assert.match(player, /background: FLOATING_PLAY_BACKGROUND/);
});
