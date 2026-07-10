export const STREAM_STALL_TIMEOUT_MS = 8_000;
export const STREAM_RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

export function getStreamReconnectDelay(attempt = 0) {
  const index = Math.max(0, Math.min(Number(attempt) || 0, STREAM_RECONNECT_DELAYS_MS.length - 1));
  return STREAM_RECONNECT_DELAYS_MS[index];
}

export function isPlaybackPermissionError(error) {
  return error?.name === 'NotAllowedError';
}
