export const onRequest = async (ctx) => {
  const hasKey = Boolean(ctx.env?.ABLY_API_KEY);
  const body = hasKey
    ? { ok: true, stub: true, message: 'Token issuing is not implemented in Phase 2 prep.' }
    : {
        ok: false,
        stub: true,
        message: 'Missing ABLY_API_KEY secret. Configure Pages Functions Secrets.',
      };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
