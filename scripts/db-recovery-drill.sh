#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?Set the backup source DATABASE_URL}"
: "${RESTORE_DATABASE_URL:?Set a disposable restore database URL}"
source_identity=$(psql --dbname="$DATABASE_URL" -X -At -c "select current_database() || ':' || coalesce(inet_server_addr()::text, 'local') || ':' || coalesce(inet_server_port()::text, 'local')")
restore_identity=$(psql --dbname="$RESTORE_DATABASE_URL" -X -At -c "select current_database() || ':' || coalesce(inet_server_addr()::text, 'local') || ':' || coalesce(inet_server_port()::text, 'local')")
restore_name=$(psql --dbname="$RESTORE_DATABASE_URL" -X -At -c 'select current_database()')
if [[ "$source_identity" == "$restore_identity" || "$restore_name" != mafia_restore_* ]]; then
  echo 'Restore target must be a separate disposable database named mafia_restore_*.' >&2
  exit 1
fi
dump_file=$(mktemp)
trap 'rm -f "$dump_file"' EXIT
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$dump_file"
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl --exit-on-error "$dump_file"
# Compare stable application rows; volatile operational limits are excluded.
for table in nextjs_user nextjs_match nextjs_match_participant nextjs_direct_message; do
  source_rows=$(psql --dbname="$DATABASE_URL" -X -At -c "select count(*) from $table")
  restore_rows=$(psql --dbname="$RESTORE_DATABASE_URL" -X -At -c "select count(*) from $table")
  [[ "$source_rows" == "$restore_rows" ]] || { echo "Row count mismatch: $table" >&2; exit 1; }
done
echo 'Backup restoration and application row counts verified.'
