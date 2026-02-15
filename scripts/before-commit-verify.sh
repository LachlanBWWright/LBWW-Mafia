#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="/home/runner/work/MERN-Mafia/MERN-Mafia"
cd "$ROOT_DIR"

run_project_checks() {
  local project_dir="$1"
  echo "==> Verifying ${project_dir}"
  (
    cd "$project_dir"
    npm install
    npm run lint
    if npm run | grep -q " test"; then
      npm run test
    fi
    if npm run | grep -q " build"; then
      if [ "$project_dir" = "nextjs" ]; then
        AUTH_SECRET=dummy \
        AUTH_GOOGLE_ID=dummy \
        AUTH_GOOGLE_SECRET=dummy \
        DATABASE_URL=file:./dev.db \
        npm run build
      else
        npm run build
      fi
    fi
  )
}

echo "==> Running project checks"
run_project_checks "server"
run_project_checks "nextjs"
run_project_checks "mobile"

echo "==> Running staged file guardrails"
python3 - <<'PY'
import subprocess
import sys
from pathlib import Path

root = Path("/home/runner/work/MERN-Mafia/MERN-Mafia")
result = subprocess.run(
    ["git", "diff", "--cached", "--name-only"],
    cwd=root,
    capture_output=True,
    text=True,
    check=True,
)

files = [Path(line.strip()) for line in result.stdout.splitlines() if line.strip()]
errors = []

for relative in files:
    if relative.suffix not in {".ts", ".tsx"}:
        continue
    full = root / relative
    if not full.exists():
        continue
    content = full.read_text(encoding="utf-8", errors="ignore").splitlines()
    if len(content) > 500:
        errors.append(f"{relative}: exceeds 500 lines ({len(content)})")

    max_indent = 16 if relative.suffix == ".ts" else 28
    for line_no, line in enumerate(content, start=1):
        stripped = line.lstrip(" ")
        if not stripped or stripped.startswith("//"):
            continue
        indent = len(line) - len(stripped)
        if indent > max_indent:
            errors.append(
                f"{relative}:{line_no}: indentation exceeds limit ({indent} spaces)"
            )

if errors:
    print("Verification failed:")
    for err in errors:
        print(f" - {err}")
    sys.exit(1)

print("Guardrails passed.")
PY

echo "All checks passed."
