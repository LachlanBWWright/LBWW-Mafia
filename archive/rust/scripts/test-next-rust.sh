#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command cargo

export AUTH_SECRET="${AUTH_SECRET:-next-rust-test-secret}"
export AUTH_GOOGLE_ID="${AUTH_GOOGLE_ID:-next-rust-google-id}"
export AUTH_GOOGLE_SECRET="${AUTH_GOOGLE_SECRET:-next-rust-google-secret}"
export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
export BACKEND_SECRET="${BACKEND_SECRET:-next-rust-backend-secret}"
export NEXT_PUBLIC_SOCKET_BACKEND=rust
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://127.0.0.1:18000}"

section "Checking the Next.js Rust transport configuration"
pnpm --dir nextjs run lint
pnpm --dir nextjs run typecheck
pnpm --dir nextjs run test
pnpm --dir nextjs run build

section "Checking the Rust game server"
cargo fmt --manifest-path rust/Cargo.toml --all -- --check
cargo clippy --locked --manifest-path rust/Cargo.toml --workspace --all-targets -- -D warnings
cargo test --locked --manifest-path rust/Cargo.toml --workspace

section "Running the live Next.js-to-Rust protocol smoke test"
bash scripts/smoke-next-rust.sh

section "Next.js + Rust checks passed"
