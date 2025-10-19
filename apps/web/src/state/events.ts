import { publish } from '../lib/bus/local';
import { validateEnvelope } from '../lib/events/validate';
import type { Envelope } from '../lib/events/schema';

function rid() {
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

export function envelope(
  clientId: string | undefined,
  event: Envelope['event'],
  payload: unknown
): Envelope {
  return {
    version: '1.0',
    event,
    ts: Date.now(),
    clientId: clientId || 'anon',
    requestId: rid(),
    payload,
  };
}

export function send(
  clientId: string | undefined,
  event: Envelope['event'],
  payload: unknown,
  onInvalid?: (errors: unknown) => void
): boolean {
  const msg = envelope(clientId, event, payload);
  const { ok, errors } = validateEnvelope(msg);
  if (!ok) {
    onInvalid?.(errors);
    return false;
  }
  publish(msg);
  return true;
}
