#!/usr/bin/env bash
set -euo pipefail

die() {
  echo "$1" >&2
  exit 1
}

[[ "${ALLOW_DESTRUCTIVE_AFFILIATE_DB_TEST:-}" == "1" ]] ||
  die "ALLOW_DESTRUCTIVE_AFFILIATE_DB_TEST=1 is required"

database_url="${TEST_DATABASE_URL:-}"
[[ -n "$database_url" ]] || die "TEST_DATABASE_URL is required"

database_url_pattern='^postgres(ql)?://([^/@]+@)?(\[[^]]+\]|[^/:?#]+)(:[0-9]+)?/([A-Za-z0-9_]+)(\?.*)?$'
if [[ ! "$database_url" =~ $database_url_pattern ]]; then
  die "TEST_DATABASE_URL must be an explicit PostgreSQL URL"
fi

database_host="${BASH_REMATCH[3]}"
database_name="${BASH_REMATCH[5]}"
case "$database_host" in
  127.0.0.1 | localhost | "[::1]") ;;
  *) die "database host must be loopback" ;;
esac

[[ "$database_name" =~ ^affiliate_sync_test_[A-Za-z0-9_]+$ ]] ||
  die "database name must start with affiliate_sync_test_"

namespace="a$$_${RANDOM}_$(date +%s)"
winner_key="affiliate_${namespace}_winner"
fence_key="affiliate_${namespace}_fence"
work_dir="$(mktemp -d)"
holder_pid=""
apply_pid=""
claim_pid=""
holder_backend_pid=""
fixture_started=false
declare -a run_fixtures=()

psql_test() {
  PGOPTIONS="-c search_path=public" psql "$database_url" -X -v ON_ERROR_STOP=1 "$@"
}

actual_database="$(psql_test -qAt -v expected_database="$database_name" <<'SQL'
select current_database();
SQL
)"
[[ "$actual_database" == "$database_name" ]] ||
  die "connected database does not match TEST_DATABASE_URL"

fixture_counts="$(psql_test -qAt <<'SQL'
select
  (select count(*) from public.affiliate_products) || '|' ||
  (select count(*) from public.affiliate_sync_runs) || '|' ||
  (select count(*) from public.affiliate_product_daily_metrics);
SQL
)"
[[ "$fixture_counts" == "0|0|0" ]] ||
  die "affiliate concurrency test requires empty affiliate fixture tables"

IFS='|' read -r test_date fence_date < <(
  psql_test -qAt -v namespace="$namespace" <<'SQL'
with fixture_date as (
  select date '2100-01-01'
    + mod(hashtextextended(:'namespace', 0) & 2147483647, 20000)::integer as value
)
select value || '|' || (value + 1)
from fixture_date;
SQL
)

cleanup() {
  for pid in "$claim_pid" "$apply_pid" "$holder_pid"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done

  if [[ "$fixture_started" == "true" ]]; then
    psql_test -qAt -v winner_key="$winner_key" -v fence_key="$fence_key" <<'SQL' >/dev/null 2>&1 || true
delete from public.affiliate_products
where provider = 'adpick'
  and source_type = 'hotdeal'
  and external_key in (:'winner_key', :'fence_key');
SQL

    local fixture=""
    local fixture_run_id=""
    local fixture_date=""
    for fixture in "${run_fixtures[@]}"; do
      IFS='|' read -r fixture_run_id fixture_date <<<"$fixture"
      psql_test -qAt -v run_id="$fixture_run_id" -v scheduled_date="$fixture_date" <<'SQL' >/dev/null 2>&1 || true
delete from public.affiliate_sync_runs
where id = :'run_id'::uuid
  and provider = 'adpick'
  and source_type = 'hotdeal'
  and scheduled_date = :'scheduled_date'::date;
SQL
    done
  fi

  rm -rf "$work_dir"
}
trap cleanup EXIT

capture_backend_pid() {
  local application_name="$1"
  local attempts=0
  local backend_pid=""

  while (( attempts < 100 )); do
    backend_pid="$(psql_test -qAt -v application_name="$application_name" <<'SQL'
select pid
from pg_stat_activity
where application_name = :'application_name';
SQL
)"
    if [[ "$backend_pid" =~ ^[0-9]+$ ]]; then
      printf '%s' "$backend_pid"
      return 0
    fi
    sleep 0.05
    attempts=$((attempts + 1))
  done

  echo "timed out capturing backend PID for $application_name" >&2
  return 1
}

