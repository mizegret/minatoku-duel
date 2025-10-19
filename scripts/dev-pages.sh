#!/usr/bin/env bash
set -euo pipefail

# Load local dev variables only when not already exported in the shell
if [ -z "${ABLY_API_KEY:-}" ] && [ -f .dev.vars ]; then
  # shellcheck disable=SC1091
  set -a
  . ./.dev.vars
  set +a
fi

# 必須チェック（曖昧に起動して fail になるのを防ぐ）
if [ -z "${ABLY_API_KEY:-}" ]; then
  echo "[dev-pages] ABLY_API_KEY is not set.\n  Set it via: export ABLY_API_KEY=\"...\"\n  or create .dev.vars with: ABLY_API_KEY=\"...\"" >&2
  exit 1
fi

# Pass env bindings explicitly so ctx.env.* で参照できる
args=(--local --port 8788)
if [ -n "${ABLY_API_KEY:-}" ]; then
  args+=(--binding "ABLY_API_KEY=${ABLY_API_KEY}")
fi

exec npx --yes wrangler pages dev . "${args[@]}"
