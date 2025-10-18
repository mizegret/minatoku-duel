import { publish } from '../lib/bus/local.js';
import { validateEnvelope } from '../lib/events/validate.js';
function rid() {
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}
export function envelope(clientId, event, payload) {
  return {
    version: '1.0',
    event,
    ts: Date.now(),
    clientId: clientId || 'anon',
    requestId: rid(),
    payload,
  };
}
export function send(clientId, event, payload, onInvalid) {
  const msg = envelope(clientId, event, payload);
  const { ok, errors } = validateEnvelope(msg);
  if (!ok) {
    onInvalid?.(errors);
    return false;
  }
  publish(msg);
  return true;
}
