#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command pnpm
require_command setsid
require_command pkill

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
export NEXT_PUBLIC_SOCKET_BACKEND=partyserver
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://127.0.0.1:1999}"
export NEXTJS_URL="http://127.0.0.1:3100"
export PARTYSERVER_PORT=1999
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
partyserver_pid=""
cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  for service_pid in "$next_pid" "$partyserver_pid"; do
    if [[ -n "$service_pid" ]]; then
      pkill -TERM -s "$service_pid" 2>/dev/null || true
    fi
  done
  for service_pid in "$next_pid" "$partyserver_pid"; do
    if [[ -n "$service_pid" ]]; then
      for _ in {1..20}; do
        if ! pkill -0 -s "$service_pid" 2>/dev/null; then break; fi
        sleep 0.1
      done
      pkill -KILL -s "$service_pid" 2>/dev/null || true
      wait "$service_pid" 2>/dev/null || true
    fi
  done
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

setsid pnpm --dir nextjs exec next dev --hostname 127.0.0.1 --port 3100 &
next_pid=$!
setsid bash scripts/partyserver-dev.sh &
partyserver_pid=$!

pnpm exec wait-on --interval 1000 --httpTimeout 30000 http://127.0.0.1:3100/api/matchmaking/current tcp:1999
wait -n "$next_pid" "$partyserver_pid"
