#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

# Wrangler uses NAME:value bindings. Pass each binding as one argument so local
# credentials and URLs are not interpreted as shell code by concurrently.
args=(--port "${PARTYSERVER_PORT:-1999}")
for name in NEXTJS_URL BACKEND_SECRET DEBUG ROOM_SIZE DAY_SECONDS NIGHT_SECONDS; do
  if [[ -v "$name" ]]; then args+=(--var "$name:${!name}"); fi
done
exec pnpm --dir server run start:partyserver "${args[@]}"
