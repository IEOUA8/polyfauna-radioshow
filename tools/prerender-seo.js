#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://www.polyfauna.com';
const DEFAULT_COVER = `${SITE_URL}/icons/og-cover.png`;

// Palabras clave transversales de la marca: refuerzan el posicionamiento
// temático (música electrónica, escena, archivo cultural) en cada artículo.
const BASE_KEYWORDS = [
  'música electrónica', 'techno', 'ambient', 'escena electrónica', 'cultura underground',
  'Eje Cafetero', 'Colombia', 'eventos de música electrónica', 'archivo cultural', 'POLYFAUNA',
];

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

// ── Cuerpo rico (content_format='blocks') → texto/HTML para crawlers ──────────
// El SPA pinta el artículo en cliente; los buscadores y —sobre todo— los
// crawlers de IA (GPTBot, ClaudeBot, PerplexityBot…) leen el HTML crudo. Aquí
// aplanamos los bloques a texto plano (para schema.org articleBody) y a HTML
// semántico (para un <noscript> indexable). Así el contenido completo viaja en
// la respuesta estática, no solo el título.
function parseBlocks(content, contentFormat) {
  if (contentFormat !== 'blocks' || !content) return null;
  try {
    const blocks = JSON.parse(content);
    return Array.isArray(blocks) ? blocks : null;
  } catch {
    return null;
  }
}

function blocksToPlainText(blocks) {
  if (!blocks) return '';
  const parts = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'section':   parts.push(`§ ${b.label || ''}`); break;
      case 'heading':   parts.push(b.text); break;
      case 'lead':      parts.push(b.text); break;
      case 'p':         parts.push(b.text); break;
      case 'pullquote': parts.push(`«${b.text}»`); break;
      case 'stratum':   parts.push([b.marker, b.label, b.text, b.note].filter(Boolean).join(' — ')); break;
      case 'habitats':  (b.items || []).forEach(it => parts.push(`${it.species} · ${it.city}: ${it.text}`)); break;
      case 'figure':    if (b.caption) parts.push(b.caption); break;
      case 'signoff':   parts.push(b.text); break;
      default:          break;
    }
  }
  return parts.filter(Boolean).join('\n\n');
}

function blocksToHtml(blocks) {
  if (!blocks) return '';
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'section':   out.push(`<h2>${escapeHtml(b.label)}</h2>`); break;
      case 'heading':   out.push(`<h2>${escapeHtml(b.text)}</h2>`); break;
      case 'lead':      out.push(`<p><em>${escapeHtml(b.text)}</em></p>`); break;
      case 'p':         out.push(`<p>${escapeHtml(b.text)}</p>`); break;
      case 'pullquote': out.push(`<blockquote>${escapeHtml(b.text)}</blockquote>`); break;
      case 'stratum':   out.push(`<p><strong>${escapeHtml([b.marker, b.label].filter(Boolean).join(' '))}</strong> — ${escapeHtml(b.text)}${b.note ? ` <small>${escapeHtml(b.note)}</small>` : ''}</p>`); break;
      case 'habitats':  (b.items || []).forEach(it => out.push(`<h3>${escapeHtml(it.species)} · ${escapeHtml(it.city)}</h3><p>${escapeHtml(it.text)}</p>`)); break;
      case 'figure':    if (b.src) out.push(`<figure><img src="${escapeHtml(String(b.src).startsWith('http') ? b.src : SITE_URL + b.src)}" alt="${escapeHtml(b.alt || b.caption || '')}" loading="lazy" />${b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : ''}</figure>`); break;
      case 'signoff':   out.push(`<footer>${escapeHtml(b.text)}</footer>`); break;
      default:          break;
    }
  }
  return out.join('\n');
}

function countWords(text) {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function compactDescription(value, fallback, limit = 200) {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, limit);
}

