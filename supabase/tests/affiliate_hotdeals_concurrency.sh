#!/usr/bin/env bash
set -euo pipefail

database_url="${TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
test_date="2099-07-13"
fence_date="2099-07-14"
work_dir="$(mktemp -d)"
holder_pid=""
apply_pid=""
claim_pid=""

psql_test() {
  PGOPTIONS="-c search_path=public" psql "$database_url" -X -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
  for pid in "$claim_pid" "$apply_pid" "$holder_pid"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  psql_test -qAt <<SQL >/dev/null 2>&1 || true
delete from public.affiliate_products
where external_key in ('concurrency-winner', 'early-fence');
delete from public.affiliate_sync_runs
where scheduled_date in (date '$test_date', date '$fence_date');
SQL
  rm -rf "$work_dir"
}
trap cleanup EXIT

wait_for_activity() {
  local application_name="$1"
  local expected="$2"
  local attempts=0
  local observed=""

  while (( attempts < 100 )); do
    observed="$(psql_test -qAt -v application_name="$application_name" <<'SQL'
select case
  when state = 'idle in transaction' then 'idle in transaction'
  when wait_event_type = 'Lock' then 'waiting for lock'
  else coalesce(state, '')
end
from pg_stat_activity
where application_name = :'application_name';
SQL
)"
    if [[ "$observed" == "$expected" ]]; then
      return 0
    fi
    sleep 0.05
    attempts=$((attempts + 1))
  done

  echo "timed out waiting for $application_name: expected '$expected', observed '$observed'" >&2
  return 1
}

start_row_lock_holder() {
  local application_name="$1"
  local lock_sql="$2"
  local gate="$3"

  mkfifo "$gate"
  {
    printf 'begin;\n%s\n' "$lock_sql"
    cat "$gate"
    printf 'commit;\n'
  } | PGAPPNAME="$application_name" psql_test -q >/dev/null &
  holder_pid=$!
  wait_for_activity "$application_name" "idle in transaction"
}

release_row_lock_holder() {
  local gate="$1"
  : >"$gate"
  wait "$holder_pid"
  holder_pid=""
}

psql_test -qAt <<SQL >/dev/null
delete from public.affiliate_products
where external_key in ('concurrency-winner', 'early-fence');
delete from public.affiliate_sync_runs
where scheduled_date in (date '$test_date', date '$fence_date');
SQL

run_id="$(psql_test -qAt <<SQL
select run_id
from public.claim_affiliate_sync(
  'adpick',
  'hotdeal',
  date '$test_date',
  timestamptz '$test_date 00:00:00+00'
);
SQL
)"

run_gate="$work_dir/run-gate"
start_row_lock_holder \
  "affiliate_run_holder" \
  "select id from public.affiliate_sync_runs where id = '$run_id'::uuid for update;" \
  "$run_gate"

(
  PGAPPNAME="affiliate_apply" psql_test -qAt -v run_id="$run_id" <<'SQL'
select public.apply_affiliate_sync(
  :'run_id'::uuid,
  timestamptz '2099-07-13 00:01:00+00',
  $json$[{
    "provider":"adpick",
    "sourceType":"hotdeal",
    "externalKey":"concurrency-winner",
    "themeCode":null,
    "themeTitle":"Theme",
    "themeDescription":"Description",
    "sourceRank":0,
    "productName":"Concurrency winner",
    "imageUrl":null,
    "mallDomain":null,
    "mallName":null,
    "mallIconUrl":null,
    "salePrice":1000,
    "originalPrice":2000,
    "commissionLabel":"10%",
    "affiliateUrl":"https://adpick.co.kr/apis/goshopping.php?offer=concurrency-winner&url=x",
    "syncedAt":"2099-07-13T00:01:00Z"
  }]$json$::jsonb
);
SQL
) >"$work_dir/apply.out" 2>"$work_dir/apply.err" &
apply_pid=$!
wait_for_activity "affiliate_apply" "waiting for lock"

