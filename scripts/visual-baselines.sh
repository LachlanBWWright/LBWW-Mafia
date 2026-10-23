#!/usr/bin/env bash
set -euo pipefail

# Match the browser jobs in .github/workflows/ci.yml. Upgrade this image with the
# locked @playwright/test version, then regenerate and review the baselines.
image=mcr.microsoft.com/playwright:v1.62.1-noble
suite="${1:-all}"
update=false
case "$suite" in web|mobile|mobile-storybook|all) ;; *) echo 'Usage: bash scripts/visual-baselines.sh [web|mobile|mobile-storybook|all] [--update]' >&2; exit 1 ;; esac
if [[ "${2:-}" == --update ]]; then update=true; elif [[ -n "${2:-}" ]]; then echo 'Expected --update or no second argument' >&2; exit 1; fi
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -d "$repo_root/node_modules" ]]; then echo 'Run pnpm install --frozen-lockfile first.' >&2; exit 1; fi
docker_user="$(id -u):$(id -g)"
# Rootless Docker maps container root to the current host user.
if [[ "$(docker info --format '{{json .SecurityOptions}}')" == *rootless* ]]; then docker_user=0:0; fi

docker run --rm --init --ipc=host \
  --user "$docker_user" \
  --mount "type=bind,source=$repo_root,target=/workspace" \
  --workdir /workspace \
  --env HOME=/tmp --env npm_config_cache=/tmp/npm-cache \
  --env npm_config_verify_deps_before_run=false \
  --env CI=true --env EXPO_NO_DOTENV=1 \
  --env "VISUAL_TEST_WORKERS=${VISUAL_TEST_WORKERS:-4}" \
  --env "STORYBOOK_UPDATE_SNAPSHOTS=$update" \
  --env "VISUAL_UPDATE_SNAPSHOTS=$update" \
  "$image" bash -euo pipefail -c '
    npm install --prefix /tmp/lbww-pnpm pnpm@11.22.0 --no-audit --no-fund
    export PATH="/tmp/lbww-pnpm/node_modules/.bin:$PATH"
    if [[ "$1" == web || "$1" == all ]]; then
      export AUTH_SECRET=visual-test-secret AUTH_GOOGLE_ID=visual-test-google-id
      export AUTH_GOOGLE_SECRET=visual-test-google-secret BACKEND_SECRET=visual-test-backend-secret
      export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mernmafia
      export NEXT_PUBLIC_SOCKET_BACKEND=partyserver NEXT_PUBLIC_SOCKET_URL=http://127.0.0.1:1999
      pnpm --dir nextjs run storybook:screenshots
    fi
    if [[ "$1" == mobile || "$1" == all ]]; then pnpm --dir mobile run visual:screenshots; fi
    if [[ "$1" == mobile-storybook || "$1" == all ]]; then pnpm --dir mobile run storybook:screenshots; fi
  ' visual-baselines "$suite"
