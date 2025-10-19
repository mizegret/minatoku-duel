import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import { envelopeSchema, type Envelope } from './schema';

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validate = ajv.compile<Envelope>(envelopeSchema as any);

export function validateEnvelope(data: unknown): { ok: boolean; errors: ErrorObject[] } {
  const ok = validate(data);
  return { ok, errors: ok ? [] : (validate.errors as ErrorObject[] | null) || [] };
}
