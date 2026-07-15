import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = resolve(root, '..');
const templatesDir = join(root, 'supabase/functions/_shared/email-templates');
const emailLogoUrl = 'https://www.polyfauna.com/icons/email-logo-header.png';

const sources = {
  registration: join(clientRoot, 'files 5/01-registro-bienvenida.html'),
  recovery: join(clientRoot, 'files 5/02-recuperacion-contrasena.html'),
  roleRequest: join(clientRoot, 'files 5/03-solicitud-registro.html'),
  ticketPurchased: join(clientRoot, 'plantillas/04-ticket-comprado.html'),
  radioSpecial: join(clientRoot, 'files 5/05-programa-radio-especial.html'),
  upcomingEvents: join(clientRoot, 'files 5/06-eventos-proximos.html'),
  courtesyPendingActivation: join(clientRoot, 'plantillas/07-cortesia-pendiente.html'),
  manualTicketPendingActivation: join(root, 'supabase/email-template-sources/manualTicketPendingActivation.html'),
};

mkdirSync(templatesDir, { recursive: true });

const hardenEmailClientColors = (html) => html
  .replaceAll('<meta name="color-scheme" content="dark light">', '<meta name="color-scheme" content="dark">')
  .replaceAll('<meta name="supported-color-schemes" content="dark light">', '<meta name="supported-color-schemes" content="dark">')
  .replace(
    '<style>\n',
    `<style>\n  :root{ color-scheme:dark; supported-color-schemes:dark; }\n  body{ margin:0 !important; padding:0 !important; background:#0A0A0A !important; background-color:#0A0A0A !important; background-image:linear-gradient(#0A0A0A,#0A0A0A) !important; color:#ECECEC !important; }\n  .email-bg{ background:#0A0A0A !important; background-color:#0A0A0A !important; background-image:linear-gradient(#0A0A0A,#0A0A0A) !important; }\n  .email-card{ background:#0E0E0E !important; background-color:#0E0E0E !important; background-image:linear-gradient(#0E0E0E,#0E0E0E) !important; }\n  .email-panel{ background:#141414 !important; background-color:#141414 !important; background-image:linear-gradient(#141414,#141414) !important; }\n  @media (prefers-color-scheme: dark){ body,.email-bg{ background:#0A0A0A !important; background-color:#0A0A0A !important; background-image:linear-gradient(#0A0A0A,#0A0A0A) !important; } .email-card{ background:#0E0E0E !important; background-color:#0E0E0E !important; background-image:linear-gradient(#0E0E0E,#0E0E0E) !important; } }\n`,
  )
  .replaceAll(
    '<body style="margin:0;padding:0;background:#0A0A0A;">',
    '<body bgcolor="#0A0A0A" style="margin:0 !important;padding:0 !important;background:#0A0A0A !important;background-color:#0A0A0A !important;background-image:linear-gradient(#0A0A0A,#0A0A0A) !important;color:#ECECEC !important;">',
  )
  .replaceAll(
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A0A0A" style="background:#0A0A0A;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A0A0A" class="email-bg" style="background:#0A0A0A !important;background-color:#0A0A0A !important;background-image:linear-gradient(#0A0A0A,#0A0A0A) !important;">',
  )
  .replaceAll(
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#0E0E0E;border:1px solid #1E1E1E;border-radius:18px;">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0E0E0E" class="email-card" style="width:600px;max-width:600px;background:#0E0E0E !important;background-color:#0E0E0E !important;background-image:linear-gradient(#0E0E0E,#0E0E0E) !important;border:1px solid #1E1E1E;border-radius:18px;">',
  )
  .replaceAll(
    'style="background:#141414;border:',
    'class="email-panel" bgcolor="#141414" style="background:#141414 !important;background-color:#141414 !important;background-image:linear-gradient(#141414,#141414) !important;border:',
  )
  .replaceAll(
    'style="background:#121212;border:',
    'class="email-panel" bgcolor="#121212" style="background:#121212 !important;background-color:#121212 !important;background-image:linear-gradient(#121212,#121212) !important;border:',
  )
  .replaceAll(
    'style="background:#0E0E0E;border:',
    'class="email-card" bgcolor="#0E0E0E" style="background:#0E0E0E !important;background-color:#0E0E0E !important;background-image:linear-gradient(#0E0E0E,#0E0E0E) !important;border:',
  )
  .replaceAll(
    '<td bgcolor="#ECECEC" style="border-radius:',
    '<td bgcolor="#ECECEC" style="background:#ECECEC !important;background-color:#ECECEC !important;background-image:linear-gradient(#ECECEC,#ECECEC) !important;border-radius:',
  )
  .replaceAll(
    'color:#0A0A0A;text-decoration:none;',
    'color:#0A0A0A !important;-webkit-text-fill-color:#0A0A0A !important;text-decoration:none;',
  );

