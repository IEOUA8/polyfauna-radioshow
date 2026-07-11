// Cada sección de PolyfaunaOS es un chunk lazy (React.lazy) — la primera
// vez que alguien la visita en la sesión, el navegador tiene que pedir y
// parsear ese JS antes de poder mostrar nada, con el SectionLoader de por
// medio. Estas mismas rutas de import son las que usa PolyfaunaOS.jsx —
// llamarlas de nuevo en un onMouseEnter/onTouchStart no vuelve a pedir el
// chunk por red si ya se disparó (el navegador cachea el módulo), así que
// cuando el click realmente llega, la sección ya está lista.
const IMPORTERS = {
  'radio-console': () => import('@/components/RadioConsolePage'),
  podcasts: () => import('@/components/PodcastsPage'),
  music: () => import('@/components/MusicPage'),
  organism: () => import('@/components/Organism'),
  events: () => import('@/components/EventTerminal'),
  artists: () => import('@/components/ArtistsPage'),
  organizers: () => import('@/components/OrganizersPage'),
  blog: () => import('@/components/BlogInterviewsSection'),
  inbox: () => import('@/components/SignalInbox'),
  tickets: () => import('@/components/TicketVault'),
  settings: () => import('@/components/ControlCenter'),
};

const preloaded = new Set();

export function preloadSection(sectionId) {
  if (preloaded.has(sectionId)) return;
  const importer = IMPORTERS[sectionId];
  if (!importer) return;
  preloaded.add(sectionId);
  importer().catch(() => { preloaded.delete(sectionId); });
}
