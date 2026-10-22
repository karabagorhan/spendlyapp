#!/usr/bin/env bash
# Migration'ı geçici bir PostgreSQL kümesinde çalıştırıp RLS/yetki testlerini koşar: `npm run test:sql`
# Gerekli: PostgreSQL sunucu ikilileri (initdb, pg_ctl, psql). Supabase gerekmez.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
[ -n "$BIN" ] || BIN="$(dirname "$(command -v initdb)")"
WORK="$(mktemp -d)"
cp "$HERE"/00_stubs.sql "$HERE"/accounts.test.sql "$WORK"/
cp "${MIGRATIONS_DIR:-$HERE/../migrations}"/*.sql "$WORK"/
chmod -R a+rX "$WORK"
run() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$1"; else bash -c "$1"; fi; }
[ "$(id -u)" = 0 ] && chown -R postgres "$WORK"
cleanup() { run "'$BIN/pg_ctl' -D '$WORK/data' -m immediate stop >/dev/null 2>&1 || true"; rm -rf "$WORK"; }
trap cleanup EXIT
run "'$BIN/initdb' -D '$WORK/data' -A trust -U postgres >/dev/null"
run "'$BIN/pg_ctl' -D '$WORK/data' -o \"-c listen_addresses='' -c unix_socket_directories='$WORK'\" -l '$WORK/log' -w start >/dev/null"
P="'$BIN/psql' -h '$WORK' -U postgres -d postgres -X -q -v ON_ERROR_STOP=1"
run "$P -f '$WORK/00_stubs.sql'"
for m in "$WORK"/2*.sql; do run "$P -f '$m'"; done
run "$P -t -A -f '$WORK/accounts.test.sql'"
