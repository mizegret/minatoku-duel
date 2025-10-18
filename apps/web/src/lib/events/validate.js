import Ajv2020 from 'ajv/dist/2020';
import { envelopeSchema } from './schema.js';
const ajv = new Ajv2020({ strict: false, allErrors: true });
const validate = ajv.compile(envelopeSchema);
export function validateEnvelope(data) {
  const ok = validate(data);
  return { ok, errors: ok ? [] : validate.errors };
}