// Gmail (sobre todo la app de iOS) aplica su propia inversión automática
// de "modo oscuro" a correos que ya son oscuros, mostrando fondo blanco y
// texto oscuro en vez del diseño real — nada de lo de arriba (bgcolor,
// !important, color-scheme, @media prefers-color-scheme) evita eso,
// porque Gmail decide invertir ANTES de que esas reglas se apliquen. El
// truco documentado (Rémi Parmentier / hteumeuleu.com) usa dos capas con
// mix-blend-mode que se cancelan entre sí, aprovechando que Gmail
// reemplaza el DOCTYPE por un <u></u>, lo que permite apuntarle solo a
// Gmail con el selector `u + .body` sin afectar ningún otro cliente.
const preventGmailDarkModeInversion = (html) => html
  .replace(
    '</style>\n</head>',
    '  u + .body .gmail-blend-screen{ background:#000; mix-blend-mode:screen; }\n  u + .body .gmail-blend-difference{ background:#000; mix-blend-mode:difference; }\n</style>\n</head>',
  )
  .replace(
    /<body bgcolor="#0A0A0A" style="([^"]*)">/,
    '<body class="body" bgcolor="#0A0A0A" style="$1">\n<div class="gmail-blend-screen"><div class="gmail-blend-difference">',
  )
  .replace('</body>\n</html>', '</div></div>\n</body>\n</html>');

const entries = Object.entries(sources).map(([key, source]) => {
  const destination = join(templatesDir, `${key}.html`);
  const html = preventGmailDarkModeInversion(hardenEmailClientColors(readFileSync(source, 'utf8')));
  writeFileSync(destination, html);
  return [key, html];
});

const generated = `// Generated by tools/import-email-templates.js. Do not edit directly.\n`
  + `export const EMAIL_TEMPLATES = ${JSON.stringify(Object.fromEntries(entries), null, 2)} as const;\n`;

writeFileSync(join(root, 'supabase/functions/_shared/email-templates.generated.ts'), generated);

const removeUnsubscribe = (html) => html.replace(
  /<a href="\{\{unsubscribe_url\}\}"[^>]*>Dejar de recibir<\/a>\s*&#183;\s*/g,
  '',
);
const authDir = join(root, 'supabase/auth-email-templates');
mkdirSync(authDir, { recursive: true });
writeFileSync(join(authDir, 'confirmation.html'), removeUnsubscribe(entries.find(([key]) => key === 'registration')[1])
  .replaceAll('{{logo_url}}', emailLogoUrl)
  .replaceAll('{{user_name}}', '{{ if .Data.name }}{{ .Data.name }}{{ else }}Raver{{ end }}')
  .replaceAll('{{verify_url}}', '{{ .ConfirmationURL }}')
  .replaceAll('{{unsubscribe_url}}', 'https://www.polyfauna.com'));
writeFileSync(join(authDir, 'recovery.html'), removeUnsubscribe(entries.find(([key]) => key === 'recovery')[1])
  .replaceAll('{{logo_url}}', emailLogoUrl)
  .replaceAll('{{user_email}}', '{{ .Email }}')
  .replaceAll('{{reset_url}}', '{{ .ConfirmationURL }}')
  .replaceAll('{{unsubscribe_url}}', 'https://www.polyfauna.com'));

console.log(`Imported ${entries.length} email templates.`);
