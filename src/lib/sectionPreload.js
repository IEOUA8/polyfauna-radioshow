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

const PUBLIC_PRIORITY_SECTIONS = [
  'radio-console', 'podcasts', 'events', 'artists', 'organizers', 'blog',
];
const MEMBER_PRIORITY_SECTIONS = [
  'music', 'organism', 'inbox', 'tickets', 'settings',
];

export function preloadSection(sectionId) {
  if (preloaded.has(sectionId)) return;
  const importer = IMPORTERS[sectionId];
  if (!importer) return;
  preloaded.add(sectionId);
  importer().catch(() => { preloaded.delete(sectionId); });
}

// Adelanta los chunks navegables cuando el hilo principal queda libre. Esto
// evita que el primer click tenga que esperar red + parseo, sin competir con
// la carga inicial ni gastar datos en conexiones deliberadamente limitadas.
export function preloadLikelySections({ authenticated = false } = {}) {
  if (typeof window === 'undefined') return () => {};

  const connection = navigator.connection;
  if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) {
    return () => {};
  }

  const sections = authenticated
    ? [...PUBLIC_PRIORITY_SECTIONS, ...MEMBER_PRIORITY_SECTIONS]
    : PUBLIC_PRIORITY_SECTIONS;
  let cancelled = false;
  const preload = () => {
    if (cancelled || document.visibilityState === 'hidden') return;
    sections.forEach(preloadSection);
  };

  if ('requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(preload, { timeout: 1_500 });
    return () => {
      cancelled = true;
      window.cancelIdleCallback?.(idleId);
    };
  }

  const timeoutId = window.setTimeout(preload, 600);
  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
  };
}
