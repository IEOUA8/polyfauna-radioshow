import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJsx = readFileSync('src/App.jsx', 'utf8');
const globalPlayer = readFileSync('src/components/GlobalPlayer.jsx', 'utf8');
const polyfaunaOS = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');
const playbackContext = readFileSync('src/contexts/PlaybackContext.jsx', 'utf8');

test('GlobalPlayer vive fuera de <Routes>, con su propio PlaybackProvider compartido', () => {
  // Antes GlobalPlayer era hijo de PolyfaunaOS: navegar a /admin o
  // /dashboard (rutas hermanas, no anidadas) lo desmontaba y cortaba el
  // audio. Ahora debe vivir a nivel de App, fuera de <Routes>.
  assert.match(appJsx, /<PlaybackProvider>/);
  assert.match(appJsx, /<\/Suspense>\s*\n\s*{\/\*[\s\S]*?\*\/}\s*\n\s*<Suspense fallback=\{null\}>\s*\n\s*<GlobalPlayer \/>/);
  assert.doesNotMatch(polyfaunaOS, /<GlobalPlayer/);
  assert.match(polyfaunaOS, /usePlayback\(\)/);
});

test('GlobalPlayer se oculta en rutas standalone (login, perfiles publicos, etc.)', () => {
  assert.match(globalPlayer, /PLAYER_HIDDEN_PREFIXES\s*=\s*\[/);
  const hiddenPrefixes = ['/login', '/signup', '/validate', '/artist/', '/profiles/', '/organizadores/', '/music/', '/podcasts/', '/events/', '/entrevistas/', '/e/'];
  for (const prefix of hiddenPrefixes) {
    assert.match(globalPlayer, new RegExp(`'${prefix.replace(/\//g, '\\/')}'`));
  }
  assert.match(globalPlayer, /if \(isPlayerHiddenRoute\(location\.pathname\)\) return null;/);
});

test('modo disco: solo en /admin y /dashboard, solo movil, sin afectar escritorio', () => {
  assert.match(globalPlayer, /function isCompactRoute\(pathname\)\s*{\s*\n\s*return pathname === '\/admin' \|\| pathname === '\/dashboard';/);
  assert.doesNotMatch(globalPlayer, /__test_compact/);
  assert.match(globalPlayer, /isMobile\s*=\s*useMediaQuery\('\(max-width: 1023px\)'\)/);
  assert.match(globalPlayer, /compactEligible\s*=\s*isMobile\s*&&\s*isCompactRoute\(location\.pathname\)/);
});

test('disco: centro = play\\/pausa, resto = expandir', () => {
  assert.match(globalPlayer, /onClick=\{\(\) => setDiscExpanded\(true\)\}/);
  assert.match(globalPlayer, /stopPropagation/);
});

test('App.jsx no conserva rutas de prueba temporales', () => {
  assert.doesNotMatch(appJsx, /__test_compact/);
});

test('PlaybackContext expone estado compartido de reproduccion y navegacion de seccion', () => {
  assert.match(playbackContext, /isPlaying, setIsPlaying/);
  assert.match(playbackContext, /currentTrack, setCurrentTrack/);
  assert.match(playbackContext, /registerSectionNavigator, goToSection/);
});
