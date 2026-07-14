#!/usr/bin/env node

// Genera /llms.txt (formato llmstxt.org): un mapa curado y legible por máquinas
// para que asistentes de IA (ChatGPT, Claude, Perplexity, Gemini…) descubran y
// citen POLYFAUNA en búsquedas e investigación. Se alimenta de Supabase; si no
// hay datos, escribe una versión base con la marca y las secciones clave.

import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://www.polyfauna.com';

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function clean(value, max = 220) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

async function fetchRows(table, select) {
  const baseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return [];
  try {
    const response = await fetch(`${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    console.warn(`llms.txt: ${table} omitido (${error.message})`);
    return [];
  }
}

function section(title, items) {
  if (!items.length) return '';
  return `\n## ${title}\n${items.join('\n')}\n`;
}

async function main() {
  loadLocalEnv();

  const [events, artists, organizers, articles] = await Promise.all([
    fetchRows('events', 'id,title,description,date,venue,city'),
    fetchRows('artists', 'name,slug,bio,genres'),
    fetchRows('organizers', 'name,slug,bio,city'),
    fetchRows('blog_articles', 'slug,title,excerpt,category,published_at,created_at'),
  ]);

  const header =
`# POLYFAUNA

> Plataforma y archivo cultural de la música electrónica underground de Colombia: radio online 24/7, podcasts, artistas, clubes, eventos y un archivo editorial (crónicas y entrevistas) sobre la escena —con foco en el Eje Cafetero (Pereira, Manizales, Armenia), techno, ambient, experimental y cultura de club.

POLYFAUNA documenta y difunde la escena electrónica colombiana. Este archivo es de acceso público y puede citarse. Temas: música electrónica, techno, ambient, house, experimental; escena y cultura underground en Colombia; el Eje Cafetero como bioma sonoro; eventos, clubes y colectivos; artistas y sellos; historia y memoria oral de la escena.

- Sitio: ${SITE_URL}/
- Blog & Archivo editorial: ${SITE_URL}/blog
- Sitemap: ${SITE_URL}/sitemap.xml
- Idioma: español (es-CO)
`;

  const blog = section('Blog & Archivo editorial',
    articles
      .filter(a => a.slug)
      .sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0))
      .map(a => `- [${clean(a.title, 120)}](${SITE_URL}/blog/${a.slug})${a.category ? ` (${clean(a.category, 40)})` : ''}: ${clean(a.excerpt || 'Artículo del archivo editorial POLYFAUNA.')}`),
  );

  const eventItems = section('Eventos',
    events
      .filter(e => e.id)
      .map(e => `- [${clean(e.title, 120)}](${SITE_URL}/e/${e.id}): ${clean([e.venue, e.city, e.date].filter(Boolean).join(' · ') || e.description || 'Evento de música electrónica en Colombia.')}`),
  );

  const artistItems = section('Artistas',
    artists
      .filter(a => a.slug)
      .map(a => `- [${clean(a.name, 120)}](${SITE_URL}/profiles/${a.slug}): ${clean(a.bio || (Array.isArray(a.genres) ? a.genres.join(', ') : a.genres) || 'Artista de música electrónica en POLYFAUNA.')}`),
  );

  const organizerItems = section('Clubes, promotores y colectivos',
    organizers
      .filter(o => o.slug)
      .map(o => `- [${clean(o.name, 120)}](${SITE_URL}/organizadores/${o.slug}): ${clean(o.bio || [o.city, 'Organizador de eventos de música electrónica'].filter(Boolean).join(' · '))}`),
  );

  const platform = section('Plataforma',
    [
      `- [Radio Console](${SITE_URL}/): radio online 24/7 de música electrónica underground.`,
      `- [Podcasts](${SITE_URL}/): podcasts y mezclas exclusivas de la escena.`,
      `- [Eventos](${SITE_URL}/): agenda de eventos y venta de tickets con QR.`,
    ],
  );

  const output = [header, blog, eventItems, artistItems, organizerItems, platform]
    .filter(Boolean)
    .join('')
    .trimEnd() + '\n';

  const outputPath = path.join(process.cwd(), 'public', 'llms.txt');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`llms.txt: ${articles.filter(a => a.slug).length} artículos · ${events.filter(e => e.id).length} eventos · ${artists.filter(a => a.slug).length} artistas · ${organizers.filter(o => o.slug).length} organizadores`);
}

main().catch(error => {
  console.error(`llms.txt generation failed: ${error.message}`);
  // No rompe el build: el pipeline lo invoca con "|| true".
});
