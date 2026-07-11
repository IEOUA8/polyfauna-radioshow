import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const app = readFileSync('src/App.jsx', 'utf8');
const eventTerminal = readFileSync('src/components/EventTerminal.jsx', 'utf8');
const artistsPage = readFileSync('src/components/ArtistsPage.jsx', 'utf8');
const organizersPage = readFileSync('src/components/OrganizersPage.jsx', 'utf8');
const polyfaunaOS = readFileSync('src/components/PolyfaunaOS.jsx', 'utf8');

test('no existen paginas de detalle standalone huerfanas: todo vive dentro del shell', () => {
  // ArtistPublicPage/OrganizerPublicPage/EventPublicPage se retiraron porque
  // duplicaban, con diseno divergente, lo que ya vive dentro de Artists &
  // Labels, Colonia y Event Terminal. Un solo lugar de verdad por entidad.
  for (const file of ['src/pages/ArtistPublicPage.jsx', 'src/pages/OrganizerPublicPage.jsx', 'src/pages/EventPublicPage.jsx']) {
    assert.equal(existsSync(file), false, `${file} deberia estar eliminado`);
  }
  assert.doesNotMatch(app, /ArtistPublicPage|OrganizerPublicPage|EventPublicPage/);
});

test('/profiles/:slug y /organizadores/:slug redirigen al shell con el query param correcto', () => {
  // El placeholder de la ruta es :slug en ambos casos, pero cada seccion
  // escucha un query key distinto (?artist= / ?organizer=) — routeParam
  // separa "de donde leer" de "que query key escribir". Sin esto, el valor
  // se pierde silenciosamente (bug real encontrado y corregido en esta fase).
  assert.match(app, /path="\/profiles\/:slug".*InternalRouteRedirect section="artists" param="artist" routeParam="slug"/);
  assert.match(app, /path="\/organizadores\/:slug".*InternalRouteRedirect section="organizers" param="organizer" routeParam="slug"/);
  assert.match(app, /const value = params\[routeParam \|\| param\] \|\| '';/);
});

test('InternalRouteRedirect preserva query params extra del link original (ej. ?ref=)', () => {
  assert.match(app, /const search = new URLSearchParams\(location\.search\);/);
  assert.match(app, /useLocation/);
});

test('/e/:event y /events/:event apuntan al mismo mecanismo de deep-link', () => {
  assert.match(app, /path="\/e\/:event"\s+element=\{<InternalRouteRedirect section="events" param="event" \/>\}/);
  assert.match(app, /path="\/events\/:event" element=\{<InternalRouteRedirect section="events" param="event" \/>\}/);
});

test('el link de co-promotor (?ref=) se captura dentro de Event Terminal, no en una pagina extinta', () => {
  assert.match(eventTerminal, /pf_seller_ref_\$\{eventParam\}/);
  assert.match(eventTerminal, /new URLSearchParams\(window\.location\.search\)\.get\('ref'\)/);
});

test('ArtistDetail y OrganizerDetail usan ProfileContentTabs, no queries propias duplicadas', () => {
  assert.match(artistsPage, /<ProfileContentTabs artistId=\{artist\.id\} artistType=\{artist\.type\} \/>/);
  assert.doesNotMatch(artistsPage, /from\('albums'\)/);
  assert.doesNotMatch(artistsPage, /from\('tracks'\)/);

  assert.match(organizersPage, /<ProfileContentTabs organizerId=\{organizer\.id\} organizerType=\{organizer\.type\} artistId=\{mirrorArtistId \|\| undefined\} \/>/);
  assert.doesNotMatch(organizersPage, /from\('event_organizers'\)/);
});

test('Artists & Labels y Colonia son navegables para invitados, igual que Event Terminal', () => {
  assert.match(polyfaunaOS, /PUBLIC_SECTIONS\s*=\s*\[[^\]]*'artists'[^\]]*\]/);
  assert.match(polyfaunaOS, /PUBLIC_SECTIONS\s*=\s*\[[^\]]*'organizers'[^\]]*\]/);
});
