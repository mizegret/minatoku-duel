export const envelopeSchema = {
  $id: 'https://spec.minatoku.duel/events/envelope.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['version', 'event', 'ts', 'clientId', 'requestId', 'payload'],
  properties: {
    version: { type: 'string', enum: ['1.0'] },
    event: { type: 'string', enum: ['join', 'start', 'move', 'state'] },
    ts: { type: 'number' },
    clientId: { type: 'string', minLength: 1 },
    requestId: { type: 'string', minLength: 1 },
    payload: { type: 'object', additionalProperties: true },
  },
  additionalProperties: true,
} as const;

export type Envelope = {
  version: '1.0';
  event: 'join' | 'start' | 'move' | 'state';
  ts: number;
  clientId: string;
  requestId: string;
  payload: unknown;
};
