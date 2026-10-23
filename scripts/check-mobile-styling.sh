#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mobile_dir="$(cd "$script_dir/../mobile" && pwd)"

if rg -n 'StyleSheet\.create|style=\{\{|style=\{\[' "$mobile_dir" \
  --glob '*.{ts,tsx}' \
  --glob '!node_modules/**'; then
  echo "Mobile styling check failed: use NativeWind className utilities for app-owned UI." >&2
  exit 1
fi

echo "Mobile styling checks passed."
