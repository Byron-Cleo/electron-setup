#!/bin/bash
# Sync eraevadb from the Windows POS server into the local eraevadb (run manually).
# Usage: ~/sync-eraevadb.sh
set -e

REMOTE_SSH_HOST="pos-edit"     # SSH host from ~/.ssh/config (Windows server, no port forwards)
TUNNEL_PORT=15432               # dedicated local port for this script's tunnel
REMOTE_DB="eraevadb"
REMOTE_DB_USER="postgres"
LOCAL_DB="eraevadb"
LOCAL_USER="$(whoami)"
DUMP_FILE="$HOME/Downloads/eraevadb-sync-$(date +%Y%m%d-%H%M%S).dump"

echo "==> Opening SSH tunnel to Windows server (localhost:$TUNNEL_PORT -> 127.0.0.1:5432)..."
ssh -N -o ExitOnForwardFailure=yes -L "$TUNNEL_PORT:127.0.0.1:5432" "$REMOTE_SSH_HOST" >/dev/null 2>&1 &
TUNNEL_PID=$!
cleanup() { kill "$TUNNEL_PID" 2>/dev/null || true; }
trap cleanup EXIT

for i in $(seq 1 15); do
  pg_isready -h 127.0.0.1 -p "$TUNNEL_PORT" -t 2 >/dev/null 2>&1 && break
  sleep 1
done
if ! pg_isready -h 127.0.0.1 -p "$TUNNEL_PORT" -t 2 >/dev/null 2>&1; then
  echo "ERROR: could not establish tunnel to the Windows server."
  exit 1
fi

echo "==> Dumping $REMOTE_DB from Windows server (enter the remote postgres password when prompted)..."
pg_dump -h 127.0.0.1 -p "$TUNNEL_PORT" -U "$REMOTE_DB_USER" -Fc -f "$DUMP_FILE" "$REMOTE_DB"

echo "==> Recreating local $LOCAL_DB..."
psql -U "$LOCAL_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$LOCAL_DB' AND pid <> pg_backend_pid();" >/dev/null
dropdb -U "$LOCAL_USER" --if-exists "$LOCAL_DB"
createdb -U "$LOCAL_USER" "$LOCAL_DB"

echo "==> Restoring dump into local $LOCAL_DB..."
pg_restore -h localhost -p 5432 -U "$LOCAL_USER" --no-owner --no-privileges -d "$LOCAL_DB" "$DUMP_FILE"

echo "==> Done. Local '$LOCAL_DB' is now an exact copy of the Windows server."
echo "    Dump kept at: $DUMP_FILE"
psql -U "$LOCAL_USER" -d "$LOCAL_DB" -t -c "SELECT 'Tables restored: ' || count(*) FROM information_schema.tables WHERE table_schema='public';"
