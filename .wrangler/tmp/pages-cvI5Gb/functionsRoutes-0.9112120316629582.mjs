import { onRequest as __api_ably_token_ts_onRequest } from "/home/mizegret/workspace/minatoku-duel/functions/api/ably-token.ts"
import { onRequest as __api_health_js_onRequest } from "/home/mizegret/workspace/minatoku-duel/functions/api/health.js"

export const routes = [
    {
      routePath: "/api/ably-token",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_ably_token_ts_onRequest],
    },
  {
      routePath: "/api/health",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_health_js_onRequest],
    },
  ]