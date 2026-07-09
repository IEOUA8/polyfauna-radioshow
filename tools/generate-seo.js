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

function writeRobots() {
  fs.writeFileSync(robotsPath,
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
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
  let remoteError = null;
  try {
    [events, artists] = await Promise.all([
      fetchRows('events', 'id,created_at'),
      fetchRows('artists', 'slug,created_at'),
    ]);
  } catch (error) {
    remoteError = error;
    console.warn(`SEO sitemap: no se pudo consultar Supabase (${error.message})`);
  }

  if (remoteError && fs.existsSync(sitemapPath)) {
    writeRobots();
    console.warn(`SEO sitemap: conservando sitemap existente (${countSitemapUrls()} URLs)`);
    return;
  }

  const today = new Date().toISOString();
  const entries = [urlEntry(`${SITE_URL}/`, today, 'daily', '1.0')];
  for (const event of events) {
    if (event.id) entries.push(urlEntry(`${SITE_URL}/e/${event.id}`, event.created_at, 'weekly', '0.8'));
  }
  for (const artist of artists) {
    if (artist.slug) entries.push(urlEntry(`${SITE_URL}/profiles/${artist.slug}`, artist.created_at, 'weekly', '0.7'));
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
