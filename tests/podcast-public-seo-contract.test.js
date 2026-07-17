import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.jsx', 'utf8');
const shell = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');
const podcastsPage = readFileSync('src/components/PodcastsPage.jsx', 'utf8');
const player = readFileSync('src/components/GlobalPlayer.jsx', 'utf8');
const prerender = readFileSync('tools/prerender-seo.js', 'utf8');
const sitemap = readFileSync('tools/generate-seo.js', 'utf8');
const vercel = readFileSync('vercel.json', 'utf8');
const migration = readFileSync('supabase/migrations/20260717003000_podcast_public_slugs.sql', 'utf8');

test('cada podcast conserva una URL pública canónica dentro del shell', () => {
  assert.match(app, /path="\/podcasts\/:podcast" element=\{<PolyfaunaOS \/>\}/);
  assert.match(shell, /\^\\\/podcasts\\\/\[\^\/\]\+/);
  assert.match(podcastsPage, /podcastPublicUrl/);
  assert.match(podcastsPage, /window\.history\[replace \? 'replaceState' : 'pushState'\]/);
  assert.match(podcastsPage, /window\.addEventListener\('popstate'/);
  assert.doesNotMatch(player, /'\/podcasts\/'/);
});

test('el detalle publica metadatos profesionales y comparte el canonical', () => {
  assert.match(podcastsPage, /<meta property="og:title" content=\{seoTitle\}/);
  assert.match(podcastsPage, /<meta property="og:description" content=\{metaDescription\}/);
  assert.match(podcastsPage, /<meta property="og:image" content=\{socialImage\}/);
  assert.match(podcastsPage, /twitter:card" content="summary_large_image"/);
  assert.match(podcastsPage, /'@type': 'PodcastEpisode'/);
  assert.match(podcastsPage, /const url = canonicalUrl;/);
  assert.doesNotMatch(podcastsPage, /const url = window\.location\.href;/);
});

test('el build genera HTML social, sitemap y rewrite para cada podcast', () => {
  assert.match(prerender, /fetchRows\('podcasts'/);
  assert.match(prerender, /writePage\(`podcasts\/\$\{identifier\}`/);
  assert.match(prerender, /type: 'music\.song'/);
  assert.match(prerender, /imageWidth: 1200, imageHeight: 1200/);
  assert.match(sitemap, /\$\{SITE_URL\}\/podcasts\/\$\{identifier\}/);
  assert.match(vercel, /"source": "\/podcasts\/:podcast", "destination": "\/podcasts\/:podcast\/index\.html"/);
});

test('los slugs de podcast son únicos y se generan automáticamente', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS slug TEXT/);
  assert.match(migration, /CREATE TRIGGER podcasts_set_public_slug/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS podcasts_slug_unique_idx/);
  assert.match(migration, /normalize_podcast_slug/);
});
