#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://www.polyfauna.com';
const publicDir = path.join(process.cwd(), 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const robotsPath = path.join(publicDir, 'robots.txt');

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function xml(value) {
  return String(value).replace(/[<>&'"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[char]));
}

async function fetchRows(table, select) {
  const baseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) throw new Error('Supabase env no configurada');

  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
  return response.json();
}

function urlEntry(location, lastModified, changefreq, priority) {
  return `  <url>\n    <loc>${xml(location)}</loc>${lastModified ? `\n    <lastmod>${xml(lastModified.slice(0, 10))}</lastmod>` : ''}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

// Crawlers de IA/investigación a los que damos bienvenida explícita para que
// POLYFAUNA aparezca en respuestas de ChatGPT, Claude, Perplexity, Gemini, etc.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',       // OpenAI
  'ClaudeBot', 'Claude-Web', 'anthropic-ai',       // Anthropic
  'PerplexityBot', 'Perplexity-User',              // Perplexity
  'Google-Extended', 'Googlebot',                  // Google (Gemini / Search)
  'Applebot-Extended', 'Applebot',                 // Apple
  'Bingbot', 'CCBot', 'Amazonbot', 'Bytespider', 'DuckAssistBot', 'cohere-ai', 'Meta-ExternalAgent',
];

function writeRobots() {
  const aiBlocks = AI_CRAWLERS.map(bot => `User-agent: ${bot}\nAllow: /`).join('\n\n');
  fs.writeFileSync(robotsPath,
    `# POLYFAUNA — archivo abierto de la escena electrónica colombiana.\n` +
    `# Buscadores y asistentes de IA pueden rastrear e indexar libremente.\n` +
    `# Mapa curado para IA: ${SITE_URL}/llms.txt\n\n` +
    `User-agent: *\nAllow: /\n\n` +
    `${aiBlocks}\n\n` +
    `Sitemap: ${SITE_URL}/sitemap.xml\nHost: ${SITE_URL}\n`);
}

function countSitemapUrls() {
  if (!fs.existsSync(sitemapPath)) return 0;
  return (fs.readFileSync(sitemapPath, 'utf8').match(/<loc>/g) || []).length;
}

async function main() {
  loadLocalEnv();
  fs.mkdirSync(publicDir, { recursive: true });

  let events = [];
  let artists = [];
  let organizers = [];
  let podcasts = [];
  let articles = [];
  let remoteError = null;
  try {
    [events, artists, organizers] = await Promise.all([
      fetchRows('events', 'id,created_at'),
      fetchRows('artists', 'slug,created_at'),
      fetchRows('organizers', 'slug,created_at'),
    ]);
  } catch (error) {
    remoteError = error;
    console.warn(`SEO sitemap: no se pudo consultar Supabase (${error.message})`);
  }
  try {
    podcasts = await fetchRows('podcasts', 'id,slug,created_at');
  } catch (error) {
    try {
      podcasts = await fetchRows('podcasts', 'id,created_at');
    } catch (fallbackError) {
      console.warn(`SEO sitemap: podcasts omitidos (${fallbackError.message})`);
    }
  }
  // Artículos aparte: si la columna slug aún no existe, no debe tumbar todo.
  try {
    articles = await fetchRows('blog_articles', 'slug,published_at,created_at');
  } catch (error) {
    console.warn(`SEO sitemap: artículos omitidos (${error.message})`);
  }

  if (remoteError && fs.existsSync(sitemapPath)) {
    writeRobots();
    console.warn(`SEO sitemap: conservando sitemap existente (${countSitemapUrls()} URLs)`);
    return;
  }

  const today = new Date().toISOString();
  const entries = [urlEntry(`${SITE_URL}/`, today, 'daily', '1.0')];
  // Índice del blog: solo si hay artículos publicados (la página /blog se
  // prerenderiza en ese caso).
  const latestArticle = articles
    .filter(a => a.slug)
    .map(a => a.published_at || a.created_at)
    .sort()
    .pop();
  if (latestArticle) entries.push(urlEntry(`${SITE_URL}/blog`, latestArticle, 'weekly', '0.8'));
  for (const event of events) {
    if (event.id) entries.push(urlEntry(`${SITE_URL}/e/${event.id}`, event.created_at, 'weekly', '0.8'));
  }
  for (const artist of artists) {
    if (artist.slug) entries.push(urlEntry(`${SITE_URL}/profiles/${artist.slug}`, artist.created_at, 'weekly', '0.7'));
  }
  for (const organizer of organizers) {
    if (organizer.slug) entries.push(urlEntry(`${SITE_URL}/organizadores/${organizer.slug}`, organizer.created_at, 'weekly', '0.7'));
  }
  for (const podcast of podcasts) {
    const identifier = podcast.slug || podcast.id;
    if (identifier) entries.push(urlEntry(`${SITE_URL}/podcasts/${identifier}`, podcast.created_at, 'monthly', '0.7'));
  }
  for (const article of articles) {
    if (article.slug) entries.push(urlEntry(`${SITE_URL}/blog/${article.slug}`, article.published_at || article.created_at, 'monthly', '0.6'));
  }

  fs.writeFileSync(sitemapPath,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`);

  writeRobots();

  console.log(`SEO sitemap: ${entries.length} URLs`);
}

main().catch(error => {
  console.error(`SEO generation failed: ${error.message}`);
  process.exitCode = 1;
});
