#!/bin/bash
# 일일 출처 발견 배치 — YouTube 쿼터 리셋(16:00 KST) 이후 실행 기준.
# launchd(com.memecatch.source-discovery)가 매일 16:10에 호출한다.
# 수동 실행: bash scripts/daily-source-discovery.sh
set -uo pipefail

cd "$(dirname "$0")/.."
mkdir -p output/source-discovery
LOG="output/source-discovery/$(date +%Y-%m-%d).log"

{
  echo "=== $(date '+%F %T') 일일 출처 발견 시작 ==="
  node scripts/discover-youtube-candidates.mjs --max=100
  node scripts/verify-youtube-pending.mjs
  echo "=== $(date '+%F %T') 후보 수집·검증 완료 (pending, 운영자 검수 필요) ==="
} >>"$LOG" 2>&1
