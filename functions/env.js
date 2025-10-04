export async function onRequest(context) {
  const { ABLY_API_KEY } = context.env;

  if (!ABLY_API_KEY) {
    return new Response(JSON.stringify({ error: 'ABLY_API_KEY is not set' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  return Response.json({ ABLY_API_KEY });
}
