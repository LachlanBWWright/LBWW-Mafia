#!/usr/bin/env bash

set -Eeuo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

require_command docker
require_command node
require_command setsid
require_command pkill

export WEB_PORT="${WEB_PORT:-3000}"
export PARTYSERVER_PORT="${PARTYSERVER_PORT:-1999}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:$POSTGRES_PORT/mernmafia}"
# Keep migrations and notifications on the same local database, even if
# .env.local also contains connection strings from a deployed Neon project.
export DATABASE_URL_UNPOOLED="$DATABASE_URL"
export DIRECT_MESSAGES_DATABASE_URL="$DATABASE_URL"
export BACKEND_SECRET="${BACKEND_SECRET:-local-backend-secret}"
export NEXT_PUBLIC_SOCKET_BACKEND=partyserver
export NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-http://localhost:$PARTYSERVER_PORT}"
export NEXTJS_URL="${NEXTJS_URL:-http://localhost:$WEB_PORT}"
export DEBUG="${DEBUG:-true}"
export ROOM_SIZE="${ROOM_SIZE:-3}"

runtime_pid=""
stop_database=false
cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  if [[ -n "$runtime_pid" ]]; then
    # The runtime has its own session. pnpm can create nested process groups,
    # so stop the entire owned session, including Next, Wrangler, and workerd.
    pkill -TERM -s "$runtime_pid" 2>/dev/null || true
    for _ in {1..50}; do
      if ! pkill -0 -s "$runtime_pid" 2>/dev/null; then break; fi
      sleep 0.1
    done
    pkill -KILL -s "$runtime_pid" 2>/dev/null || true
    wait "$runtime_pid" 2>/dev/null || true
  fi
  if [[ "$stop_database" == true ]]; then
    # Stop the project database but retain its container and named data volume.
    docker compose stop --timeout 5 db >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Fail before starting the database if an older launcher still owns these ports.
node --input-type=module - "$WEB_PORT" "$PARTYSERVER_PORT" <<'NODE'
import net from 'node:net';
for (const [index, value] of process.argv.slice(2).entries()) {
  const name = ['Next.js', 'PartyServer'][index];
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name} port: ${value}`);
  }
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(
      `${name} port ${port} is in use. Stop the previous development terminal or choose another WEB_PORT/PARTYSERVER_PORT.`,
    )));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
NODE

section "Starting local PostgreSQL"
# Arm cleanup before startup, so a failed or interrupted startup is covered too.
stop_database=true
docker compose up -d --wait --wait-timeout 60 db

section "Applying database migrations"
pnpm --dir nextjs run db:migrate

section "Starting Next.js and PartyServer"
echo "Web app: http://localhost:$WEB_PORT"
echo "PartyServer: http://localhost:$PARTYSERVER_PORT"
echo "Close this terminal or press Ctrl-C to stop Next.js, PartyServer, and PostgreSQL."

# Keep this shell alive to handle terminal closure (SIGHUP), Ctrl-C, failures,
# and normal exits. A separate process group lets cleanup reach every child.
setsid pnpm exec concurrently \
  --kill-others \
  --success first \
  --names "next,partyserver" \
  --prefix-colors "cyan,yellow" \
  "pnpm --dir nextjs run dev --port $WEB_PORT" \
  "bash scripts/partyserver-dev.sh" &
runtime_pid=$!
wait "$runtime_pid"
