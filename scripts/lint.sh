#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

case "${1:-}" in
  "") command_name="lint" ;;
  --fix) command_name="lint:fix" ;;
  *) echo "Usage: $0 [--fix]" >&2; exit 2 ;;
esac

section "Running ${command_name} across server, Next.js, and mobile"
exec pnpm run "$command_name"

