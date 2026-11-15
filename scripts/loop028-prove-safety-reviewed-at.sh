#!/usr/bin/env bash
# Local proof that capturing and restoring safety_reviewed_at in the same
# transaction preserves existing values (including 2026-10-26) despite
# memes_touch_safety_reviewed_at. Does not touch prod. Does not alter the trigger.
set -euo pipefail

ROOT=/workspace/memecatch/pg16/root
BIN=$ROOT/usr/lib/postgresql/16/bin
export LD_LIBRARY_PATH=$ROOT/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}
export PGDATA=/tmp/loop028-pg16-data
export PGHOST=/tmp/loop028-pg16-run
export PGPORT=55432
export PGUSER=postgres
LOG=/tmp/loop028-pg16.log
PROOF=/workspace/memecatch/repo/data/memes/reports/20261111-loop028-safety-reviewed-at-proof.md
SQL=/tmp/loop028-safety-proof.sql

rm -rf "$PGDATA" "$PGHOST"
mkdir -p "$PGDATA" "$PGHOST"

cleanup() {
  if [[ -f $PGDATA/postmaster.pid ]]; then
    "$BIN/pg_ctl" -D "$PGDATA" -w stop >/dev/null 2>&1 || true
  fi
  rm -rf "$PGDATA" "$PGHOST"
}
trap cleanup EXIT

"$BIN/initdb" -D "$PGDATA" --auth-local=trust --auth-host=trust --username=postgres --no-instructions >/tmp/loop028-initdb.log 2>&1
"$BIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k $PGHOST --unix_socket_directories=$PGHOST" -l "$LOG" -w start

PSQL=("$BIN/psql" -v ON_ERROR_STOP=1 -d postgres -h "$PGHOST" -p "$PGPORT" -U postgres)

"${PSQL[@]}" << 'SQL'
create schema if not exists public;
create type public.moderation_status as enum ('approved', 'limited', 'pending', 'rejected');

create table public.memes (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,
  slug text not null,
  usage_note text,
  caution text,
  safety_level text default 'green',
  usage_context jsonb default '{}'::jsonb,
  moderation_status public.moderation_status not null default 'approved',
  safety_reviewed_at timestamptz,
  content_reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create function public.touch_meme_safety_reviewed_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.safety_level is distinct from old.safety_level
     or new.usage_context is distinct from old.usage_context
     or new.usage_note is distinct from old.usage_note
     or new.caution is distinct from old.caution then
    new.safety_reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger memes_touch_safety_reviewed_at
before update of safety_level, usage_context, usage_note, caution on public.memes
for each row execute function public.touch_meme_safety_reviewed_at();

insert into public.memes (short_id, slug, usage_note, caution, safety_reviewed_at) values
  ('cdkdz2tv', 'lucky-viki', 'old note 1', 'old caution 1', '2026-10-26T23:25:00.606776+00:00'),
  ('gf66ref6', 'seubuljae', 'old note 2', 'old caution 2', '2026-10-26T23:25:00.606776+00:00'),
  ('ah2zk3m5', 'naman-animyeon-dwae', 'old note 3', 'old caution 3', '2026-10-26T23:25:00.606776+00:00'),
  ('b9gzeysg', 'shrimp-jesus', 'old note 4', 'old caution 4', null),
  ('xazbup6j', 'ai-slop', null, null, null),
  ('controlrow', 'control-no-restore', 'old note', 'old caution', null);
SQL

# Control: without restore, the trigger stamps now(). This row is not in the restore batch.
"${PSQL[@]}" -c "update public.memes set usage_note = 'changed without restore' where short_id = 'controlrow';"
CONTROL=$("${PSQL[@]}" -Atc "select safety_reviewed_at is not null from public.memes where short_id = 'controlrow';")

run_batch() {
  local label=$1
  "${PSQL[@]}" << SQL
begin;
create temporary table loop028_safety_reviewed_backup as
select id, safety_reviewed_at
  from public.memes
 where short_id in ('cdkdz2tv','gf66ref6','ah2zk3m5','b9gzeysg','xazbup6j');

update public.memes set
  usage_note = 'new usage note ($label)',
  caution = 'new caution ($label)',
  content_reviewed_at = '2026-11-11T15:00:00+09:00'::timestamptz,
  updated_at = now()
where short_id in ('cdkdz2tv','gf66ref6','ah2zk3m5','b9gzeysg','xazbup6j')
  and moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status);

update public.memes as meme
   set safety_reviewed_at = backup.safety_reviewed_at
  from loop028_safety_reviewed_backup as backup
 where meme.id = backup.id;

drop table loop028_safety_reviewed_backup;
commit;
SQL
}

