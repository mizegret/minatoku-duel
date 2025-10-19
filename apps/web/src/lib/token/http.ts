import type { TokenService, AblyToken } from './TokenService';

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  try {
    return await res.json();
  } catch (_e) {
    return { ok: false, message: 'non-json response' };
  }
}

export function httpTokenService(base = '/api'): TokenService {
  return {
    async getAblyToken(clientId: string): Promise<AblyToken> {
      try {
        const q = new URLSearchParams({ clientId });
        const data = await fetchJSON(`${base}/ably-token?${q}`);
        // Phase 1 のスタブ想定レスポンスに寄せる
        return {
          ok: Boolean(data?.ok),
          stub: Boolean(data?.stub),
          token: typeof data?.token === 'string' ? data.token : undefined,
          expiresAt: typeof data?.expiresAt === 'number' ? data.expiresAt : undefined,
          message: typeof data?.message === 'string' ? data.message : undefined,
        };
      } catch (e: any) {
        return { ok: false, message: e?.message || 'network error' };
      }
    },
  };
}
