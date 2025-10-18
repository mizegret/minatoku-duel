import { onRequest } from '../functions/api/ably-token';

describe('functions/api/ably-token', () => {
  it('returns stub response when no secret', async () => {
    const res = await onRequest({ request: new Request('http://dummy'), env: {} });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stub).toBe(true);
  });
});
