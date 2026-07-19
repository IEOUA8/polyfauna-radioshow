import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Supabase and R2 image upload fields render a preview before saving', () => {
  for (const component of [
    'src/components/admin/UploadField.jsx',
    'src/components/admin/R2UploadField.jsx',
  ]) {
    const source = read(component);
    assert.match(source, /showsImagePreview/);
    assert.match(source, /Vista previa antes de guardar/);
    assert.match(source, /<img src=\{value\}/);
    assert.match(source, /previewAspect \|\| '1 \/ 1'/);
  }
});

test('audio uploads do not render an image preview', () => {
  const source = read('src/components/admin/R2UploadField.jsx');
  assert.match(source, /startsWith\('image\/'\)/);
  assert.match(source, /value && showsImagePreview/);
});

test('event artwork keeps its intended responsive preview ratios', () => {
  const source = read('src/components/admin/EventManager.jsx');
  assert.match(source, /previewAspect="16 \/ 9"/);
  assert.match(source, /previewAspect="4 \/ 5"/);
  assert.match(source, /previewAspect="2 \/ 1"/);
});
