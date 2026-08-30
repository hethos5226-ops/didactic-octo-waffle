#!/usr/bin/env bash
#
# Runs the row-level security tests against a real PostgreSQL.
#
# Reading a policy tells you what its author intended. Running it tells you
# what the database will do when a browser sends a request the author never
# imagined — which is the only thing that actually protects the data, because
# PostgREST puts the tables on the public internet and the key that reaches
# them ships inside the published bundle.
#
# Two ways to get a database, tried in order:
#   1. $DATABASE_URL, if set (this is what CI uses — a postgres service)
#   2. a throwaway cluster started here from a local PostgreSQL install
#
# Nothing here touches the real Supabase project. Ever.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

TMPDIR_PG="${TMPDIR:-/tmp}/scroll-pgtest"
STARTED_LOCAL=0

cleanup() {
  if [ "$STARTED_LOCAL" = "1" ]; then
    su "$PGUSER_LOCAL" -c "$PGBIN/pg_ctl -D $TMPDIR_PG/data stop -m immediate" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Using DATABASE_URL"
  PSQL=(psql "$DATABASE_URL")
else
  PGBIN=""
  for dir in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin /opt/homebrew/opt/postgresql@16/bin; do
    [ -x "$dir/initdb" ] && PGBIN="$dir" && break
  done
  if [ -z "$PGBIN" ] && command -v initdb >/dev/null 2>&1; then
    PGBIN="$(dirname "$(command -v initdb)")"
  fi
  if [ -z "$PGBIN" ]; then
    echo "No PostgreSQL found, and DATABASE_URL is not set." >&2
    echo "Install PostgreSQL, or set DATABASE_URL to a scratch database." >&2
    echo "CI runs these tests on every push, so this is not a blocker locally." >&2
    exit 2
  fi

  # initdb refuses to run as root, so a throwaway unprivileged user owns the
  # cluster when this is running somewhere that happens to be root.
  PGUSER_LOCAL="$(id -un)"
  if [ "$(id -u)" = "0" ]; then
    PGUSER_LOCAL=pgtester
    id -u "$PGUSER_LOCAL" >/dev/null 2>&1 || useradd -m "$PGUSER_LOCAL"
  fi

  echo "Starting a throwaway PostgreSQL from $PGBIN"
  rm -rf "$TMPDIR_PG"
  mkdir -p "$TMPDIR_PG/data"
  chown -R "$PGUSER_LOCAL" "$TMPDIR_PG"
  su "$PGUSER_LOCAL" -c "$PGBIN/initdb -D $TMPDIR_PG/data -A trust -U postgres" >"$TMPDIR_PG/init.log" 2>&1
  su "$PGUSER_LOCAL" -c "$PGBIN/pg_ctl -D $TMPDIR_PG/data -l $TMPDIR_PG/pg.log -o '-p 5433 -k $TMPDIR_PG' start" >/dev/null 2>&1
  STARTED_LOCAL=1

  for _ in $(seq 1 30); do
    psql -h "$TMPDIR_PG" -p 5433 -U postgres -c 'select 1' >/dev/null 2>&1 && break
    sleep 0.3
  done

  psql -q -h "$TMPDIR_PG" -p 5433 -U postgres \
    -c 'drop database if exists scrollr_test' \
    -c 'create database scrollr_test' >/dev/null
  PSQL=(psql -h "$TMPDIR_PG" -p 5433 -U postgres -d scrollr_test)
fi

run() { "${PSQL[@]}" -q -v ON_ERROR_STOP=1 -f "$1" >/dev/null; }

echo "Applying harness and migrations"
run "$ROOT/supabase/tests/harness.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "  $(basename "$migration")"
  run "$migration"
done
run "$ROOT/supabase/tests/helpers.sql"

echo

# Run once. The suite inserts fixtures, so a second pass would collide with the
# first and fail for a reason that has nothing to do with the policies.
OUT="$TMPDIR_PG.out"
set +e
"${PSQL[@]}" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/rls_test.sql" >"$OUT" 2>&1
STATUS=$?
set -e

sed -E 's/^psql:[^ ]* //; s/^NOTICE:  //' "$OUT" | grep -vE '^\s*$|^SET$|^ *$' || true

echo
if [ "$STATUS" -eq 0 ]; then
  echo "All row-level security tests passed."
else
  echo "Row-level security tests FAILED — see the FAIL line above." >&2
  exit 1
fi
