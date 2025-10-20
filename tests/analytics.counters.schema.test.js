import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const schema = JSON.parse(
  readFileSync(join(process.cwd(), 'schemas/analytics/event-counters.schema.json'), 'utf8')
);

describe('Analytics: Event Counters schema', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv); // enable date-time validation, etc.
  const validate = ajv.compile(schema);

  it('accepts a minimal valid record', () => {
    const data = {
      version: '0.1',
      windowStart: '2025-10-19T11:03:00Z',
      windowEnd: '2025-10-19T11:04:00Z',
      counts: { join: 0, start: 0, move: 0, state: 0 },
      uniqueClients: 0,
    };
    expect(validate(data)).toBe(true);
  });

  it('rejects negative counts', () => {
    const bad = {
      version: '0.1',
      windowStart: '2025-10-19T11:03:00Z',
      windowEnd: '2025-10-19T11:04:00Z',
      counts: { join: 0, start: -1, move: 0, state: 0 },
      uniqueClients: 0,
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects extra keys inside counts', () => {
    const bad = {
      version: '0.1',
      windowStart: '2025-10-19T11:03:00Z',
      windowEnd: '2025-10-19T11:04:00Z',
      counts: { join: 0, start: 0, move: 0, state: 0, foo: 1 },
      uniqueClients: 0,
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects bad date-time', () => {
    const bad = {
      version: '0.1',
      windowStart: 'not-a-date',
      windowEnd: 'also-bad',
      counts: { join: 1, start: 1, move: 1, state: 1 },
      uniqueClients: 1,
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects non-integer uniqueClients', () => {
    const bad = {
      version: '0.1',
      windowStart: '2025-10-19T11:03:00Z',
      windowEnd: '2025-10-19T11:04:00Z',
      counts: { join: 1, start: 1, move: 1, state: 1 },
      uniqueClients: 1.5,
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects negative rates when present', () => {
    const bad = {
      version: '0.1',
      windowStart: '2025-10-19T11:03:00Z',
      windowEnd: '2025-10-19T11:04:00Z',
      counts: { join: 1, start: 1, move: 1, state: 1 },
      uniqueClients: 1,
      rates: { move_per_sec_p50: -0.1 },
    };
    expect(validate(bad)).toBe(false);
  });

  it('allows extra top-level fields (future-proofing)', () => {
    const data = {
      version: '0.1',
      windowStart: '2025-10-19T11:03:00Z',
      windowEnd: '2025-10-19T11:04:00Z',
      counts: { join: 0, start: 0, move: 0, state: 0 },
      uniqueClients: 0,
      extra: { note: 'allowed by additionalProperties: true' },
    };
    expect(validate(data)).toBe(true);
  });
});
