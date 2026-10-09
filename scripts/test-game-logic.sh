#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Running the TypeScript gameplay characterization suite"
pnpm --dir server run test

section "Running shared TypeScript protocol and fixture parity tests"
pnpm --dir server run test \
  shared/communication/protocol.parity.test.ts \
  server/model/rooms/room.fixture-parity.test.ts

section "Building the PartyKit game host"
pnpm --dir server run build:partykit

section "All game-logic suites passed"
