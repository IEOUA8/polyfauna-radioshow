import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rightPanel = readFileSync('src/components/RightPanel.jsx', 'utf8');
const radioConsole = readFileSync('src/components/RadioConsolePage.jsx', 'utf8');
const polyfaunaOS = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');
const openInSection = readFileSync('src/lib/openInSection.js', 'utf8');

test('los accesos rapidos de RightPanel y del banner de eventos no navegan a rutas publicas', () => {
  // /e/:id y /profiles/:slug son rutas HERMANAS de PolyfaunaOS (/*) en
  // App.jsx, no hijas — navegar ahi desde dentro del shell lo desmonta y
  // remonta entero (sidebar, panel derecho, bottom nav) para un click que
  // ya estaba adentro de la app. Bug real encontrado por el usuario.
  assert.doesNotMatch(rightPanel, /navigate\(`\/e\//);
  assert.doesNotMatch(rightPanel, /navigate\(`\/profiles\//);
  assert.doesNotMatch(radioConsole, /navigate\(`\/e\//);
});

test('en su lugar usan openInSection (setCurrentSection + query param), sin salir del shell', () => {
  // No usa CustomEvent con setTimeout: en la primera visita a una sección
  // (chunk lazy todavía no montado), el listener no existe cuando el evento
  // llega y el detalle nunca abre — bug real encontrado probando en vivo.
  // El query param sí funciona: cada sección lo resuelve en un useEffect
  // con la lista como dependencia, sin importar cuánto tarde el chunk.
  assert.match(rightPanel, /openInSection\(setCurrentSection, 'events', 'event', event\.id\)/);
  assert.match(rightPanel, /openInSection\(setCurrentSection, 'artists', 'artist', artist\.slug\)/);
  assert.match(radioConsole, /openInSection\(setCurrentSection, 'events', 'event', ev\.id\)/);
  assert.match(openInSection, /setCurrentSection\?\.\(section\)/);
  assert.match(openInSection, /url\.searchParams\.set\(paramKey, paramValue\)/);
  assert.doesNotMatch(openInSection, /setTimeout/);
});

test('PolyfaunaOS le pasa setCurrentSection a RadioConsolePage', () => {
  assert.match(polyfaunaOS, /<RadioConsolePage[^>]*setCurrentSection=\{setCurrentSection\} \/>/);
  assert.match(polyfaunaOS, /<RadioConsolePage[^>]*currentTrack=\{currentTrack\}[^>]*setCurrentTrack=\{setCurrentTrack\}/);
});

test('las secciones entran sin espera serial, blur ni scroll animado', () => {
  assert.doesNotMatch(polyfaunaOS, /<AnimatePresence mode="wait">/);
  assert.match(polyfaunaOS, /<AnimatePresence initial=\{false\} mode="popLayout">/);
  assert.doesNotMatch(polyfaunaOS, /filter: 'blur/);
  assert.match(polyfaunaOS, /transition=\{\{ duration: 0\.14, ease: 'easeOut' \}\}/);
  assert.match(polyfaunaOS, /scrollTo\(\{ top: 0, behavior: 'auto' \}\)/);
});
