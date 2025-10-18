import { onRequest } from '../functions/api/health';

describe('functions/api/health', () => {
  it('returns 200 OK with {ok:true}', async () => {
    const res = await onRequest({});
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });
});