(
  PGAPPNAME="affiliate_claim" psql_test -qAt <<SQL
select run_id || '|' || claimed || '|' || result
from public.claim_affiliate_sync(
  'adpick',
  'hotdeal',
  date '$test_date',
  timestamptz '$test_date 00:16:00+00'
);
SQL
) >"$work_dir/claim.out" 2>"$work_dir/claim.err" &
claim_pid=$!
wait_for_activity "affiliate_claim" "waiting for lock"

release_row_lock_holder "$run_gate"
wait "$apply_pid"
apply_pid=""
wait "$claim_pid"
claim_pid=""

claim_result="$(tr -d '[:space:]' <"$work_dir/claim.out")"
run_state="$(psql_test -qAt -v run_id="$run_id" <<'SQL'
select id || '|' || status
from public.affiliate_sync_runs
where provider = 'adpick'
  and source_type = 'hotdeal'
  and scheduled_date = date '2099-07-13';
SQL
)"

if [[ "$claim_result" != "$run_id|false|skipped" ]]; then
  echo "claim raced a successful apply: expected '$run_id|false|skipped', got '$claim_result'" >&2
  exit 1
fi

if [[ "$run_state" != "$run_id|succeeded" ]]; then
  echo "successful run was rotated after apply: expected '$run_id|succeeded', got '$run_state'" >&2
  exit 1
fi

old_run_id="$(psql_test -qAt <<SQL
select run_id
from public.claim_affiliate_sync(
  'adpick',
  'hotdeal',
  date '$fence_date',
  timestamptz '$fence_date 00:00:00+00'
);
SQL
)"

psql_test -qAt <<'SQL' >/dev/null
insert into public.affiliate_products (
  provider, source_type, external_key, theme_code, theme_title,
  theme_description, source_rank, product_name, image_url, mall_domain,
  mall_name, mall_icon_url, sale_price, original_price, commission_label,
  affiliate_url, is_active, first_seen_at, last_seen_at, synced_at
) values (
  'adpick', 'hotdeal', 'early-fence', null, 'Theme',
  'Description', 0, 'Early fence', null, null,
  null, null, 1000, 2000, '10%',
  'https://adpick.co.kr/apis/goshopping.php?offer=early-fence&url=x', true,
  timestamptz '2099-07-14 00:00:00+00',
  timestamptz '2099-07-14 00:00:00+00',
  timestamptz '2099-07-14 00:00:00+00'
);
SQL

psql_test -qAt <<SQL >/dev/null
select run_id
from public.claim_affiliate_sync(
  'adpick',
  'hotdeal',
  date '$fence_date',
  timestamptz '$fence_date 00:16:00+00'
);
SQL

product_gate="$work_dir/product-gate"
start_row_lock_holder \
  "affiliate_product_holder" \
  "select id from public.affiliate_products where external_key = 'early-fence' for update;" \
  "$product_gate"

set +e
PGOPTIONS="-c search_path=public -c statement_timeout=1500" \
  PGAPPNAME="affiliate_stale_apply" \
  psql "$database_url" -X -v ON_ERROR_STOP=1 -v old_run_id="$old_run_id" \
  >"$work_dir/stale.out" 2>"$work_dir/stale.err" <<'SQL'
\set VERBOSITY verbose
select public.apply_affiliate_sync(
  :'old_run_id'::uuid,
  timestamptz '2099-07-14 00:17:00+00',
  $json$[{
    "provider":"adpick",
    "sourceType":"hotdeal",
    "externalKey":"early-fence",
    "themeCode":null,
    "themeTitle":"Theme",
    "themeDescription":"Description",
    "sourceRank":0,
    "productName":"Stale mutation",
    "imageUrl":null,
    "mallDomain":null,
    "mallName":null,
    "mallIconUrl":null,
    "salePrice":1000,
    "originalPrice":2000,
    "commissionLabel":"10%",
    "affiliateUrl":"https://adpick.co.kr/apis/goshopping.php?offer=early-fence&url=x",
    "syncedAt":"2099-07-14T00:17:00Z"
  }]$json$::jsonb
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
