import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sidebar = readFileSync('src/components/Sidebar.jsx', 'utf8');
const mobileMenu = readFileSync('src/components/MobileMenu.jsx', 'utf8');
const polyfaunaOS = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');
const eventTerminal = readFileSync('src/components/EventTerminal.jsx', 'utf8');

test('Event Terminal es accesible para invitados desde sidebar y menú móvil', () => {
  // Antes: PolyfaunaOS ya dejaba pasar a invitados (PUBLIC_SECTIONS), pero
  // el ítem de nav seguía marcado public:false — en el sidebar el candado
  // era solo visual (el click igual navegaba), pero en el menú móvil sí
  // bloqueaba genuinamente el acceso.
  assert.match(sidebar, /\{ id: 'events',\s+label: 'Event Terminal',\s+icon: CalendarDays,\s+public: true/);
  assert.match(mobileMenu, /\{ id: 'events',\s+label: 'Eventos',\s+icon: CalendarDays,\s+public: true/);
  assert.match(polyfaunaOS, /PUBLIC_SECTIONS\s*=\s*\[[^\]]*'events'[^\]]*\]/);
});

test('el flujo de compra ya invita a iniciar sesión en el momento de comprar, no antes', () => {
  assert.match(eventTerminal, /Iniciar sesión para comprar/);
  assert.match(eventTerminal, /if \(!currentUser\) \{\s*\n\s*onClose\(\);\s*\n\s*navigate\('\/login'\);/);
});
