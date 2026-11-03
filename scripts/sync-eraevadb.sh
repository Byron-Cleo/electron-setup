#!/bin/bash
# Sync eraevadb from the Windows POS server into the local eraevadb (run manually).
# Usage: npm run db:pull
#
# The remote side is read with the read-only "era_analyst" role over an SSH
# tunnel, so this script can never write to production and the remote
# PostgreSQL port is never exposed. If REMOTE_DB_USER needs a password, provide
# it via PGPASSWORD or a ~/.pgpass entry (the script never prompts).
#
# Environment overrides:
#   REMOTE_SSH_HOST    SSH host alias for the Windows server (default: pos-edit)
#   TUNNEL_PORT        local port forwarded to the remote 127.0.0.1:5432 (default: 15432)
#   REUSE_TUNNEL       1 = use an already-forwarded TUNNEL_PORT instead of opening one
#   REMOTE_DB          remote database name (default: eraevadb)
#   REMOTE_DB_USER     remote role, read-only (default: era_analyst)
#   LOCAL_DB           local database to recreate (default: eraevadb)
#   LOCAL_USER         local superuser (default: current user)
#   LOCAL_HOST         local PostgreSQL host (default: localhost)
#   LOCAL_PORT         local PostgreSQL port (default: 5432)
#   DUMP_FILE          remote dump destination
#   LOCAL_BACKUP_FILE  pre-restore backup of the current local database
set -e

REMOTE_SSH_HOST="${REMOTE_SSH_HOST:-pos-edit}"
TUNNEL_PORT="${TUNNEL_PORT:-15432}"
REUSE_TUNNEL="${REUSE_TUNNEL:-0}"
REMOTE_DB="${REMOTE_DB:-eraevadb}"
REMOTE_DB_USER="${REMOTE_DB_USER:-era_analyst}"
LOCAL_DB="${LOCAL_DB:-eraevadb}"
LOCAL_USER="${LOCAL_USER:-$(whoami)}"
LOCAL_HOST="${LOCAL_HOST:-localhost}"
LOCAL_PORT="${LOCAL_PORT:-5432}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${DUMP_FILE:-$HOME/Downloads/eraevadb-sync-$STAMP.dump}"
LOCAL_BACKUP_FILE="${LOCAL_BACKUP_FILE:-$HOME/Downloads/eraevadb-local-backup-$STAMP.dump}"

TUNNEL_PID=""
TUNNEL_LOG="$(mktemp)"
cleanup() {
  if [ -n "$TUNNEL_PID" ]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  rm -f "$TUNNEL_LOG"
}
trap cleanup EXIT

if [ "$REUSE_TUNNEL" = "1" ]; then
  echo "==> Reusing the existing tunnel on 127.0.0.1:$TUNNEL_PORT..."
else
  echo "==> Opening SSH tunnel to Windows server (localhost:$TUNNEL_PORT -> 127.0.0.1:5432)..."
  ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes \
    -L "$TUNNEL_PORT:127.0.0.1:5432" "$REMOTE_SSH_HOST" >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!
  for i in $(seq 1 15); do
    pg_isready -h 127.0.0.1 -p "$TUNNEL_PORT" -t 2 >/dev/null 2>&1 && break
    kill -0 "$TUNNEL_PID" 2>/dev/null || break
    sleep 1
  done
fi

if ! pg_isready -h 127.0.0.1 -p "$TUNNEL_PORT" -t 2 >/dev/null 2>&1; then
  echo "ERROR: could not reach PostgreSQL on 127.0.0.1:$TUNNEL_PORT."
  if [ -s "$TUNNEL_LOG" ]; then
    echo "    SSH output:"
    sed 's/^/      /' "$TUNNEL_LOG"
  fi
  echo "    Check that the server is reachable (ssh $REMOTE_SSH_HOST hostname) and that"
  echo "    Tailscale is connected, then retry."
  exit 1
fi

echo "==> Dumping $REMOTE_DB from the Windows server as $REMOTE_DB_USER -> $DUMP_FILE"
pg_dump -h 127.0.0.1 -p "$TUNNEL_PORT" -U "$REMOTE_DB_USER" -w -Fc -f "$DUMP_FILE" "$REMOTE_DB"
echo "    Dump size: $(du -h "$DUMP_FILE" | cut -f1)"

echo "==> Backing up the current local $LOCAL_DB -> $LOCAL_BACKUP_FILE"
if psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d postgres -t -A \
  -c "select 1 from pg_database where datname='$LOCAL_DB'" | grep -q 1; then
  pg_dump -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -Fc -f "$LOCAL_BACKUP_FILE" "$LOCAL_DB"
  echo "    Local backup size: $(du -h "$LOCAL_BACKUP_FILE" | cut -f1)"
else
  echo "    Local $LOCAL_DB does not exist yet, nothing to back up."
fi

echo "==> Recreating local $LOCAL_DB..."
psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$LOCAL_DB' AND pid <> pg_backend_pid();" >/dev/null
dropdb -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" --if-exists "$LOCAL_DB"
createdb -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" "$LOCAL_DB"

echo "==> Restoring dump into local $LOCAL_DB..."
RESTORE_LOG="$(mktemp)"
if ! pg_restore -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" \
  --no-owner --no-privileges -d "$LOCAL_DB" "$DUMP_FILE" 2>"$RESTORE_LOG"; then
  echo "ERROR: pg_restore failed."
  cat "$RESTORE_LOG"
  rm -f "$RESTORE_LOG"
  exit 1
fi
if [ -s "$RESTORE_LOG" ]; then
  echo "    pg_restore warnings:"
  sed 's/^/      /' "$RESTORE_LOG"
fi
rm -f "$RESTORE_LOG"

echo "==> Verifying local $LOCAL_DB against the remote copy..."
psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d "$LOCAL_DB" -t -A \
  -c "SELECT 'Tables restored: ' || count(*) FROM information_schema.tables WHERE table_schema='public';"

for table in Menu Order OrderItem User Shift StockRequest Customer MenuAccompaniment; do
  remote_count="$(psql -h 127.0.0.1 -p "$TUNNEL_PORT" -U "$REMOTE_DB_USER" -w -t -A -d "$REMOTE_DB" \
    -c "SELECT count(*) FROM public.\"$table\";")"
  local_count="$(psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "$LOCAL_USER" -d "$LOCAL_DB" -t -A \
    -c "SELECT count(*) FROM public.\"$table\";")"
  if [ "$remote_count" = "$local_count" ]; then
    status="OK"
  else
    status="MISMATCH"
  fi
  printf "    %-20s remote=%-8s local=%-8s %s\n" "$table" "$remote_count" "$local_count" "$status"
done

echo "==> Done. Local '$LOCAL_DB' is now an exact copy of the Windows server."
echo "    Remote dump: $DUMP_FILE"
echo "    Local backup of the previous database: $LOCAL_BACKUP_FILE"
