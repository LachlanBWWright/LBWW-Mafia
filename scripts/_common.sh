#!/usr/bin/env bash

# Shared helpers for repository command scripts. This file is meant to be sourced.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 127
  fi
}

section() {
  echo
  echo "==> $*"
}

require_command pnpm

