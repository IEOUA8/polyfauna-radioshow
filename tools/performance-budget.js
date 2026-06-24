import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST_DIR = 'dist';
const ASSET_DIR = join(DIST_DIR, 'assets');

const BUDGETS = {
  initialJsGzipKb: 190,
  initialCssGzipKb: 30,
  maxLazyJsGzipKb: 260,
  totalJsGzipKb: 720,
};

function gzipKb(file) {
  return gzipSync(readFileSync(file)).length / 1024;
}

function kb(value) {
  return `${value.toFixed(1)} KiB`;
}

function assetPath(href) {
  return join(DIST_DIR, href.replace(/^\//, ''));
}

if (!existsSync(join(DIST_DIR, 'index.html')) || !existsSync(ASSET_DIR)) {
  console.error('Performance budget failed: dist/ no existe. Ejecuta npm run build primero.');
  process.exit(1);
}

const html = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
const initialJs = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map(match => match[1]);
const initialCss = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)]
  .map(match => match[1]);

const allJsFiles = readdirSync(ASSET_DIR)
  .filter(file => file.endsWith('.js'))
  .map(file => join(ASSET_DIR, file));

const initialJsSet = new Set(initialJs.map(assetPath));
const initialJsGzip = [...initialJsSet].reduce((sum, file) => sum + gzipKb(file), 0);
const initialCssGzip = initialCss.reduce((sum, href) => sum + gzipKb(assetPath(href)), 0);
const lazyJs = allJsFiles.filter(file => !initialJsSet.has(file));
const maxLazy = lazyJs.reduce((largest, file) => {
  const size = gzipKb(file);
  return size > largest.size ? { file, size } : largest;
}, { file: null, size: 0 });
const totalJsGzip = allJsFiles.reduce((sum, file) => sum + gzipKb(file), 0);

const failures = [];
if (initialJsGzip > BUDGETS.initialJsGzipKb) failures.push(`JS inicial ${kb(initialJsGzip)} > ${BUDGETS.initialJsGzipKb} KiB`);
if (initialCssGzip > BUDGETS.initialCssGzipKb) failures.push(`CSS inicial ${kb(initialCssGzip)} > ${BUDGETS.initialCssGzipKb} KiB`);
if (maxLazy.size > BUDGETS.maxLazyJsGzipKb) failures.push(`Chunk lazy mayor ${kb(maxLazy.size)} (${maxLazy.file}) > ${BUDGETS.maxLazyJsGzipKb} KiB`);
if (totalJsGzip > BUDGETS.totalJsGzipKb) failures.push(`JS total ${kb(totalJsGzip)} > ${BUDGETS.totalJsGzipKb} KiB`);

console.log('Performance budget:');
console.log(`- JS inicial gzip: ${kb(initialJsGzip)} / ${BUDGETS.initialJsGzipKb} KiB`);
console.log(`- CSS inicial gzip: ${kb(initialCssGzip)} / ${BUDGETS.initialCssGzipKb} KiB`);
console.log(`- Chunk lazy mayor gzip: ${kb(maxLazy.size)}${maxLazy.file ? ` (${maxLazy.file})` : ''} / ${BUDGETS.maxLazyJsGzipKb} KiB`);
console.log(`- JS total gzip: ${kb(totalJsGzip)} / ${BUDGETS.totalJsGzipKb} KiB`);
console.log(`- JS files: ${allJsFiles.length}`);

if (failures.length) {
  console.error('Performance budget failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Performance budget passed');
