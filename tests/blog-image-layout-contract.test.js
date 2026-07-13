import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const blog = readFileSync('src/components/BlogInterviewsSection.jsx', 'utf8');
const serviceWorker = readFileSync('public/sw.js', 'utf8');
const vercel = readFileSync('vercel.json', 'utf8');

test('la portada del artículo conserva un marco 16:9 en lugar de un alto fijo', () => {
  assert.match(blog, /className="relative aspect-video rounded-2xl overflow-hidden"/);
  assert.doesNotMatch(blog, /className="relative rounded-2xl overflow-hidden" style=\{\{ minHeight: 220 \}\}/);
});

test('las portadas aceptan el campo vigente y el legado', () => {
  assert.match(blog, /item\.cover_url \|\| item\.featured_image_url \|\| fallback/);
});

test('móvil prioriza la portada y difiere las figuras del artículo', () => {
  assert.match(blog, /loading="eager" fetchPriority="high" decoding="async"/);
  assert.match(blog, /alt=\{alt \|\| caption \|\| ''\} loading="lazy" decoding="async"/);
});

test('la PWA revalida imágenes y elimina el runtime cache anterior', () => {
  assert.match(serviceWorker, /CACHE_VERSION = 'polyfauna-v5'/);
  assert.match(serviceWorker, /request\.destination === 'image'/);
  assert.match(serviceWorker, /event\.waitUntil\(refreshed\.catch/);
});

test('los assets editoriales reciben caché HTTP explícita', () => {
  assert.match(vercel, /\/blog\/\(\.\*\)\.\(webp\|jpg\|jpeg\|png\|avif\)/);
  assert.match(vercel, /max-age=86400, stale-while-revalidate=604800/);
});
