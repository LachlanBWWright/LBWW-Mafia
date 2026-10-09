#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command pnpm

no_db="${PLAYWRIGHT_NO_DB:-false}"
if [[ "$no_db" != "true" ]]; then
  if [[ "${PLAYWRIGHT_EXTERNAL_DB:-false}" != "true" ]]; then require_command docker; fi
fi

# Keep the browser suite isolated from the normal local development ports.
export AUTH_SECRET="${AUTH_SECRET:-playwright-test-secret}"
export AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID:-playwright-google-id}"
export AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET:-playwright-google-secret}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/mernmafia}"
export BACKEND_SECRET="${BACKEND_SECRET:-playwright-backend-secret}"
export NEXT_PUBLIC_SOCKET_BACKEND=partykit
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://127.0.0.1:1999}"
export NEXTJS_URL="http://127.0.0.1:3100"
export ROOM_SIZE="${ROOM_SIZE:-3}"
export DAY_SECONDS="${DAY_SECONDS:-10}"
export NIGHT_SECONDS="${NIGHT_SECONDS:-10}"
export DEBUG=true

if [[ "$no_db" == "true" ]]; then
  echo "Playwright no-DB mode: skipping Docker/PostgreSQL"
else
  if [[ "${PLAYWRIGHT_EXTERNAL_DB:-false}" != "true" ]]; then
    docker compose up -d db
    pnpm exec wait-on tcp:5432
  fi
  pnpm --dir nextjs run db:migrate
fi

next_pid=""
partykit_pid=""
cleanup() {
  trap - TERM INT EXIT
  if [[ -n "$next_pid" ]]; then kill "$next_pid" 2>/dev/null || true; fi
  if [[ -n "$partykit_pid" ]]; then kill "$partykit_pid" 2>/dev/null || true; fi
  wait "$next_pid" "$partykit_pid" 2>/dev/null || true
}
trap cleanup TERM INT EXIT

pnpm --dir nextjs exec next dev --hostname 127.0.0.1 --port 3100 &
next_pid=$!
pnpm --dir server run start:partykit --var "NEXTJS_URL=$NEXTJS_URL" --var "BACKEND_SECRET=$BACKEND_SECRET" --var "DEBUG=$DEBUG" --var "ROOM_SIZE=$ROOM_SIZE" &
partykit_pid=$!

pnpm exec wait-on --interval 1000 --httpTimeout 30000 http://127.0.0.1:3100/api/matchmaking/current tcp:1999
wait "$next_pid" "$partykit_pid"
