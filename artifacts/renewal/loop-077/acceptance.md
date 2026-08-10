# Loop 077 Acceptance — PLUS-013 Global Scout Deck

## 목표

active Plus 사용자가 매일 검수된 글로벌 밈을 읽고 상세로 바로 이동할 수 있는 발견 덱을 제공한다.
이 덱은 최근 급상승 알림인 Daily Signal과, 문제·완료 기록을 갖는 Global Meme Daily를 대체하지
않고 보완하는 읽기 전용 콘텐츠 표면이다.

## 수용 기준

1. **Plus 경계**
   - active Plus일 때만 `memes`/필요한 `meme_translations` 조회와 Scout ReactNode 생성이 일어난다.
   - free 사용자는 Scout query, RSC payload의 Scout 카드, Scout UI를 받지 않는다.
   - 저장, 감사 로그, RPC, revalidation, AI 호출, 외부 게시, migration은 없다.

2. **locale 계약**
   - 지원 콘텐츠 locale은 `ko`, `en`, `ja`, `zh`, `zh-tw` 5개다.
   - `/premium`은 기존 `dailySignalLocale`을 한 번 해석하고 query, copy, slug, link에 같은 locale을 쓴다.
     UI-only locale은 기존 규칙으로 `en`에 매핑되며 다른 locale fallback은 없다.
   - `ko`는 canonical source를 사용한다. 나머지는 exact locale의 `status=reviewed` row만 사용한다.

3. **콘텐츠 안전·현재성**
   - source는 `moderation_status=approved|limited`, `safety_level=green|yellow`,
     `lifecycle_status=rising|active`만 허용한다.
   - source의 `title`, `summary`, `description`, `origin`은 비어 있지 않아야 한다.
   - 비한국어 translation은 `localized_slug`와 필수 4필드가 모두 있고,
     `source_updated_at`이 source `updated_at`과 같은 시각이어야 한다.
   - missing, machine, stale, incomplete 번역은 후보에서 제외하며 한국어·다른 locale fallback을 하지 않는다.

4. **일일 선발**
   - 날짜는 `Asia/Seoul` KST의 `YYYY-MM-DD`다.
   - 관심사가 있으면 해당 카테고리만, 없으면 글로벌 풀에서 public/safe/current 후보를 trend 내림차순과
     ID 오름차순으로 최대 240개 overfetch한다. 관심사 후보가 5개보다 적어도 비관심사 후보로 채우지 않는다.
   - 최종 순서는 `dateKey + source ID` deterministic rank, trend score, ID 순이다. 같은 날짜와 입력 순서에서는
     결과가 동일하고 날짜가 바뀌면 덱이 회전할 수 있다.
   - 최종 카드는 최대 5개이며 후보가 부족하면 억지 fallback 없이 덜 보여준다.

5. **상태·화면**
   - 조회가 성공했지만 적격 카드가 없으면 `empty`를 표시한다.
   - source 또는 translation 조회가 실패하면 `unavailable`을 표시하며 정상적인 empty와 구분한다.
   - 카드에는 locale-safe 상세 링크, 검수 완료·현재 내용 proof, safety·lifecycle 텍스트/아이콘,
     존재할 때 usage/caution이 보인다.
   - 5개 locale copy와 링크가 일치하고, 접근성 heading/status/data attributes를 유지한다.

## 검증 시나리오

- free query 0회 및 Premium 연결 전용 렌더링
- 5개 locale의 source/translation 경계와 locale-safe 상세 링크
- public/safety/lifecycle/필수 필드 필터
- missing/machine/stale/incomplete/no-slug 무fallback
- input order 독립성, KST `14:59:59Z`/`15:00:00Z` 경계, 날짜 변경 회전, 최대 5개
- source error와 translation error의 unavailable, 적격 후보 없음의 empty
- targeted test, full test, typecheck, lint, build, diff check, signed-out `/premium` HTTP 보호

