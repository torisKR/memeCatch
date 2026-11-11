#!/bin/bash
# Map a postgres URL onto libpq's PGHOST/PGPORT/PGUSER/PGDATABASE and a mode-0600
# pgpass file. Callers must not put the URL on a command line that ps can read.
pg_env_from_url() {
  local url="${1:-${DATABASE_URL:-}}"
  if [[ -z "$url" ]]; then
    echo "DATABASE_URL is required" >&2
    return 1
  fi
  local parsed
  parsed="$(
    PG_ENV_URL="$url" PGPASSFILE_TARGET="${PGPASSFILE:-}" python3 - <<'PY'
import os, stat, tempfile, urllib.parse
url = urllib.parse.urlparse(os.environ["PG_ENV_URL"])
if url.scheme not in ("postgres", "postgresql") or not url.hostname or not url.path.strip("/"):
    raise SystemExit("DATABASE_URL must be a postgres URL with a host and database")
host = url.hostname
port = str(url.port or 5432)
user = urllib.parse.unquote(url.username or "")
password = urllib.parse.unquote(url.password or "")
database = urllib.parse.unquote(url.path.lstrip("/").split("?")[0])

def esc(value):
    return value.replace("\\", "\\\\").replace(":", "\\:")

target = os.environ.get("PGPASSFILE_TARGET") or ""
if not target:
    handle, target = tempfile.mkstemp(prefix="pgpass-")
    os.close(handle)
with open(target, "w") as handle:
    handle.write(f"{esc(host)}:{port}:*:{esc(user)}:{esc(password)}\n")
os.chmod(target, stat.S_IRUSR | stat.S_IWUSR)
print("\n".join([host, port, user, database, target]))
PY
  )"
  unset PG_ENV_URL
  local host port user database file
  mapfile -t parts <<<"$parsed"
  host="${parts[0]}"
  port="${parts[1]}"
  user="${parts[2]}"
  database="${parts[3]}"
  file="${parts[4]}"
  export PGHOST="$host" PGPORT="$port" PGUSER="$user" PGDATABASE="$database" PGPASSFILE="$file"
  unset PGPASSWORD
}
