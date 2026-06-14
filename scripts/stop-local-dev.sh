#!/usr/bin/env sh
# Stop local bot, vite, api dev, and cloudflared tunnels.
# Run before using Railway bot to avoid Telegram 409 Conflict.
set -eu

echo "Stopping cloudflared tunnels..."
pkill -f 'cloudflared tunnel' 2>/dev/null || true

echo "Stopping bot dev..."
pkill -f '@game-is-game/bot.*dev' 2>/dev/null || true
pkill -f 'apps/bot.*tsx' 2>/dev/null || true

echo "Stopping web dev..."
pkill -f '@game-is-game/web.*dev' 2>/dev/null || true
pkill -f 'vite.*5173' 2>/dev/null || true

echo "Stopping api dev..."
pkill -f '@game-is-game/api.*dev' 2>/dev/null || true

sleep 1
remaining=$(pgrep -fl 'cloudflared|@game-is-game/bot|@game-is-game/web dev|@game-is-game/api dev' 2>/dev/null || true)
if [ -n "$remaining" ]; then
  echo "Still running:"
  echo "$remaining"
else
  echo "Local dev stack stopped."
fi
