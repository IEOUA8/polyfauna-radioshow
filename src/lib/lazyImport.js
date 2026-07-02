const RELOAD_FLAG_KEY = 'pf_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 10_000;
const CHUNK_ERROR_PATTERN = /fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;

// Tras un deploy, un cliente con la shell vieja abierta puede pedir un chunk
// con hash que ya no existe. En vez de romper en el ErrorBoundary, recarga
// una sola vez para traer el index.html actual con los hashes correctos.
export function lazyImport(importer) {
  return () => importer().catch((error) => {
    if (!CHUNK_ERROR_PATTERN.test(String(error?.message || ''))) throw error;

    const lastReload = Number(sessionStorage.getItem(RELOAD_FLAG_KEY) || 0);
    if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) throw error;

    sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
    window.location.reload();
    return new Promise(() => {});
  });
}