function durationToIso(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return undefined;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${secs || (!hours && !minutes) ? `${secs}S` : ''}`;
}

function imageMimeType(url) {
  if (/\.png(?:\?|$)/i.test(url)) return 'image/png';
  if (/\.webp(?:\?|$)/i.test(url)) return 'image/webp';
  if (/\.avif(?:\?|$)/i.test(url)) return 'image/avif';
  return 'image/jpeg';
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

function appendHead(html, snippet) {
  return html.replace('</head>', `    ${snippet}\n  </head>`);
}

function pageHtml(template, opts) {
  const {
    title, description, canonical, image, type, schema,
    keywords, extraSchemas = [], noscriptBody, articleMeta,
    imageWidth = 1200, imageHeight = 630,
  } = opts;

  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, 'name', 'description', description);
  if (keywords) html = replaceMeta(html, 'name', 'keywords', keywords);
  html = replaceMeta(html, 'name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1');
  html = replaceMeta(html, 'property', 'og:site_name', 'POLYFAUNA');
  html = replaceMeta(html, 'property', 'og:title', title);
  html = replaceMeta(html, 'property', 'og:description', description);
  html = replaceMeta(html, 'property', 'og:url', canonical);
  html = replaceMeta(html, 'property', 'og:type', type);
  html = replaceMeta(html, 'property', 'og:image:width', String(imageWidth));
  html = replaceMeta(html, 'property', 'og:image:height', String(imageHeight));
  html = replaceMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = replaceMeta(html, 'property', 'og:image', image);
  html = replaceMeta(html, 'property', 'og:image:secure_url', image);
  html = replaceMeta(html, 'property', 'og:image:type', imageMimeType(image));
  html = replaceMeta(html, 'property', 'og:image:alt', title);
  html = replaceMeta(html, 'name', 'twitter:title', title);
  html = replaceMeta(html, 'name', 'twitter:description', description);
  html = replaceMeta(html, 'name', 'twitter:image', image);
  html = html.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" data-react-helmet="true" />`);

  // Metadatos específicos de artículo (Open Graph "article").
  if (articleMeta) {
    if (articleMeta.publishedTime) html = appendHead(html, `<meta property="article:published_time" content="${escapeHtml(articleMeta.publishedTime)}" data-react-helmet="true" />`);
    if (articleMeta.modifiedTime)  html = appendHead(html, `<meta property="article:modified_time" content="${escapeHtml(articleMeta.modifiedTime)}" data-react-helmet="true" />`);
    if (articleMeta.section)       html = appendHead(html, `<meta property="article:section" content="${escapeHtml(articleMeta.section)}" data-react-helmet="true" />`);
    for (const tag of (articleMeta.tags || [])) html = appendHead(html, `<meta property="article:tag" content="${escapeHtml(tag)}" data-react-helmet="true" />`);
  }

  // JSON-LD principal + esquemas extra (breadcrumbs, etc.).
  for (const s of [schema, ...extraSchemas]) {
    html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(s).replace(/</g, '\\u003c')}</script>\n  </head>`);
  }

  // Contenido indexable sin JS: los crawlers de IA leen el HTML crudo. Va en
  // <noscript> —fallback legítimo de una SPA, sin cloaking— justo tras <body>.
  if (noscriptBody) {
    html = html.replace(/(<body[^>]*>)/i, `$1\n    <noscript>\n${noscriptBody}\n    </noscript>`);
  }

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
  const organizers = await fetchRows('organizers', 'name,slug,type,bio,city,image_url,social_links');
  let podcasts = [];
  try {
    podcasts = await fetchRows('podcasts', 'id,slug,title,description,cover_url,audio_url,duration,genre,created_at,artists:artists!podcasts_artist_id_fkey(name,slug)');
  } catch (error) {
    // El primer deploy puede correr antes de que la migración de slug haya
    // terminado; el UUID sigue siendo una URL pública válida en ese caso.
    try {
      podcasts = await fetchRows('podcasts', 'id,title,description,cover_url,audio_url,duration,genre,created_at,artists:artists!podcasts_artist_id_fkey(name,slug)');
    } catch (fallbackError) {
      console.warn(`SEO prerender: podcasts omitidos (${fallbackError.message})`);
    }
  }
  // Los artículos pueden no tener aún la columna slug si esta migración no
  // corrió; se aísla para no tumbar el resto del prerender.
  let articles = [];
  try {
    articles = await fetchRows('blog_articles', 'id,slug,title,excerpt,category,author,cover_url,content,content_format,published_at,created_at');
  } catch (error) {
    console.warn(`SEO prerender: artículos omitidos (${error.message})`);
  }

  if (events.length === 0 && artists.length === 0 && organizers.length === 0 && podcasts.length === 0 && articles.length === 0) {
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

  for (const organizer of organizers) {
    if (!organizer.slug) continue;
    const canonical = `${SITE_URL}/organizadores/${organizer.slug}`;
    const image = organizer.image_url || DEFAULT_COVER;
    const description = organizer.bio
      ? String(organizer.bio).slice(0, 300)
      : `${organizer.name} en POLYFAUNA — clubes, promotores y colectivos de música electrónica en Colombia.`;
    const links = typeof organizer.social_links === 'object' && organizer.social_links ? organizer.social_links : {};
    const sameAs = Object.entries(SOCIAL_BUILDERS)
      .map(([key, build]) => (links[key] ? build(links[key]) : null))
      .filter(Boolean);
    const schema = {
      '@context': 'https://schema.org', '@type': 'Organization', name: organizer.name,
      description, image, url: canonical,
      ...(organizer.city ? { address: { '@type': 'PostalAddress', addressLocality: organizer.city, addressCountry: 'CO' } } : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
    };
    writePage(`organizadores/${organizer.slug}`, pageHtml(template, { title: `${organizer.name} — POLYFAUNA`, description, canonical, image, type: 'profile', schema }));
  }

  for (const podcast of podcasts) {
    if (!podcast.id) continue;
    const identifier = podcast.slug || podcast.id;
    const canonical = `${SITE_URL}/podcasts/${identifier}`;
    const image = podcast.cover_url || DEFAULT_COVER;
    const artistName = podcast.artists?.name || 'POLYFAUNA';
    const description = compactDescription(
      podcast.description,
      `Escucha ${podcast.title} de ${artistName} en POLYFAUNA, archivo sonoro de música electrónica independiente.`
    );
    const duration = durationToIso(podcast.duration);
    const schema = {
      '@context': 'https://schema.org', '@type': 'PodcastEpisode',
      name: podcast.title, description, image, url: canonical, inLanguage: 'es-CO',
      ...(podcast.created_at ? { datePublished: podcast.created_at } : {}),
      ...(duration ? { duration } : {}),
      associatedMedia: {
        '@type': 'AudioObject', name: podcast.title,
        ...(podcast.audio_url ? { contentUrl: podcast.audio_url } : {}),
        ...(duration ? { duration } : {}),
      },
      partOfSeries: { '@type': 'PodcastSeries', name: 'Podcasts POLYFAUNA', url: `${SITE_URL}/?section=podcasts` },
      publisher: { '@type': 'Organization', name: 'POLYFAUNA', url: SITE_URL },
      ...(podcast.artists?.name ? { actor: { '@type': 'Person', name: podcast.artists.name } } : {}),
    };
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Podcasts', item: `${SITE_URL}/?section=podcasts` },
        { '@type': 'ListItem', position: 3, name: podcast.title, item: canonical },
      ],
    };
    const noscriptBody = `      <main><article><img src="${escapeHtml(image)}" alt="Portada de ${escapeHtml(podcast.title)}" /><h1>${escapeHtml(podcast.title)}</h1><p>Publicado por ${escapeHtml(artistName)}</p><p>${escapeHtml(description)}</p><p><a href="${escapeHtml(canonical)}">Escuchar en POLYFAUNA</a></p></article></main>`;
    const renderedPodcastPage = pageHtml(template, {
      title: `${podcast.title} — ${artistName} | POLYFAUNA`,
      description, canonical, image, type: 'music.song', schema,
      extraSchemas: [breadcrumb], noscriptBody, imageWidth: 1200, imageHeight: 1200,
      keywords: [...new Set([podcast.genre, 'podcast música electrónica', artistName, ...BASE_KEYWORDS].filter(Boolean))].join(', '),
    });
    writePage(`podcasts/${identifier}`, renderedPodcastPage);
    if (podcast.slug && podcast.slug !== podcast.id) {
      // Mantiene compatibles enlaces antiguos basados en UUID; ambos declaran
      // la URL amigable como canonical para evitar contenido duplicado.
      writePage(`podcasts/${podcast.id}`, renderedPodcastPage);
    }
  }

  // ── Índice del Blog (/blog) ────────────────────────────────────────────────
  const publishedArticles = articles
    .filter(a => a.slug)
    .sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));

  if (publishedArticles.length > 0) {
    const canonical = `${SITE_URL}/blog`;
    const description = 'Crónicas, entrevistas y archivo cultural de la escena de música electrónica en Colombia: techno, ambient, eventos y cultura underground del Eje Cafetero, documentados por POLYFAUNA.';
    const itemList = {
      '@type': 'ItemList',
      itemListElement: publishedArticles.map((a, i) => ({
        '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/blog/${a.slug}`, name: a.title,
      })),
    };
    const schema = {
      '@context': 'https://schema.org', '@type': 'Blog',
      '@id': `${canonical}#blog`, name: 'Blog & Archivo editorial POLYFAUNA',
      description, url: canonical, inLanguage: 'es-CO',
      publisher: { '@type': 'Organization', name: 'POLYFAUNA', url: `${SITE_URL}/` },
      mainEntity: itemList,
    };
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: canonical },
      ],
    };
    const noscriptBody = `      <main><h1>Blog &amp; Archivo editorial POLYFAUNA</h1><p>${escapeHtml(description)}</p><ul>\n${
      publishedArticles.map(a => `        <li><a href="${SITE_URL}/blog/${a.slug}">${escapeHtml(a.title)}</a>${a.excerpt ? ` — ${escapeHtml(String(a.excerpt))}` : ''}</li>`).join('\n')
    }\n      </ul></main>`;
    writePage('blog', pageHtml(template, {
      title: 'Blog & Archivo editorial — POLYFAUNA',
      description, canonical, image: DEFAULT_COVER, type: 'website',
      keywords: [...new Set(['blog música electrónica', 'archivo cultural', 'crónica', 'entrevistas', ...BASE_KEYWORDS])].join(', '),
      schema, extraSchemas: [breadcrumb], noscriptBody,
    }));
  }

  for (const article of publishedArticles) {
    const canonical = `${SITE_URL}/blog/${article.slug}`;
    // Imagen social branded en JPG (og.jpg vive junto a las imágenes del
    // artículo). Fallback a la portada o al cover por defecto.
    const image = `${SITE_URL}/blog/${article.slug}/og.jpg`;
    const published = article.published_at || article.created_at;
    const description = article.excerpt
      ? String(article.excerpt).slice(0, 300)
      : `${article.title} — Archivo editorial POLYFAUNA.`;

    const blocks = parseBlocks(article.content, article.content_format);
    const bodyText = blocksToPlainText(blocks) || String(article.content || '');
    const bodyHtml = blocksToHtml(blocks);
    const keywords = [...new Set([article.category, ...BASE_KEYWORDS].filter(Boolean))].join(', ');

    const schema = {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: article.title, description, image: [image], inLanguage: 'es-CO',
      ...(published ? { datePublished: published, dateModified: published } : {}),
      author: { '@type': 'Organization', name: article.author || 'POLYFAUNA', url: `${SITE_URL}/` },
      publisher: {
        '@type': 'Organization', name: 'POLYFAUNA',
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/og-cover.png` },
      },
      ...(article.category ? { articleSection: article.category } : {}),
      keywords,
      about: [
        { '@type': 'Thing', name: 'Música electrónica' },
        { '@type': 'Place', name: 'Eje Cafetero, Colombia' },
      ],
      ...(bodyText ? { articleBody: bodyText, wordCount: countWords(bodyText) } : {}),
      isPartOf: { '@type': 'Blog', '@id': `${SITE_URL}/blog#blog`, name: 'Blog & Archivo editorial POLYFAUNA' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      url: canonical,
    };
    const breadcrumb = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: article.title, item: canonical },
      ],
    };
    const noscriptBody = `      <main><article><h1>${escapeHtml(article.title)}</h1>${
      article.excerpt ? `<p><em>${escapeHtml(String(article.excerpt))}</em></p>` : ''
    }\n${bodyHtml || `<p>${escapeHtml(bodyText)}</p>`}\n      </article></main>`;

    writePage(`blog/${article.slug}`, pageHtml(template, {
      title: `${article.title} — POLYFAUNA`, description, canonical, image, type: 'article',
      keywords, schema, extraSchemas: [breadcrumb], noscriptBody,
      articleMeta: {
        publishedTime: published, modifiedTime: published, section: article.category,
        tags: [...new Set([article.category, ...BASE_KEYWORDS].filter(Boolean))],
      },
    }));
  }

  console.log(`SEO prerender: ${events.length} eventos · ${artists.filter(a => a.slug).length} artistas · ${organizers.filter(o => o.slug).length} organizadores · ${podcasts.length} podcasts · ${publishedArticles.length} artículos${publishedArticles.length ? ' + índice /blog' : ''}`);
}

main().catch(error => {
  console.error(`SEO prerender failed: ${error.message}`);
  console.warn('SEO prerender skipped: deploy continuará con la app SPA.');
});
