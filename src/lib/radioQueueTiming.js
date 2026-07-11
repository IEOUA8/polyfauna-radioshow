const BOGOTA_TIME_FORMAT = { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' };

export function formatBogotaTime(date) {
  return date.toLocaleTimeString('es-CO', BOGOTA_TIME_FORMAT).replace(/^0/, '');
}

export function formatDuration(seconds) {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

// Proyecta la hora (America/Bogota) a la que empezaria a sonar cada item de
// la cola, acumulando la duracion restante del track actual mas la
// duracion de cada item previo. Es una proyeccion, no una promesa exacta:
// si alguien salta o el stream se reconecta, se corrige solo en el proximo
// refresco (la cola se resincroniza cada 3 min).
export function projectQueueTimes(queue, remainingSeconds, now = new Date()) {
  let cumulativeMs = Math.max(0, remainingSeconds) * 1000;
  return (queue || []).map((item) => {
    const startsAt = new Date(now.getTime() + cumulativeMs);
    cumulativeMs += Math.max(0, item.duration_seconds || 0) * 1000;
    return { ...item, startsAt, startsAtLabel: formatBogotaTime(startsAt) };
  });
}
