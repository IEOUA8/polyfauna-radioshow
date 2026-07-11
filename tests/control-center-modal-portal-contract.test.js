import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controlCenter = readFileSync('src/components/ControlCenter.jsx', 'utf8');

test('TextModal y DeactivateModal usan createPortal a document.body', () => {
  // Sin portal, estos modales heredan el transform del motion.div que anima
  // el cambio de sección en PolyfaunaOS.jsx — cualquier transform en un
  // ancestro rompe position:fixed (se posiciona relativo a ese ancestro, no
  // al viewport). Síntoma real reportado: el modal de "Reportar un problema"
  // aparecía muy abajo en la página con scroll largo, en vez de centrado.
  assert.match(controlCenter, /import \{ createPortal \} from 'react-dom';/);

  const textModalMatch = controlCenter.match(/function TextModal\([^)]*\) \{[\s\S]*?\n\}/);
  assert.ok(textModalMatch, 'TextModal no encontrado');
  assert.match(textModalMatch[0], /return createPortal\(/);
  assert.match(textModalMatch[0], /document\.body/);

  const deactivateModalMatch = controlCenter.match(/function DeactivateModal\([^)]*\) \{[\s\S]*?\n\}/);
  assert.ok(deactivateModalMatch, 'DeactivateModal no encontrado');
  assert.match(deactivateModalMatch[0], /return createPortal\(/);
  assert.match(deactivateModalMatch[0], /document\.body/);
});
