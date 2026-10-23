#!/usr/bin/env bash
set -euo pipefail

TOP=50
for arg in "$@"; do
  case "$arg" in
    --top=*)
      TOP="${arg#--top=}"
      ;;
  esac
done

if ! [[ "$TOP" =~ ^[0-9]+$ ]] || [[ "$TOP" -le 0 ]]; then
  echo "Invalid --top value. Example: --top=25" >&2
  exit 1
fi

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

find . \
  -type d \( -name .git -o -name node_modules -o -name build -o -name dist -o -name .next -o -name coverage -o -name .turbo \) -prune \
  -o -type f \( -name '*.ts' -o -name '*.tsx' \) -print \
| sed 's#^\./##' \
| while IFS= read -r file; do
    awk -v file="$file" '
      function count_level(line,   i,c,width) {
        width = 0;
        for (i = 1; i <= length(line); i++) {
          c = substr(line, i, 1);
          if (c == " ") width += 1;
          else if (c == "\t") width += 2;
          else break;
        }
        return int(width / 2);
      }
      {
        lines += 1;
        if ($0 ~ /^[[:space:]]*$/) next;
        nonempty += 1;

        match($0, /^[[:space:]]+/);
        indent = substr($0, RSTART, RLENGTH);
        if (RLENGTH > 0) {
          has_tab = index(indent, "\t") > 0;
          has_space = index(indent, " ") > 0;
          if (has_tab && has_space) mixed += 1;
          else if (has_tab) tabs += 1;
          else if (has_space) spaces += 1;
        }

        level = count_level($0);
        if (level > maxind) maxind = level;
        sumind += level;
      }
      END {
        avg = nonempty > 0 ? sumind / nonempty : 0;
        printf "%d\t%d\t%d\t%.2f\t%d\t%d\t%d\t%s\n", lines, nonempty, maxind, avg, tabs, spaces, mixed, file;
      }
    ' "$file"
  done > "$TMP_FILE"

printf "LINES   NONEMP  MAXIND  AVGIND  TABS    SPACES  MIXED   FILE\n"
sort -t $'\t' -k1,1nr -k3,3nr -k8,8 "$TMP_FILE" \
| head -n "$TOP" \
| awk -F '\t' '{
    printf "%6d  %6d  %6d  %6s  %6d  %7d  %6d  %s\n", $1, $2, $3, $4, $5, $6, $7, $8;
  }'

awk -F '\t' '
  {
    files += 1;
    total_lines += $1;
    total_nonempty += $2;
    if ($3 > max_indent) max_indent = $3;
  }
  END {
    printf "\nSummary:\n";
    printf "  Files analyzed: %d\n", files;
    printf "  Total lines: %d\n", total_lines;
    printf "  Total non-empty lines: %d\n", total_nonempty;
    printf "  Max indent level observed: %d\n", max_indent;
  }
' "$TMP_FILE"
