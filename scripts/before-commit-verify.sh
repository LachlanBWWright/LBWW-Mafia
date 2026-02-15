#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
NEXTJS_PROJECT_DIR="nextjs"
echo "Using MAX_FILE_LINES=${MAX_FILE_LINES:-500} for staged file guardrails."
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
      if [ "$project_dir" = "$NEXTJS_PROJECT_DIR" ]; then
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
ROOT_DIR="$ROOT_DIR" python3 - <<'PY'
import subprocess
import sys
import os
from pathlib import Path

root = Path(os.environ["ROOT_DIR"])
MAX_FILE_LINES = int(os.environ.get("MAX_FILE_LINES", "500"))
MAX_INDENT_TS = 16
MAX_INDENT_TSX = 28
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
    current_lines = len(content)

    head_content = subprocess.run(
        ["git", "show", f"HEAD:{relative.as_posix()}"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    head_exists = head_content.returncode == 0
    previous_lines = len(head_content.stdout.splitlines()) if head_exists else 0

    if current_lines > MAX_FILE_LINES and (not head_exists or previous_lines <= MAX_FILE_LINES):
        errors.append(f"{relative}: exceeds {MAX_FILE_LINES} lines ({current_lines})")

    max_indent = MAX_INDENT_TS if relative.suffix == ".ts" else MAX_INDENT_TSX
    patch = subprocess.run(
        ["git", "diff", "--cached", "-U0", "--", relative.as_posix()],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    for patch_line in patch:
        if not patch_line.startswith("+") or patch_line.startswith("+++"):
            continue
        line = patch_line[1:]
        stripped = line.lstrip(" ")
        if not stripped or stripped.startswith("//"):
            continue
        indent = len(line) - len(stripped)
        if indent > max_indent:
            errors.append(
                f"{relative}: added line indentation exceeds limit ({indent} spaces)"
            )

if errors:
    print("Verification failed:")
    for err in errors:
        print(f" - {err}")
    sys.exit(1)

print("Guardrails passed.")
PY

echo "All checks passed."
