#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command docker

# Safe defaults for a self-contained local game. Explicitly supplied environment
# variables always take precedence, so this script can also be used with real
# development credentials.
export AUTH_SECRET="${AUTH_SECRET:-local-development-secret}"
export AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID:-local-google-placeholder}"
export AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET:-local-google-placeholder}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/mernmafia}"
export BACKEND_SECRET="${BACKEND_SECRET:-local-backend-secret}"
export NEXT_PUBLIC_SOCKET_BACKEND="${NEXT_PUBLIC_SOCKET_BACKEND:-socketio}"
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://localhost:8000}"
export NEXTJS_URL="${NEXTJS_URL:-http://localhost:3000}"
export DEBUG="${DEBUG:-true}"
export ROOM_SIZE="${ROOM_SIZE:-3}"

section "Installing locked dependencies"
pnpm install --frozen-lockfile

section "Starting Postgres"
docker compose up -d
pnpm exec wait-on tcp:5432

section "Applying the local database schema"
pnpm --dir nextjs run db:push

section "Starting Next.js and the game server"
echo "Local game: http://localhost:3000"
echo "Stop the application with Ctrl-C, then run: pnpm run dev:down"
exec pnpm exec concurrently \
  --names "next,server" \
  --prefix-colors "cyan,yellow" \
  "pnpm --dir nextjs run dev" \
  "pnpm --dir server run start"
