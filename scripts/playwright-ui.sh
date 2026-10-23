#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command pnpm

# The UI remains useful on a machine without Docker. The actual test process
# starts Next.js and PartyServer through playwright-server.sh.
export PLAYWRIGHT_NO_DB="${PLAYWRIGHT_NO_DB:-true}"
export PLAYWRIGHT_UI_PORT="${PLAYWRIGHT_UI_PORT:-9323}"

exec pnpm --dir nextjs exec playwright test \
  -c playwright.config.ts \
  --ui \
  --ui-host=0.0.0.0 \
  --ui-port="$PLAYWRIGHT_UI_PORT"
