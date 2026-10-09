#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

# This launcher assumes dependencies and the local database are already running.
# Use `pnpm run dev` for the full first-time bootstrap.
export AUTH_SECRET="${AUTH_SECRET:-local-development-secret}"
export AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID:-local-google-placeholder}"
export AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET:-local-google-placeholder}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/mernmafia}"
export BACKEND_SECRET="${BACKEND_SECRET:-local-backend-secret}"
export NEXT_PUBLIC_SOCKET_BACKEND=partykit
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://localhost:1999}"
export NEXTJS_URL="${NEXTJS_URL:-http://localhost:3000}"
export DEBUG="${DEBUG:-true}"
export ROOM_SIZE="${ROOM_SIZE:-3}"

section "Starting Next.js and local PartyKit"
echo "Web app: http://localhost:3000"
echo "PartyKit: http://localhost:1999"
echo "Stop both processes with Ctrl-C."

exec pnpm exec concurrently \
  --names "next,partykit" \
  --prefix-colors "cyan,yellow" \
  "pnpm --dir nextjs run dev" \
  "pnpm --dir server run start:partykit --var NEXTJS_URL=$NEXTJS_URL --var BACKEND_SECRET=$BACKEND_SECRET --var DEBUG=$DEBUG --var ROOM_SIZE=$ROOM_SIZE"
