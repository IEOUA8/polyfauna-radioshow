import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nowPlayingHook = readFileSync('src/hooks/useNowPlaying.js', 'utf8');
const app = readFileSync('src/App.jsx', 'utf8');
const globalPlayer = readFileSync('src/components/GlobalPlayer.jsx', 'utf8');
const topBar = readFileSync('src/components/TopBar.jsx', 'utf8');
const sidebar = readFileSync('src/components/Sidebar.jsx', 'utf8');
const radioConsole = readFileSync('src/components/RadioConsolePage.jsx', 'utf8');

test('NowPlaying se centraliza en un provider unico', () => {
  assert.match(nowPlayingHook, /createContext/);
  assert.match(nowPlayingHook, /export function NowPlayingProvider/);
  assert.match(nowPlayingHook, /export function useNowPlaying/);
  assert.match(app, /import \{ NowPlayingProvider \} from '@\/hooks\/useNowPlaying'/);
  assert.match(app, /<NowPlayingProvider>/);
  assert.match(app, /<\/NowPlayingProvider>/);
});

test('NowPlaying usa endpoint cacheable y polling sin solapamientos', () => {
  assert.match(nowPlayingHook, /nowplaying_static\/\$\{STATION\}\.json/);
  assert.match(nowPlayingHook, /nowplaying\/\$\{STATION\}/);
  assert.match(nowPlayingHook, /REFRESH_INTERVAL_MS = 15000/);
  assert.match(nowPlayingHook, /RETRY_INTERVAL_MS = 30000/);
  assert.match(nowPlayingHook, /window\.setTimeout/);
  assert.doesNotMatch(nowPlayingHook, /setInterval/);
});

test('consumidores de NowPlaying no hacen fetch directo', () => {
  for (const source of [globalPlayer, topBar, sidebar, radioConsole]) {
    assert.match(source, /useNowPlaying/);
    assert.doesNotMatch(source, /fetch\(/);
    assert.doesNotMatch(source, /nowplaying/);
  }
});

test('NowPlaying expone metricas ligeras para diagnostico de carga', () => {
  assert.match(nowPlayingHook, /requestCount/);
  assert.match(nowPlayingHook, /lastFetchAt/);
  assert.match(nowPlayingHook, /lastErrorAt/);
  assert.match(nowPlayingHook, /__polyfaunaNowPlayingMetrics/);
  assert.match(nowPlayingHook, /polyfauna:nowplaying-fetch/);
});
