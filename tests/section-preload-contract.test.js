import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sectionPreload = readFileSync('src/lib/sectionPreload.js', 'utf8');
const sidebar = readFileSync('src/components/Sidebar.jsx', 'utf8');
const bottomNav = readFileSync('src/components/BottomNav.jsx', 'utf8');
const mobileMenu = readFileSync('src/components/MobileMenu.jsx', 'utf8');
const polyfaunaOS = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');

test('sectionPreload cubre las mismas secciones lazy que PolyfaunaOS', () => {
  // Si un id de sección no está en este mapa, el hover/touch no hace nada
  // (no rompe, pero tampoco ayuda) — hay que mantenerlos en sync.
  for (const section of ['radio-console', 'podcasts', 'music', 'organism', 'events', 'artists', 'organizers', 'blog', 'inbox', 'tickets', 'settings']) {
    assert.match(sectionPreload, new RegExp(`['"]?${section}['"]?:\\s*\\(\\) => import`));
  }
  assert.match(polyfaunaOS, /lazyImport\(\(\) => import/);
});

test('el sidebar de escritorio precarga el chunk al pasar el mouse, antes del click', () => {
  assert.match(sidebar, /onMouseEnter=\{\(\) => preloadSection\(item\.id\)\}/);
});

test('bottom nav y menu móvil precargan al primer toque (no hay hover en touch)', () => {
  assert.match(bottomNav, /onTouchStart=\{\(\) => !locked && preloadSection\(id\)\}/);
  assert.match(mobileMenu, /onTouchStart=\{locked \|\| item\.href \? undefined : \(\) => preloadSection\(item\.id\)\}/);
});

test('preloadSection no repite el import si la sección ya se precargó', () => {
  assert.match(sectionPreload, /const preloaded = new Set\(\);/);
  assert.match(sectionPreload, /if \(preloaded\.has\(sectionId\)\) return;/);
});
