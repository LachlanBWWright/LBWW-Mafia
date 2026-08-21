#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command cargo
require_command curl

PORT="${NEXT_RUST_TEST_PORT:-18000}"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID"
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

section "Starting the Rust WebSocket server on port $PORT"
PORT="$PORT" ROOM_SIZE=2 DEBUG=true DAY_SECONDS=10 NIGHT_SECONDS=10 \
  cargo run --locked --quiet --manifest-path rust/Cargo.toml -p game-server &
SERVER_PID="$!"

for _attempt in $(seq 1 60); do
  if curl --fail --silent "http://127.0.0.1:$PORT/readyz" >/dev/null; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Rust game server exited before becoming ready" >&2
    exit 1
  fi
  sleep 0.25
done
curl --fail --silent --show-error "http://127.0.0.1:$PORT/readyz" >/dev/null

section "Joining a room through the browser-compatible protocol"
NEXT_RUST_TEST_URL="ws://127.0.0.1:$PORT/ws/next-rust-smoke" \
  node scripts/smoke-next-rust.mjs

section "Live Rust transport smoke test passed"
