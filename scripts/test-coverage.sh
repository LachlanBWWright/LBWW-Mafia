#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Measuring TypeScript gameplay coverage"
pnpm --dir server run test:coverage

section "Coverage thresholds passed"
