// Environment loader (Phase 1: behavior-invariant)
// Extracted from public/app.js with identical logic and messages.

import { fetchJson } from '../utils/http.js';
import { setState } from '../state.js';

const ENV_ENDPOINT = '/env';
const IS_LOCAL = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(location.hostname);

export async function loadEnvironment() {
  const sources = IS_LOCAL ? ['/env.local.json'] : [ENV_ENDPOINT];

  for (const source of sources) {
    try {
      const env = await fetchJson(source);
      setState({ env });
      console.info('[env] loaded from', source, Object.keys(env));
      return;
    } catch (error) {
      console.warn('[env] failed to load from', source, error);
    }
  }

  setState({ env: null });
}

