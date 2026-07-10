import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJsx = readFileSync('src/App.jsx', 'utf8');
const globalPlayer = readFileSync('src/components/GlobalPlayer.jsx', 'utf8');
const polyfaunaOS = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');
const playbackContext = readFileSync('src/contexts/PlaybackContext.jsx', 'utf8');
const mobileMenu = readFileSync('src/components/MobileMenu.jsx', 'utf8');
const adminDashboard = readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

test('GlobalPlayer vive fuera de <Routes>, con su propio PlaybackProvider compartido', () => {
  // Antes GlobalPlayer era hijo de PolyfaunaOS: navegar a /admin o
  // /dashboard (rutas hermanas, no anidadas) lo desmontaba y cortaba el
  // audio. Ahora debe vivir a nivel de App, fuera de <Routes>.
  assert.match(appJsx, /<PlaybackProvider>/);
  assert.match(appJsx, /<\/Suspense>\s*\n\s*{\/\*[\s\S]*?\*\/}\s*\n\s*<Suspense fallback=\{null\}>\s*\n\s*<GlobalPlayer \/>/);
  assert.doesNotMatch(polyfaunaOS, /<GlobalPlayer/);
  assert.match(polyfaunaOS, /usePlayback\(\)/);
});

test('GlobalPlayer oculta su interfaz en rutas standalone sin desmontar el audio', () => {
  assert.match(globalPlayer, /PLAYER_HIDDEN_PREFIXES\s*=\s*\[/);
  const hiddenPrefixes = ['/login', '/signup', '/validate', '/artist/', '/profiles/', '/organizadores/', '/music/', '/podcasts/', '/events/', '/entrevistas/', '/e/'];
  for (const prefix of hiddenPrefixes) {
    assert.match(globalPlayer, new RegExp(`'${prefix.replace(/\//g, '\\/')}'`));
  }
  assert.match(globalPlayer, /const playerHidden = isPlayerHiddenRoute\(location\.pathname\);/);
  assert.match(globalPlayer, /<audio ref=\{audioRef\} preload="none" \/>\s*\n\s*\{!playerHidden && <>/);
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

test('los menus moviles (PolyfaunaOS y Admin Panel) van por encima del GlobalPlayer', () => {
  // GlobalPlayer vive fuera de <Routes> y se monta despues en el DOM, asi
  // que con el mismo z-index (z-50) siempre gana el empate y tapa estos
  // menus. Deben quedar por encima con z-index explicitamente mayor.
  assert.match(globalPlayer, /className="fixed z-50 rounded-full overflow-hidden cursor-pointer"/);
  assert.match(globalPlayer, /z-50 flex flex-col sm:flex-row/);

  assert.match(mobileMenu, /fixed inset-0 z-\[60\] lg:hidden/);
  assert.match(mobileMenu, /fixed bottom-0 left-0 right-0 z-\[70\] lg:hidden flex flex-col/);

  assert.match(adminDashboard, /fixed inset-0 z-\[60\] lg:hidden/);
  assert.match(adminDashboard, /fixed left-0 right-0 bottom-0 z-\[70\] lg:hidden flex flex-col overflow-hidden/);
});

test('el disco despeja la barra de navegacion rapida de /admin (MobileOperationsDock)', () => {
  // La barra de navegacion rapida propia de /admin (z-30, ~64px) queda
  // debajo del disco (z-50) si este se ancla muy abajo, tapando su boton
  // "Menu". El disco debe descansar por encima de esa barra.
  assert.match(globalPlayer, /bottom: 'calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)'/);
  assert.match(adminDashboard, /fixed left-0 right-0 bottom-0 z-30 lg:hidden/);
});

test('el stream se recupera con backoff ante pausa, stall, error o fin inesperado', () => {
  assert.match(globalPlayer, /addEventListener\('pause', onPause\)/);
  assert.match(globalPlayer, /addEventListener\('waiting', onWaiting\)/);
  assert.match(globalPlayer, /addEventListener\('stalled', onStalled\)/);
  assert.match(globalPlayer, /addEventListener\('error', onError\)/);
  assert.match(globalPlayer, /addEventListener\('ended', onLiveEnded\)/);
  assert.match(globalPlayer, /getStreamReconnectDelay\(attempt\)/);
  assert.match(globalPlayer, /STREAM_STALL_TIMEOUT_MS/);
  assert.match(globalPlayer, /window\.addEventListener\('online', onOnline\)/);
  assert.match(globalPlayer, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.doesNotMatch(globalPlayer, /setStreamError\(true\);\s*\n\s*setIsPlaying\(false\);\s*\n\s*toast\(\{ title: 'Stream no disponible'/);
});

test('las calidades usan mounts reales y Auto baja a 64 kbps tras tres cortes', () => {
  assert.match(globalPlayer, /VITE_RADIO_STREAM_HIGH/);
  assert.match(globalPlayer, /VITE_RADIO_STREAM_MEDIUM/);
  assert.match(globalPlayer, /VITE_RADIO_STREAM_LOW/);
  assert.match(globalPlayer, /auto:\s+MEDIUM_STREAM/);
  assert.match(globalPlayer, /getSelectedQuality\(\) === 'auto'/);
  assert.match(globalPlayer, /reconnectAttemptRef\.current >= 3/);
  assert.match(globalPlayer, /setStreamUrl\(LOW_STREAM\)/);
});

test('barra y disco no encadenan animaciones (sin mode="wait")', () => {
  // mode="wait" hace que la animacion de salida termine antes de empezar
  // la de entrada, sumando duracion de animacion justo cuando /admin monta
  // de golpe en movil. Ambos son "fixed" (sin layout compartido), asi que
  // pueden animar a la vez sin salto visual.
  assert.doesNotMatch(globalPlayer, /<AnimatePresence mode="wait">/);
  assert.match(globalPlayer, /<AnimatePresence>/);
});
