#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command cargo

section "Running the TypeScript gameplay characterization suite"
pnpm --dir server run test

section "Running shared TypeScript/Rust protocol and fixture parity tests"
pnpm --dir server run test \
  shared/communication/protocol.parity.test.ts \
  server/model/rooms/room.fixture-parity.test.ts

section "Running Rust game-core and game-server tests"
cargo fmt --manifest-path rust/Cargo.toml --all -- --check
cargo clippy --locked --manifest-path rust/Cargo.toml --workspace --all-targets -- -D warnings
cargo test --locked --manifest-path rust/Cargo.toml --workspace

section "Running the live WebSocket gameplay protocol scenario"
bash scripts/smoke-next-rust.sh

section "All game-logic suites passed"