wait_for_backend() {
  local backend_pid="$1"
  local expected="$2"
  local attempts=0
  local observed=""

  while (( attempts < 100 )); do
    observed="$(psql_test -qAt -v backend_pid="$backend_pid" <<'SQL'
select case
  when state = 'idle in transaction' then 'idle in transaction'
  when wait_event_type = 'Lock' then 'waiting for lock'
  else coalesce(state, '')
end
from pg_stat_activity
where pid = :'backend_pid'::integer;
SQL
)"
    if [[ "$observed" == "$expected" ]]; then
      return 0
    fi
    sleep 0.05
    attempts=$((attempts + 1))
  done

  echo "timed out waiting for backend $backend_pid: expected '$expected', observed '$observed'" >&2
  return 1
}

start_row_lock_holder() {
  local application_name="$1"
  local lock_sql="$2"
  local gate="$3"

  mkfifo "$gate"
  (
    export PGAPPNAME="$application_name"
    {
      printf 'begin;\n%s\n' "$lock_sql"
      cat "$gate"
      printf 'commit;\n'
    } | psql_test -q >/dev/null
  ) &
  holder_pid=$!
  holder_backend_pid="$(capture_backend_pid "$application_name")"
  wait_for_backend "$holder_backend_pid" "idle in transaction"
}

release_row_lock_holder() {
  local gate="$1"
  : >"$gate"
  wait "$holder_pid"
  holder_pid=""
  holder_backend_pid=""
}

fixture_started=true
run_id="$(psql_test -qAt -v test_date="$test_date" <<'SQL'
select run_id
from public.claim_affiliate_sync(
  'adpick',
  'hotdeal',
  :'test_date'::date,
  :'test_date'::date::timestamptz
);
SQL
)"
run_fixtures+=("$run_id|$test_date")

run_holder_app="affiliate_run_holder_${namespace}"
apply_app="affiliate_apply_${namespace}"
claim_app="affiliate_claim_${namespace}"
run_gate="$work_dir/run-gate"
start_row_lock_holder \
  "$run_holder_app" \
  "select id from public.affiliate_sync_runs where id = '$run_id'::uuid for update;" \
  "$run_gate"

(
  export PGAPPNAME="$apply_app"
  psql_test -qAt -v run_id="$run_id" -v test_date="$test_date" -v winner_key="$winner_key" <<'SQL'
select public.apply_affiliate_sync(
  :'run_id'::uuid,
  :'test_date'::date::timestamptz + interval '1 minute',
  jsonb_build_array(jsonb_build_object(
    'provider', 'adpick',
    'sourceType', 'hotdeal',
    'externalKey', :'winner_key',
    'themeCode', null,
    'themeTitle', 'Theme',
    'themeDescription', 'Description',
    'sourceRank', 0,
    'productName', 'Concurrency winner',
    'imageUrl', null,
    'mallDomain', null,
    'mallName', null,
    'mallIconUrl', null,
    'salePrice', 1000,
    'originalPrice', 2000,
    'commissionLabel', '10%',
    'affiliateUrl', 'https://adpick.co.kr/apis/goshopping.php?offer=' || :'winner_key' || '&url=x',
    'syncedAt', (:'test_date'::date::timestamptz + interval '1 minute')::text
  ))
);
SQL
) >"$work_dir/apply.out" 2>"$work_dir/apply.err" &
apply_pid=$!
apply_backend_pid="$(capture_backend_pid "$apply_app")"
wait_for_backend "$apply_backend_pid" "waiting for lock"

(
  export PGAPPNAME="$claim_app"
  psql_test -qAt -v test_date="$test_date" <<'SQL'
select run_id || '|' || claimed || '|' || result
from public.claim_affiliate_sync(
  'adpick',
  'hotdeal',
  :'test_date'::date,
  :'test_date'::date::timestamptz + interval '16 minutes'
);
SQL
) >"$work_dir/claim.out" 2>"$work_dir/claim.err" &
claim_pid=$!
claim_backend_pid="$(capture_backend_pid "$claim_app")"
wait_for_backend "$claim_backend_pid" "waiting for lock"

release_row_lock_holder "$run_gate"
wait "$apply_pid"
apply_pid=""
wait "$claim_pid"
claim_pid=""

claim_result="$(tr -d '[:space:]' <"$work_dir/claim.out")"
run_state="$(psql_test -qAt -v test_date="$test_date" <<'SQL'
select id || '|' || status
from public.affiliate_sync_runs
where provider = 'adpick'
  and source_type = 'hotdeal'
  and scheduled_date = :'test_date'::date;
