#!/usr/bin/env sh
# Retries prisma migrate deploy (Supabase free tier may be waking from pause).
set -eu

attempt=1
max_attempts=6
delay_seconds=15

while [ "$attempt" -le "$max_attempts" ]; do
  echo "prisma migrate deploy: attempt ${attempt}/${max_attempts}"
  if pnpm --filter @game-is-game/db exec prisma migrate deploy; then
    echo "prisma migrate deploy: success"
    exit 0
  fi
  if [ "$attempt" -eq "$max_attempts" ]; then
    break
  fi
  echo "prisma migrate deploy: failed, retrying in ${delay_seconds}s..."
  sleep "$delay_seconds"
  attempt=$((attempt + 1))
done

echo "prisma migrate deploy: all attempts failed"
exit 1
