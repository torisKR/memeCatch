#!/bin/bash
# 올바른 service_role 키가 .env에 들어오면 실행: bash scripts/seed-remote.sh
set -eu
URL="https://onjipuldngbdptldkpoe.supabase.co"
KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' ~/projects/memecatch/.env | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
[ -z "$KEY" ] && { echo "키 없음"; exit 1; }
export MEMECATCH_SEED_URL="$URL"
export MEMECATCH_SEED_KEY="$KEY"
CODE=$(python3 - <<'PY'
import os,urllib.error,urllib.request
url=os.environ["MEMECATCH_SEED_URL"]
key=os.environ["MEMECATCH_SEED_KEY"]
req=urllib.request.Request(url+"/rest/v1/memes?select=id&limit=1",
    headers={"apikey":key,"Authorization":"Bearer "+key})
try:
    print(urllib.request.urlopen(req).status)
except urllib.error.HTTPError as error:
    print(error.code)
PY
)
[ "$CODE" != "200" ] && { echo "키가 원격에 $CODE 반환 — memeCatch 프로젝트 service_role 키인지 확인"; exit 1; }
echo "키 인증 OK, REST bulk 삽입 시작..."
# raw JSONL → PostgREST JSON 배열 → bulk POST (service_role, RLS 우회)
ROWS_FILE=$(mktemp "${TMPDIR:-/tmp}/mc-rows.XXXXXX")
trap 'rm -f "$ROWS_FILE"' EXIT
node scripts/jsonl-to-postgrest.mjs data/memes/raw "$ROWS_FILE"
export MEMECATCH_SEED_ROWS="$ROWS_FILE"
TOTAL=$(python3 -c 'import json,os;print(len(json.load(open(os.environ["MEMECATCH_SEED_ROWS"]))))')
echo "총 $TOTAL 행, 200건씩 배치 POST"
python3 - <<'PY'
import json,os,urllib.error,urllib.request
url=os.environ["MEMECATCH_SEED_URL"]
key=os.environ["MEMECATCH_SEED_KEY"]
rows=json.load(open(os.environ["MEMECATCH_SEED_ROWS"]))
ins=0
for i in range(0,len(rows),200):
    b=rows[i:i+200]
    req=urllib.request.Request(url+"/rest/v1/memes?on_conflict=slug",
        data=json.dumps(b).encode(),method="POST",
        headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"})
    try:
        urllib.request.urlopen(req); ins+=len(b); print(f"  {ins}/{len(rows)}")
    except urllib.error.HTTPError as e:
        print("  배치 실패:",e.code,e.read()[:200])
print("완료:",ins)
PY
