import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const uploadField = readFileSync('src/components/admin/UploadField.jsx', 'utf8');
const eventManager = readFileSync('src/components/admin/EventManager.jsx', 'utf8');

test('UploadField soporta un hint opcional, sin afectar a quien no lo pasa (ArtistManager)', () => {
  assert.match(uploadField, /hint = ''/);
  assert.match(uploadField, /\{hint && <p/);
});

test('el campo de imagen de evento indica dimensiones recomendadas', () => {
  assert.match(eventManager, /hint="Recomendado 1600×900px \(16:9\)/);
});
