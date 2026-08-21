#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command cargo

section "Measuring TypeScript gameplay coverage"
pnpm --dir server run test:coverage

if ! cargo llvm-cov --version >/dev/null 2>&1; then
  echo "cargo-llvm-cov is required. Install with: cargo install cargo-llvm-cov --version 0.6.21 --locked" >&2
  exit 127
fi

section "Measuring Rust game-core coverage"
cargo llvm-cov --locked --manifest-path rust/Cargo.toml -p game-core \
  --summary-only --fail-under-lines 85 --fail-under-functions 90

section "Coverage thresholds passed"
