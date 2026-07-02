export async function getFunctionErrorMessage(error, fallback = 'Error en el servidor') {
  const response = error?.context;
  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json();
      if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    } catch (_) {
      // Fall back to the SDK message when the response is not JSON.
    }
  }
  return error?.message || fallback;
}
