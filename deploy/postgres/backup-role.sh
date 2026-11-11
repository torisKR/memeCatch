#!/bin/bash
# Idempotent memecatch_backup login. pg_dump uses it instead of memecatch so
# row-level security does not hide tables from the backup. SELECT covers every
# non-system schema, including tables created later by postgres or memecatch.
ensure_backup_role() {
  if [[ -z "${MEMECATCH_BACKUP_DB_PASSWORD:-}" ]]; then
    echo "MEMECATCH_BACKUP_DB_PASSWORD is required" >&2
    return 1
  fi
  local pw_tag
  pw_tag="pw$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
  run_psql() {
    if declare -F memecatch_psql >/dev/null; then
      memecatch_psql -v ON_ERROR_STOP=1 "$@"
    else
      psql -v ON_ERROR_STOP=1 -d memecatch "$@"
    fi
  }
  run_psql <<SQL
DO \$do\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'memecatch_backup') THEN
    CREATE ROLE memecatch_backup LOGIN PASSWORD \$${pw_tag}\$${MEMECATCH_BACKUP_DB_PASSWORD}\$${pw_tag}\$ BYPASSRLS;
  ELSE
    ALTER ROLE memecatch_backup WITH LOGIN PASSWORD \$${pw_tag}\$${MEMECATCH_BACKUP_DB_PASSWORD}\$${pw_tag}\$ BYPASSRLS;
  END IF;
END
\$do\$;
SQL
  run_psql <<'SQL'
DO $$
DECLARE
  schema_name text;
  owner_name text;
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO memecatch_backup', current_database());
  FOR schema_name IN
    SELECT nspname
      FROM pg_namespace
     WHERE nspname <> 'information_schema'
       AND nspname NOT LIKE 'pg_%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO memecatch_backup', schema_name);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO memecatch_backup', schema_name);
    EXECUTE format('GRANT SELECT ON ALL SEQUENCES IN SCHEMA %I TO memecatch_backup', schema_name);
    FOREACH owner_name IN ARRAY ARRAY['postgres', 'memecatch']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_name) THEN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT ON TABLES TO memecatch_backup',
          owner_name, schema_name
        );
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT ON SEQUENCES TO memecatch_backup',
          owner_name, schema_name
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
SQL
}

case "$(basename -- "$0")" in
  backup-role.sh)
    set -euo pipefail
    if [[ -z "${DATABASE_URL:-}" ]]; then
      echo "DATABASE_URL must be a superuser URL when running this outside init" >&2
      exit 1
    fi
    here="$(cd "$(dirname "$0")" && pwd)"
    # shellcheck disable=SC1091
    source "$here/pg-env.sh"
    pg_env_from_url "$DATABASE_URL"
    ensure_backup_role
    ;;
esac
