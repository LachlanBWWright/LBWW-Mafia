#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

# Safe local placeholders exercise production compilation without requiring secrets.
# Values already present in the environment always win.
export AUTH_SECRET="${AUTH_SECRET:-local-build-secret}"
export AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID:-local-build-google-id}"
export AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET:-local-build-google-secret}"
export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
export BACKEND_SECRET="${BACKEND_SECRET:-local-build-backend-secret}"
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://localhost:8000}"

section "Type-checking the server production build"
pnpm --dir server run build

section "Building the Next.js production application"
pnpm --dir nextjs run build

section "Type-checking the mobile production build"
pnpm --dir mobile run build

section "Production builds passed"

