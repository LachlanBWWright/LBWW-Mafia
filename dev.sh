#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/scripts" && pwd)/_common.sh"

section "Installing locked dependencies"
pnpm install --frozen-lockfile

# Both entry points use the same database/startup/cleanup lifecycle.
exec bash scripts/dev-local.sh
