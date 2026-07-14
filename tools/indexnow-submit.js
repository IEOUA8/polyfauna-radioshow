#!/usr/bin/env node

// IndexNow — avisa a Bing (y Yandex, Seznam, Naver…) al instante cuando el
// contenido cambia, en vez de esperar al rastreo. Es la vía moderna para
// acelerar la indexación en Bing (el ping clásico de sitemap está deprecado).
//
// Lee las URLs del sitemap ya generado y las envía en un solo POST. Por
// defecto solo dispara en despliegues de producción de Vercel (o con
// INDEXNOW_FORCE=1) para no notificar cambios en builds locales.
//
// La clave es pública: se publica en https://www.polyfauna.com/<key>.txt y así
// IndexNow verifica que el emisor controla el dominio.

import fs from 'node:fs';
import path from 'node:path';

const SITE_URL = 'https://www.polyfauna.com';
const HOST = 'www.polyfauna.com';
const KEY = '39b3ed28e4c1d370464d9d0a0aaa4802';
const KEY_LOCATION = `${SITE_URL}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function shouldSubmit() {
  if (process.env.INDEXNOW_FORCE === '1') return true;
  // Vercel marca los builds de producción con VERCEL_ENV=production.
  return process.env.VERCEL_ENV === 'production';
}

function readSitemapUrls() {
  // Tras el build, el sitemap vive tanto en public/ como en dist/.
  const candidates = [
    path.join(process.cwd(), 'dist', 'sitemap.xml'),
    path.join(process.cwd(), 'public', 'sitemap.xml'),
  ];
  const file = candidates.find(p => fs.existsSync(p));
  if (!file) return [];
  const xml = fs.readFileSync(file, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()).filter(Boolean);
}

async function main() {
  const urls = readSitemapUrls();
  if (urls.length === 0) {
    console.log('IndexNow: sin URLs en el sitemap, nada que enviar.');
    return;
  }

  if (!shouldSubmit()) {
    console.log(`IndexNow: omitido (${urls.length} URLs listas; corre con INDEXNOW_FORCE=1 o en producción Vercel).`);
    return;
  }

  const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls };
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  // 200 = recibido, 202 = aceptado (verificación de clave en curso).
  if (response.ok) {
    console.log(`IndexNow: ${urls.length} URLs enviadas (HTTP ${response.status}).`);
  } else {
    const text = await response.text().catch(() => '');
    console.warn(`IndexNow: HTTP ${response.status} ${text.slice(0, 200)}`);
  }
}

main().catch(error => {
  console.warn(`IndexNow: envío omitido (${error.message}).`);
});