run_batch "run1"
BEFORE=$("${PSQL[@]}" -Atc "select short_id || '=' || coalesce(safety_reviewed_at::text, 'NULL') from public.memes order by short_id;")
run_batch "run2"
AFTER=$("${PSQL[@]}" -Atc "select short_id || '=' || coalesce(safety_reviewed_at::text, 'NULL') from public.memes order by short_id;")

FAIL=0
kept=$("${PSQL[@]}" -Atc "select count(*) from public.memes where short_id in ('cdkdz2tv','gf66ref6','ah2zk3m5') and safety_reviewed_at = '2026-10-26T23:25:00.606776+00:00'::timestamptz;")
if [[ "$kept" != "3" ]]; then
  echo "FAIL expected 3 rows to keep the 2026-10-26 instant, got $kept"
  FAIL=1
fi
nulls=$("${PSQL[@]}" -Atc "select count(*) from public.memes where short_id in ('b9gzeysg','xazbup6j') and safety_reviewed_at is null;")
if [[ "$nulls" != "2" ]]; then
  echo "FAIL expected 2 null safety_reviewed_at rows, got $nulls"
  FAIL=1
fi

if [[ "$CONTROL" != "t" ]]; then
  echo "FAIL control row was not stamped when restore was skipped"
  FAIL=1
fi
if [[ "$BEFORE" != "$AFTER" ]]; then
  echo "FAIL run1 and run2 safety_reviewed_at differ"
  echo "run1:"; echo "$BEFORE"
  echo "run2:"; echo "$AFTER"
  FAIL=1
fi

STATUS=PASS
if [[ $FAIL -ne 0 ]]; then STATUS=FAIL; fi

mkdir -p "$(dirname "$PROOF")"
{
  echo "# loop-028 safety_reviewed_at restore proof"
  echo
  echo "- Ran: $(date '+%Y-%m-%d %H:%M:%S %Z') (Asia/Seoul)"
  echo "- Engine: scratch PostgreSQL 16 via /workspace/memecatch/pg16 (local data dir, not prod)."
  echo "- Trigger: copy of public.touch_meme_safety_reviewed_at / memes_touch_safety_reviewed_at. The trigger was not altered."
  echo "- Method: capture safety_reviewed_at into a temp table, UPDATE usage_note/caution (which fires the trigger), then restore the captured values in the same transaction. Repeat once for idempotency."
  echo "- Control: an UPDATE of usage_note without restore set safety_reviewed_at to now() (control=$CONTROL). That shows the trigger is active."
  echo "- Status: $STATUS"
  echo
  echo "## Values after run 1"
  echo '```'
  echo "$BEFORE"
  echo '```'
  echo
  echo "## Values after run 2 (must match run 1)"
  echo '```'
  echo "$AFTER"
  echo '```'
  echo
  echo "Expected: cdkdz2tv, gf66ref6, ah2zk3m5 keep 2026-10-26 23:25:00.606776+00; b9gzeysg and xazbup6j stay NULL."
} > "$PROOF"

echo "STATUS=$STATUS"
echo "PROOF=$PROOF"
echo "CONTROL_TRIGGER_STAMPED=$CONTROL"
echo "RUN1:"
echo "$BEFORE"
echo "RUN2:"
echo "$AFTER"
exit $FAIL
