import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const blog = readFileSync('src/components/BlogInterviewsSection.jsx', 'utf8');

test('la portada del artículo conserva un marco 16:9 en lugar de un alto fijo', () => {
  assert.match(blog, /className="relative aspect-video rounded-2xl overflow-hidden"/);
  assert.doesNotMatch(blog, /className="relative rounded-2xl overflow-hidden" style=\{\{ minHeight: 220 \}\}/);
});

test('las portadas aceptan el campo vigente y el legado', () => {
  assert.match(blog, /item\.cover_url \|\| item\.featured_image_url \|\| fallback/);
});