SQL
)"
current_run_id="${run_state%%|*}"
if [[ "$current_run_id" =~ ^[0-9a-f-]{36}$ && "$current_run_id" != "$run_id" ]]; then
  run_fixtures+=("$current_run_id|$test_date")
fi

if [[ "$claim_result" != "$run_id|false|skipped" ]]; then
  echo "claim raced a successful apply: expected '$run_id|false|skipped', got '$claim_result'" >&2
  exit 1
fi

if [[ "$run_state" != "$run_id|succeeded" ]]; then
  echo "successful run was rotated after apply: expected '$run_id|succeeded', got '$run_state'" >&2
  exit 1
fi

old_run_id="$(psql_test -qAt -v fence_date="$fence_date" <<'SQL'
select run_id
from public.claim_affiliate_sync(
  'adpick',
  'hotdeal',
  :'fence_date'::date,
  :'fence_date'::date::timestamptz
);
SQL
)"
run_fixtures+=("$old_run_id|$fence_date")

psql_test -qAt -v fence_date="$fence_date" -v fence_key="$fence_key" <<'SQL' >/dev/null
insert into public.affiliate_products (
  provider, source_type, external_key, theme_code, theme_title,
  theme_description, source_rank, product_name, image_url, mall_domain,
  mall_name, mall_icon_url, sale_price, original_price, commission_label,
  affiliate_url, is_active, first_seen_at, last_seen_at, synced_at
) values (
  'adpick', 'hotdeal', :'fence_key', null, 'Theme',
  'Description', 0, 'Early fence', null, null,
  null, null, 1000, 2000, '10%',
  'https://adpick.co.kr/apis/goshopping.php?offer=' || :'fence_key' || '&url=x', true,
  :'fence_date'::date::timestamptz,
  :'fence_date'::date::timestamptz,
  :'fence_date'::date::timestamptz
);
SQL

new_run_id="$(psql_test -qAt -v fence_date="$fence_date" <<'SQL'
select run_id
from public.claim_affiliate_sync(
  'adpick',
  'hotdeal',
  :'fence_date'::date,
  :'fence_date'::date::timestamptz + interval '16 minutes'
);
SQL
)"
run_fixtures+=("$new_run_id|$fence_date")

product_holder_app="affiliate_product_holder_${namespace}"
stale_apply_app="affiliate_stale_apply_${namespace}"
product_gate="$work_dir/product-gate"
start_row_lock_holder \
  "$product_holder_app" \
  "select id from public.affiliate_products where external_key = '$fence_key' for update;" \
  "$product_gate"

set +e
PGOPTIONS="-c search_path=public -c statement_timeout=1500" \
  PGAPPNAME="$stale_apply_app" \
  psql "$database_url" -X -v ON_ERROR_STOP=1 \
  -v old_run_id="$old_run_id" -v fence_date="$fence_date" -v fence_key="$fence_key" \
  >"$work_dir/stale.out" 2>"$work_dir/stale.err" <<'SQL'
\set VERBOSITY verbose
select public.apply_affiliate_sync(
  :'old_run_id'::uuid,
  :'fence_date'::date::timestamptz + interval '17 minutes',
  jsonb_build_array(jsonb_build_object(
    'provider', 'adpick',
    'sourceType', 'hotdeal',
    'externalKey', :'fence_key',
    'themeCode', null,
    'themeTitle', 'Theme',
    'themeDescription', 'Description',
    'sourceRank', 0,
    'productName', 'Stale mutation',
    'imageUrl', null,
    'mallDomain', null,
    'mallName', null,
    'mallIconUrl', null,
    'salePrice', 1000,
    'originalPrice', 2000,
    'commissionLabel', '10%',
    'affiliateUrl', 'https://adpick.co.kr/apis/goshopping.php?offer=' || :'fence_key' || '&url=x',
    'syncedAt', (:'fence_date'::date::timestamptz + interval '17 minutes')::text
  ))
);
SQL
stale_status=$?
set -e

release_row_lock_holder "$product_gate"

if [[ $stale_status -eq 0 ]] || ! grep -q '55000' "$work_dir/stale.err"; then
  echo "stale apply was not fenced before product locking/mutation" >&2
  cat "$work_dir/stale.err" >&2
  exit 1
fi

echo "affiliate sync concurrency regression: ok"
