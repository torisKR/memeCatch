#!/bin/bash
# 일일 출처 발견 배치 — YouTube 쿼터 리셋(16:00 KST) 이후 실행 기준.
# launchd(com.memecatch.source-discovery)가 매일 16:10에 호출한다.
# 수동 실행: bash scripts/daily-source-discovery.sh
set -uo pipefail

cd "$(dirname "$0")/.."
OUTPUT_DIR="${SOURCE_DISCOVERY_OUTPUT_DIR:-output/source-discovery}"
if ! mkdir -p "$OUTPUT_DIR"; then
  echo "source discovery log directory unavailable" >&2
  exit 1
fi
LOG="$OUTPUT_DIR/$(date +%Y-%m-%d).log"
if ! : >>"$LOG"; then
  echo "source discovery log unavailable" >&2
  exit 1
fi
FAILED=0

{
  echo "=== $(date '+%F %T') 일일 출처 발견 시작 ==="
  if node scripts/discover-youtube-candidates.mjs --max=100; then
    echo "=== YouTube 후보 수집 성공 ==="
  else
    CODE=$?
    FAILED=1
    echo "=== YouTube 후보 수집 실패 (exit=$CODE) ==="
  fi

  if node scripts/verify-youtube-pending.mjs; then
    echo "=== YouTube pending 검증 성공 ==="
  else
    CODE=$?
    FAILED=1
    echo "=== YouTube pending 검증 실패 (exit=$CODE) ==="
  fi

  if (( FAILED == 0 )); then
    echo "=== $(date '+%F %T') 후보 수집·검증 완료 (pending, 운영자 검수 필요) ==="
  else
    echo "=== $(date '+%F %T') 후보 수집·검증 실패 ==="
  fi
} >>"$LOG" 2>&1

exit "$FAILED"
