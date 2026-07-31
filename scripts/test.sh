#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Running server tests"
pnpm --dir server run test

section "Running Next.js tests"
pnpm --dir nextjs run test

section "Running mobile tests"
pnpm --dir mobile run test

if command -v cargo >/dev/null 2>&1; then
  section "Running Rust workspace tests"
  cargo test --manifest-path rust/Cargo.toml --workspace
else
  echo "Required command not found: cargo" >&2
  exit 127
fi

section "All test suites passed"

