#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

export AUTH_SECRET="${AUTH_SECRET:-ci-dummy-secret}"
export AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID:-ci-dummy}"
export AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET:-ci-dummy}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/mernmafia}"
export BACKEND_SECRET="${BACKEND_SECRET:-ci-dummy-backend-secret}"
export NEXT_PUBLIC_SOCKET_BACKEND=partykit
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://localhost:1999}"

section "Installing the locked dependency graph"
pnpm install --frozen-lockfile

section "Running the server CI job"
pnpm --dir server run lint
pnpm --dir server run typecheck
pnpm --dir server run test:coverage

section "Running the Next.js CI job"
pnpm --dir nextjs run lint
pnpm --dir nextjs run typecheck
pnpm --dir nextjs run test
pnpm --dir nextjs run db:migrate
pnpm --dir nextjs run test:integration
pnpm --dir nextjs run build

section "Running mobile checks"
pnpm --dir mobile run lint
pnpm --dir mobile run typecheck
pnpm --dir mobile run test

section "Local CI verification passed"
