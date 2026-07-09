import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const importScript = readFileSync('tools/import-email-templates.js', 'utf8');

const sharedTemplateFiles = readdirSync('supabase/functions/_shared/email-templates')
  .filter((name) => name.endsWith('.html'))
  .map((name) => `supabase/functions/_shared/email-templates/${name}`);
const authTemplateFiles = readdirSync('supabase/auth-email-templates')
  .filter((name) => name.endsWith('.html'))
  .map((name) => `supabase/auth-email-templates/${name}`);
const allTemplateFiles = [...sharedTemplateFiles, ...authTemplateFiles];

test('import-email-templates.js aplica el fix de inversion de Gmail a todas las plantillas', () => {
  // Bug: Gmail (sobre todo la app de iOS) invierte automaticamente los
  // correos que ya son oscuros — el usuario reportaba fondo blanco y
  // texto oscuro en el correo de recuperacion, pese a que la plantilla
  // ya fuerza fondo oscuro con bgcolor + !important + color-scheme.
  // Ningun meta/CSS estandar evita esa inversion porque Gmail decide
  // invertir antes de aplicar esas reglas — el unico fix conocido usa
  // dos capas con mix-blend-mode que se cancelan, apuntando solo a
  // Gmail via el selector `u + .body`.
  assert.match(importScript, /function|const preventGmailDarkModeInversion/);
  assert.match(importScript, /u \+ \.body \.gmail-blend-screen/);
  assert.match(importScript, /u \+ \.body \.gmail-blend-difference/);
  assert.match(importScript, /preventGmailDarkModeInversion\(hardenEmailClientColors\(/);
});

test('todas las plantillas de correo (compartidas y de Supabase Auth) tienen el fix aplicado', () => {
  for (const file of allTemplateFiles) {
    const html = readFileSync(file, 'utf8');
    assert.match(html, /class="gmail-blend-screen"/, `${file} deberia tener la clase gmail-blend-screen`);
    assert.match(html, /class="gmail-blend-difference"/, `${file} deberia tener la clase gmail-blend-difference`);
    assert.match(html, /<body class="body"/, `${file} deberia tener class="body" para el selector u + .body`);
  }
});

test('el wrapper de Gmail no rompe el balance de divs en ninguna plantilla', () => {
  for (const file of allTemplateFiles) {
    const html = readFileSync(file, 'utf8');
    const openDivs = (html.match(/<div/g) || []).length;
    const closeDivs = (html.match(/<\/div>/g) || []).length;
    assert.equal(openDivs, closeDivs, `${file} tiene divs desbalanceados (${openDivs} abiertos, ${closeDivs} cerrados)`);
  }
});
