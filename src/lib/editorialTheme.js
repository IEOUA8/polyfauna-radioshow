// Jerarquía editorial compartida. El dorado identifica contexto, autoría,
// categorías y selección; no reemplaza colores semánticos como Live, error,
// éxito o estados operativos.
export const EDITORIAL_ACCENT = '#D6A456';
export const EDITORIAL_ACCENT_RGB = '214, 164, 86';

export function editorialAccent(alpha = 1) {
  return `rgba(${EDITORIAL_ACCENT_RGB}, ${alpha})`;
}
