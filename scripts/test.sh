#!/usr/bin/env bash

set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Running server tests"
pnpm --dir server run test

section "Running Next.js tests"
pnpm --dir nextjs run test

section "Running mobile tests"
pnpm --dir mobile run test

section "All test suites passed"
