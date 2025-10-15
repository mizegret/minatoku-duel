// Thin session wrapper around net/ably.js (Phase 1: behavior-invariant)
// Keeps a single handle and mirrors the small helpers app.js used to expose.

import * as Net from './ably.js';
import { EVENTS } from '../constants.js';

let handle = null;

export function connect({
  apiKey,
  clientIdPrefix = 'web-',
  channelPrefix = 'room:',
  roomId,
  logAction,
  onConnectionStateChange,
  onConnected,
  onAttach,
  onJoin,
  onStart,
  onMove,
  onState,
  // Optional grouping to avoid many top-level args: { handlers: { onJoin, onStart, ... } }
  handlers,
} = {}) {
  const h = handlers || {};
  handle = Net.createConnection({
    apiKey,
    clientIdPrefix,
    channelPrefix,
    roomId,
    logAction,
    onConnectionStateChange: h.onConnectionStateChange || onConnectionStateChange,
    onConnected: h.onConnected || onConnected,
    onAttach: h.onAttach || onAttach,
    onJoin: h.onJoin || onJoin,
    onStart: h.onStart || onStart,
    onMove: h.onMove || onMove,
    onState: h.onState || onState,
  });
  // Augment handle with simple on/off for channel events (join/start/move/state)
  try {
    if (handle && !handle.on) {
      handle.on = (event, fn) => {
        const ev = EVENTS?.[event];
        if (ev && typeof handle._channel?.subscribe === 'function') {
          handle._channel.subscribe(ev, fn);
        }
        return handle;
      };
    }
    if (handle && !handle.off) {
      handle.off = (event, fn) => {
        const ev = EVENTS?.[event];
        if (ev && typeof handle._channel?.unsubscribe === 'function') {
          handle._channel.unsubscribe(ev, fn);
        }
        return handle;
      };
    }
  } catch {}
  return handle;
}

export function getClientId() {
  return handle?.getClientId?.() ?? Net.getClientId?.() ?? null;
}

export function isConnected() {
  return handle?.isConnected?.() ?? Net.isConnected?.() ?? false;
}

export async function publishJoin(roomId) {
  if (handle) await handle.publishJoin({ roomId });
}

export async function publishStart(payload = {}) {
  if (!handle?.publishStart) return;
  await handle.publishStart(payload);
}

export async function publishMove(payload = {}) {
  if (!handle?.publishMove) return;
  await handle.publishMove(payload);
}

export async function publishState(snapshot = {}) {
  if (!handle?.publishState) return;
  await handle.publishState(snapshot);
}

export function detach() {
  try { handle?.detach?.(); } catch {}
  handle = null;
}
