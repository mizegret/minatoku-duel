import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';

const schema = JSON.parse(
  readFileSync(join(process.cwd(), 'schemas/envelope.schema.json'), 'utf8')
);
const ajv = new Ajv({ strict: false, allErrors: true });
const validate = ajv.compile(schema);

describe('Event Envelope schema', () => {
  it('accepts a valid envelope', () => {
    const data = {
      version: '1.0',
      event: 'join',
      ts: Date.now(),
      clientId: 'c-123',
      requestId: 'r-123',
      payload: { any: 'thing' },
    };
    expect(validate(data)).toBe(true);
  });

  it('rejects missing fields', () => {
    const data = { version: '1.0', event: 'join' };
    expect(validate(data)).toBe(false);
  });

  it('rejects wrong event', () => {
    const data = {
      version: '1.0',
      event: 'foo',
      ts: 0,
      clientId: 'c',
      requestId: 'r',
      payload: {},
    };
    expect(validate(data)).toBe(false);
  });
});
