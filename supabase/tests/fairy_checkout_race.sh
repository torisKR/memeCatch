#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
migration="supabase/migrations/20260908010000_bound_fairy_intents.sql"
revision="${1:-WORKTREE}"
admin_url="${TEST_ADMIN_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

[[ "$admin_url" != *\?* ]] || { echo "database URL query parameters are forbidden" >&2; exit 1; }
url_pattern='^postgres(ql)?://([^/@]+@)?(127\.0\.0\.1|localhost|\[::1\])(:[0-9]+)?/postgres$'
[[ "$admin_url" =~ $url_pattern ]] || { echo "TEST_ADMIN_DATABASE_URL must target loopback database postgres" >&2; exit 1; }

db="fairy_race_test_$$_$RANDOM"
db_url="${admin_url%/*}/$db"
work="$(mktemp -d)"
webhook_pid=""
checkout_pid=""
parallel_pids=()

cleanup() {
  for pid in "${parallel_pids[@]}" "$checkout_pid" "$webhook_pid"; do
    [[ -z "$pid" ]] || { kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }
  done
  psql "$admin_url" -X -qAt -v ON_ERROR_STOP=1 -c "drop database if exists $db with (force)" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

psql "$admin_url" -X -qAt -v ON_ERROR_STOP=1 -c "create database $db template template0"

psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 <<'SQL'
create table public.profiles (id uuid primary key);
create table public.billing_subscriptions (
  provider text constraint billing_subscriptions_provider_check
    check (provider in ('latpeed', 'unifi'))
);
SQL
psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 -f "$root/supabase/migrations/20260906054257_fairy_plus.sql"
if [[ "$revision" == "WORKTREE" ]]; then
  psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 -f "$root/$migration"
else
  git -C "$root" show "$revision:$migration" | psql "$db_url" -X -qAt -v ON_ERROR_STOP=1
fi

user_id="00000000-0000-0000-0000-000000000032"
psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 -v user_id="$user_id" <<'SQL'
insert into public.profiles (id) values (:'user_id'::uuid);
SQL
intent_id="$(psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 -v user_id="$user_id" <<'SQL'
select public.create_fairy_billing_intent(:'user_id'::uuid, 'memecatch', 15000);
SQL
)"

gate="$work/webhook-gate"
mkfifo "$gate"
(
  {
    printf 'begin;\n'
    printf "select public.process_fairy_payment('race-payment', 'memecatch', '%s'::uuid, 1, now());\n" "$intent_id"
    cat "$gate"
    printf 'commit;\n'
  } | PGAPPNAME="fairy_webhook_$db" psql "$db_url" -X -qAt -v ON_ERROR_STOP=1
) >"$work/webhook.out" 2>"$work/webhook.err" &
webhook_pid=$!

webhook_ready=false
for _ in {1..100}; do
  state="$(psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 <<SQL
select state from pg_stat_activity where application_name = 'fairy_webhook_$db';
SQL
)"
  if [[ "$state" == "idle in transaction" ]] && grep -q '"status": "ignored"' "$work/webhook.out"; then
    webhook_ready=true
    break
  fi
  sleep 0.05
done
[[ "$webhook_ready" == "true" ]] || { echo "webhook payment did not reach gate" >&2; exit 1; }

(
  PGAPPNAME="fairy_checkout_$db" psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 -v user_id="$user_id" <<'SQL'
select public.create_fairy_billing_intent(:'user_id'::uuid, 'memecatch', 15000);
SQL
) >"$work/checkout.out" 2>"$work/checkout.err" &
checkout_pid=$!

for _ in {1..100}; do
  checkout_state="$(psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 <<SQL
select case when wait_event_type = 'Lock' then 'waiting' else state end
from pg_stat_activity where application_name = 'fairy_checkout_$db';
SQL
)"
  [[ "$checkout_state" == "waiting" ]] && break
  kill -0 "$checkout_pid" 2>/dev/null || break
  sleep 0.05
done
[[ "$checkout_state" == "waiting" || -s "$work/checkout.out" ]] || {
  echo "checkout neither waited on the intent lock nor completed" >&2
  exit 1
}

: >"$gate"
wait "$webhook_pid"
webhook_pid=""
wait "$checkout_pid"
checkout_pid=""

checkout_id="$(tr -d '[:space:]' <"$work/checkout.out")"
outstanding="$(psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 -v checkout_id="$checkout_id" <<'SQL'
select count(*) from public.fairy_billing_intents intents
where intents.id = :'checkout_id'::uuid
  and not exists (select 1 from public.fairy_payments payments where payments.intent_id = intents.id);
SQL
)"
[[ "$checkout_id" != "$intent_id" && "$outstanding" == "1" ]] || {
  echo "checkout returned consumed intent: initial=$intent_id returned=$checkout_id outstanding=$outstanding" >&2
  exit 1
}

for round in 1 2 3; do
  parallel_pids=()
  for worker in {1..8}; do
    psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 \
      -c "select public.create_fairy_billing_intent('$user_id'::uuid, 'memecatch', 15000)" \
      >"$work/parallel-$round-$worker.out" &
    parallel_pids+=("$!")
  done
  for pid in "${parallel_pids[@]}"; do
    wait "$pid"
  done
  parallel_pids=()
  unique="$(cat "$work"/parallel-"$round"-*.out | tr -d '[:space:]' | fold -w 36 | sort -u | wc -l | tr -d ' ')"
  [[ "$unique" == "1" ]] || { echo "parallel checkout round $round returned $unique intents" >&2; exit 1; }
done

live_count="$(psql "$db_url" -X -qAt -v ON_ERROR_STOP=1 -v user_id="$user_id" <<'SQL'
select count(*) from public.fairy_billing_intents intents
where intents.user_id = :'user_id'::uuid
  and not exists (select 1 from public.fairy_payments payments where payments.intent_id = intents.id);
SQL
)"
[[ "$live_count" == "1" ]] || { echo "expected one outstanding intent, found $live_count" >&2; exit 1; }

echo "fairy checkout/webhook concurrency regression: ok ($revision)"
