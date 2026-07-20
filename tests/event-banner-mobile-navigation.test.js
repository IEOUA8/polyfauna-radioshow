import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const eventTerminal = readFileSync('src/components/EventTerminal.jsx', 'utf8');

test('las flechas del banner de eventos se agrupan abajo a la derecha en móvil', () => {
  assert.match(eventTerminal, /flex items-center justify-between gap-4 mt-5/);
  assert.match(eventTerminal, /flex items-center gap-2 shrink-0 sm:contents/);
  assert.match(eventTerminal, /w-11 h-11 sm:w-10 sm:h-10/);
});

test('en escritorio las flechas conservan los laterales del banner', () => {
  assert.match(eventTerminal, /sm:absolute sm:left-3 sm:top-1\/2 sm:-translate-y-1\/2/);
  assert.match(eventTerminal, /sm:absolute sm:right-3 sm:top-1\/2 sm:-translate-y-1\/2/);
});
