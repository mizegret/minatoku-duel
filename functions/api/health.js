export const onRequest = async (_ctx) => {
  const body = { ok: true };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
