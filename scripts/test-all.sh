#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

if [[ "${PLAYWRIGHT_EXTERNAL_DB:-false}" != "true" ]]; then
  require_command docker
  docker compose up -d db
  pnpm exec wait-on tcp:5432
fi
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/mernmafia}"
export AUTH_SECRET="${AUTH_SECRET:-local-test-auth}"
export AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID:-local-test-google}"
export AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET:-local-test-google-secret}"
export BACKEND_SECRET="${BACKEND_SECRET:-local-test-backend}"
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://127.0.0.1:1999}"

section "Running lint and typechecks"
pnpm run lint
pnpm --dir server run typecheck
pnpm --dir nextjs run typecheck
pnpm --dir mobile run typecheck

section "Running gameplay and protocol suites"
pnpm run test:gameplay:all

section "Running application unit suites"
pnpm run test:desktop
pnpm run test:chatgpt
pnpm --dir nextjs run test
pnpm --dir mobile run test

section "Running PostgreSQL integration tests"
pnpm --dir nextjs run db:migrate
pnpm run test:integration

section "Running Storybook and visual regression suites"
pnpm run storybook:screenshots
pnpm run screenshots:mobile

section "Running live Chromium E2E suite"
pnpm run test:e2e

section "Running Firefox and WebKit smoke suite"
pnpm run test:e2e:cross-browser

section "All local checks passed"
