#!/usr/bin/env node

// Genera los assets de imagen de los artículos del blog:
//   1. Versión .webp de cada imagen (portada + figuras) → usada por el lector
//      in-app (mucho más liviana que el PNG original).
//   2. Una imagen Open Graph 1200×630 en JPG por artículo (og.jpg) con la
//      portada + insignia POLYFAUNA + franja editorial → la que ven WhatsApp,
//      Facebook, X, etc. al compartir el enlace. Se usa JPG (no webp) porque
//      varios scrapers sociales no renderizan webp en las tarjetas de enlace.
//
// Se ejecuta a mano cuando se agregan/actualizan imágenes de un artículo:
//   node tools/generate-blog-assets.js
// Recorre public/blog/<slug>/ y trata el archivo portada.* como base del OG.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BLOG_DIR = path.join(process.cwd(), 'public', 'blog');
const WORDMARK = path.join(process.cwd(), 'public', 'icons', 'logo-header.svg');

// Kicker editorial por slug (se hornea en la imagen OG).
const KICKERS = {
  'fauna-de-altura': 'ARCHIVO EDITORIAL · ESPÉCIMEN N.º 01',
};
const DEFAULT_KICKER = 'ARCHIVO EDITORIAL POLYFAUNA';

const IMG_RE = /\.(png|jpe?g)$/i;

async function toWebp(file) {
  const out = file.replace(IMG_RE, '.webp');
  await sharp(file).webp({ quality: 82, effort: 5 }).toFile(out);
  const before = fs.statSync(file).size, after = fs.statSync(out).size;
  console.log(`  webp  ${path.basename(out)}  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB`);
}

async function buildOg(slug, coverPath) {
  const W = 1200, H = 630;
  const kicker = KICKERS[slug] || DEFAULT_KICKER;

  // Portada recortada a 1200×630, oscurecida un poco para contraste.
  const base = await sharp(coverPath)
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .modulate({ brightness: 0.82 })
    .toBuffer();

  // Wordmark POLYFAUNA en blanco, rasterizado nítido.
  const wordmark = await sharp(WORDMARK, { density: 300 })
    .resize({ width: 300 })
    .png()
    .toBuffer();
  const wm = await sharp(wordmark).metadata();

  // Capa de gradientes + franja + kicker.
  const overlay = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.35" stop-color="#000000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0.82"/>
        </linearGradient>
        <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000000" stop-opacity="0.55"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="200" fill="url(#top)"/>
      <rect x="0" y="${H - 320}" width="${W}" height="320" fill="url(#bottom)"/>
      <rect x="0" y="${H - 8}" width="${W}" height="8" fill="#FF8A1F"/>
      <text x="64" y="${H - 54}" fill="#FFFFFF" fill-opacity="0.82"
        font-family="Helvetica, Arial, sans-serif" font-size="26"
        font-weight="600" letter-spacing="6">${kicker}</text>
    </svg>`);

  const out = path.join(path.dirname(coverPath), 'og.jpg');
  await sharp(base)
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: wordmark, top: 56, left: 64 },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(out);
  console.log(`  og    og.jpg  1200×630  (wordmark ${wm.width}×${wm.height})`);
}

async function main() {
  if (!fs.existsSync(BLOG_DIR)) { console.log('Sin public/blog/, nada que hacer.'); return; }
  const slugs = fs.readdirSync(BLOG_DIR).filter(d => fs.statSync(path.join(BLOG_DIR, d)).isDirectory());
  for (const slug of slugs) {
    const dir = path.join(BLOG_DIR, slug);
    const files = fs.readdirSync(dir).filter(f => IMG_RE.test(f) && f !== 'og.jpg');
    console.log(`\n· ${slug}`);
    for (const f of files) await toWebp(path.join(dir, f));
    const cover = files.find(f => /^portada\./i.test(f)) || files[0];
    if (cover) await buildOg(slug, path.join(dir, cover));
  }
  console.log('\nListo.');
}

main().catch(e => { console.error('generate-blog-assets falló:', e.message); process.exit(1); });
