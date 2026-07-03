#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://www.polyfauna.com';
const DEFAULT_COVER = `${SITE_URL}/icons/og-cover.png`;

const SOCIAL_BUILDERS = {
  instagram:  (h) => `https://instagram.com/${h}`,
  twitter:    (h) => `https://x.com/${h}`,
  bandcamp:   (h) => h.includes('.') ? `https://${h}` : `https://${h}.bandcamp.com`,
  soundcloud: (h) => `https://soundcloud.com/${h}`,
  website:    (h) => h.startsWith('http') ? h : `https://${h}`,
};

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;',
  }[char]));
}

async function fetchRows(table, select) {
  const baseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return [];
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
  return response.json();
}

function replaceMeta(html, attribute, key, content) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" data-react-helmet="true" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function pageHtml(template, { title, description, canonical, image, type, schema }) {
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, 'name', 'description', description);
  html = replaceMeta(html, 'name', 'robots', 'index, follow, max-image-preview:large');
  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:type', type);
  html = replaceMeta(html, 'property', 'og:image', image);
  html = replaceMeta(html, 'property', 'og:image:secure_url', image);
  html = replaceMeta(html, 'property', 'og:image:alt', title);
  html = replaceMeta(html, 'name', 'twitter:title', title);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = replaceMeta(html, 'name', 'twitter:image', image);
  html = html.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" data-react-helmet="true" />`);
  html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>\n  </head>`);
  return html;
}

function writePage(relativePath, html) {
  const directory = path.join(process.cwd(), 'dist', relativePath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), html);
}

async function main() {
  loadLocalEnv();
  const templatePath = path.join(process.cwd(), 'dist', 'index.html');
  if (!fs.existsSync(templatePath)) throw new Error('dist/index.html no existe');
  const template = fs.readFileSync(templatePath, 'utf8');

  const events = await fetchRows('events', 'id,title,description,date,venue,city,image_url,price,lineup,status,tickets_total,tickets_sold');
  const artists = await fetchRows('artists', 'name,slug,type,bio,genres,image_url,social_links');

  if (events.length === 0 && artists.length === 0) {
    console.log('SEO prerender: sin datos remotos, se conserva dist/index.html');
    return;
  }

  for (const event of events) {
    if (!event.id) continue;
    const canonical = `${SITE_URL}/e/${event.id}`;
    const image = event.image_url || DEFAULT_COVER;
    const description = event.description || `${event.venue || 'Evento de música electrónica'} · ${event.city || 'Colombia'}`;
    const lineup = Array.isArray(event.lineup) ? event.lineup : [];
    const soldOut = Number(event.tickets_sold || 0) >= Number(event.tickets_total || 0);
    const schema = {
      '@context': 'https://schema.org', '@type': 'Event', name: event.title,
      description, image: [image], startDate: event.date,
      eventStatus: event.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: event.venue || event.city || 'POLYFAUNA', address: { '@type': 'PostalAddress', addressLocality: event.city || 'Bogotá', addressCountry: 'CO' } },
      offers: { '@type': 'Offer', url: canonical, price: Number(event.price || 0), priceCurrency: 'COP', availability: soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' },
      organizer: { '@type': 'Organization', name: 'POLYFAUNA', url: `${SITE_URL}/` },
      performer: lineup.map(name => ({ '@type': 'MusicGroup', name: String(name) })), url: canonical,
    };
    writePage(`e/${event.id}`, pageHtml(template, { title: `${event.title} — POLYFAUNA`, description, canonical, image, type: 'website', schema }));
  }

  for (const artist of artists) {
    if (!artist.slug) continue;
    const canonical = `${SITE_URL}/profiles/${artist.slug}`;
    const image = artist.image_url || DEFAULT_COVER;
    const description = artist.bio
      ? String(artist.bio).slice(0, 300)
      : `${artist.name} en POLYFAUNA — música electrónica underground de Colombia.`;
    const genres = artist.genres
      ? (Array.isArray(artist.genres) ? artist.genres : String(artist.genres).split(','))
      : [];
    const links = typeof artist.social_links === 'object' && artist.social_links ? artist.social_links : {};
    const sameAs = Object.entries(SOCIAL_BUILDERS)
      .map(([key, build]) => (links[key] ? build(links[key]) : null))
      .filter(Boolean);
    const schema = {
      '@context': 'https://schema.org', '@type': 'MusicGroup', name: artist.name,
      description, image, url: canonical, genre: genres,
      ...(sameAs.length > 0 ? { sameAs } : {}),
    };
    writePage(`profiles/${artist.slug}`, pageHtml(template, { title: `${artist.name} — POLYFAUNA`, description, canonical, image, type: 'profile', schema }));
  }

  console.log(`SEO prerender: ${events.length} eventos · ${artists.filter(a => a.slug).length} artistas`);
}

main().catch(error => {
  console.error(`SEO prerender failed: ${error.message}`);
  console.warn('SEO prerender skipped: deploy continuará con la app SPA.');
});
