#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/bot"
if [[ "${BOT_POLL_LOCAL:-}" != "true" ]]; then
  echo "[@game-is-game/bot] skip local getUpdates (set BOT_POLL_LOCAL=true to run locally)."
  while true; do sleep 3600; done
fi
exec node --env-file=../../.env ./node_modules/tsx/dist/cli.mjs watch src/main.ts
