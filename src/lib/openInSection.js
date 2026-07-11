// Cambia de sección dentro del shell y abre un item puntual, sin pasar por
// una ruta publica (/e/:id, /profiles/:slug) — esas son rutas hermanas de
// PolyfaunaOS en el router, asi que navegar ahi desmonta y remonta TODO el
// shell (sidebar, panel derecho, bottom nav) para un click que ya estaba
// adentro de la app.
//
// Escribe el mismo query param (?artist=, ?event=, ?organizer=) que ya usan
// los links externos — cada sección lo lee en un useEffect con [items] como
// dependencia, así que se resuelve solo cuando la lista termine de cargar,
// sin importar cuánto tarde el chunk lazy la primera vez. Un CustomEvent
// disparado con un temporizador corto no sirve aquí: en la primera visita a
// una sección todavía no montada, el listener no existe cuando el evento
// llega (probado en vivo, el detalle no abría).
export function openInSection(setCurrentSection, section, paramKey, paramValue) {
  setCurrentSection?.(section);
  const url = new URL(window.location.href);
  url.searchParams.set('section', section);
  url.searchParams.set(paramKey, paramValue);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
