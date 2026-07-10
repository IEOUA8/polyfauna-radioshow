import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getStreamReconnectDelay,
  isPlaybackPermissionError,
  STREAM_RECONNECT_DELAYS_MS,
  STREAM_STALL_TIMEOUT_MS,
} from '../src/lib/streamRecovery.js';

test('la reconexion usa backoff acotado entre 1 y 30 segundos', () => {
  assert.deepEqual(STREAM_RECONNECT_DELAYS_MS, [1_000, 2_000, 4_000, 8_000, 15_000, 30_000]);
  assert.equal(getStreamReconnectDelay(-2), 1_000);
  assert.equal(getStreamReconnectDelay(0), 1_000);
  assert.equal(getStreamReconnectDelay(3), 8_000);
  assert.equal(getStreamReconnectDelay(99), 30_000);
});

test('un stall prolongado se considera corte a los ocho segundos', () => {
  assert.equal(STREAM_STALL_TIMEOUT_MS, 8_000);
});

test('los bloqueos de autoplay se distinguen de errores transitorios', () => {
  assert.equal(isPlaybackPermissionError({ name: 'NotAllowedError' }), true);
  assert.equal(isPlaybackPermissionError({ name: 'NetworkError' }), false);
  assert.equal(isPlaybackPermissionError(null), false);
});
