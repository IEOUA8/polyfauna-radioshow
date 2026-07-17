import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viteConfig = readFileSync('vite.config.js', 'utf8');
const ticketVault = readFileSync('src/components/TicketVault.jsx', 'utf8');

test('jsPDF no empaqueta renderizadores HTML/SVG que el ticket no utiliza', () => {
  assert.match(viteConfig, /disabledPdfOptionalRenderer/);
  assert.match(viteConfig, /find: \/\^html2canvas\$\//);
  assert.match(viteConfig, /find: \/\^dompurify\$\//);
  assert.match(viteConfig, /find: \/\^canvg\$\//);
  assert.doesNotMatch(ticketVault, /\.html\(/);
  assert.doesNotMatch(ticketVault, /addSvgAsImage/);
});
