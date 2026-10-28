#!/bin/bash
# 일일 출처 복구 계획 — 외부 API 호출·게시 없이 대상 수만 확인한다.
# launchd(com.memecatch.source-discovery)가 매일 16:10에 호출한다.
# 수동 실행: bash scripts/daily-source-discovery.sh
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p output/source-discovery
LOG="output/source-discovery/$(date +%Y-%m-%d).log"

{
  echo "=== $(date '+%F %T') 일일 출처 발견 시작 ==="
  node scripts/discover-youtube-candidates.mjs --plan-only --max=20
  node scripts/verify-youtube-pending.mjs --plan-only --limit=50
  echo "=== $(date '+%F %T') 복구 계획 확인 완료 (외부 API 0회, DB 쓰기 0건) ==="
} >>"$LOG" 2>&1
