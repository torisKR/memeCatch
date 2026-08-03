# BACKLOG

우선순위 = `(user_impact × max(data_risk, traffic_weight) × confidence) / effort`
각 축은 1~5. 트래픽 가중치는 실측(전 사이트 누적 조회 1,298건, 최다 문서 53회)이
아직 매우 낮아 대부분 2~3으로 보정했다. 근거는 `DATA_QUALITY_REPORT.json`과
`DESIGN_AUDIT.md`.

정렬: 우선순위 내림차순.

---

- [x] ID: DQ-005
  문제: `region_blocked` 대표 콘텐츠가 상세 페이지에서 그대로 렌더된다. `app/(default)/memes/[key]/page.tsx:134`의 `liveContents` 필터가 `availability !== "dead"`만 보고 `region_blocked`는 통과시킨다. 랭킹 게이트(`is_meme_rank_eligible`)와 품질 검사기는 둘 다 `region_blocked`를 제외하므로 화면만 기준이 다르다. 공개 문서 14건이 dead/region_blocked 대표 콘텐츠를 갖고 있다.
  사용자 영향: 3
  데이터/법적 위험: 5
  트래픽 가중치: 1
  해결 확신: 5
  예상 노력: 1
  우선순위 점수: 75.0
  의존성: 없음
  완료 조건: 상세 페이지가 `dead`·`region_blocked` 대표 콘텐츠를 렌더하지 않고 대체 출처 링크로 폴백한다. 필터 기준이 `is_meme_rank_eligible`·`quality-check`와 일치한다.
  검증 명령: `npx vitest run` · `npx next build --webpack`
  상태: done (루프 002)
  결과: 판정을 `lib/content-availability.ts` 하나로 모으고 상세·임베드·충실도 스코어러·품질 검사기가 같은 함수를 쓴다. 프로덕션 `/memes/f384zwnp` 전후 비교 — before: 대표 콘텐츠 섹션에 `<iframe>`, after: 폴백 히어로 + 「출처에서 원본 보기」. 정상 문서(`ra86attn`)는 임베드 유지. canonical·robots 불변.

- [x] ID: DQ-001
  문제: 공개 문서 1,330건(34.1%)에 근거 출처 URL이 하나도 없는데, 상세 페이지는 `description` 또는 `origin`만 있으면 무조건 “밈캐치 검수팀 확인 · 마지막 업데이트 …”를 출력한다(`page.tsx:357`). 근거 없는 문서가 검수 완료를 주장한다. LOOP.md critical flag 1번.
  사용자 영향: 5
  데이터/법적 위험: 5
  트래픽 가중치: 2
  해결 확신: 5
  예상 노력: 2
  우선순위 점수: 62.5
  의존성: 없음
  완료 조건: (a) 출처 0건 문서는 “검수팀 확인”을 주장하지 않는다. (b) 근거 출처 수·마지막 검수 시점·문서 상태가 한 블록에서 함께 보인다. (c) 기존 canonical/metadata 불변.
  검증 명령: `npx vitest run` · `npx next build --webpack`
  상태: done (루프 003)
  결과: `components/trust-note.tsx` 신규 + `lib/source-links.ts`의 `summarizeEvidence()`. 근거 상태를 3단계로 구분한다 — 0건(검수 주장 없음 + 제보 CTA) / 맥락 위키만(원본 미확인 명시) / 원본 있음(근거 수). 근거 수는 `meme_sources`만 세어 재생용 콘텐츠 URL을 근거로 오인하지 않는다(해당 13건). 프로덕션 전후 비교 — `/memes/e8ferq5u` before “밈캐치 검수팀 확인”, after “근거 출처 준비 중”. canonical·robots·JSON-LD 불변.
  남은 것: LOOP.md 신뢰 패널이 요구하는 `출처 역할`·`권리 노출 방식`·`수정 이력`은 각각 `meme_media.source_role`·`copyright_status`·`meme_revisions`에 있는데, 앞의 둘은 데이터가 비어 있고(DQ-007) `meme_revisions`는 운영자 전용 RLS라 공개 화면에서 읽을 수 없다 → DQ-010

- [x] ID: DES-001
  문제: 모바일 390×844 상세 첫 뷰포트에 밈 정보가 하나도 없다. 실측 오프셋 — 대표 임베드 top 301px(높이 662px), 정답 카드 top 1344px, h1 top 1399px, 한 줄 뜻 top 1435px. 첫 화면은 헤더 + 로그인 유도 카드 + Instagram 임베드로 채워진다. LOOP.md 「상세 페이지 정보 계층」과 정반대 순서.
  사용자 영향: 5
  데이터/법적 위험: 2
  트래픽 가중치: 3
  해결 확신: 5
  예상 노력: 2
  우선순위 점수: 37.5
  의존성: 없음
  완료 조건: 모바일 첫 뷰포트(390×844)에 제목·한 줄 뜻·사용 안전 신호·유행 상태가 모두 노출된다(정답 카드 top < 844px). 대표 미디어는 포스터/컴팩트 프리뷰로 내려가고 재생 시 임베드를 로드한다. 데스크톱 2단 레이아웃은 유지한다.
  검증 명령: `npx vitest run` · 390×844 계측 재실행(`artifacts/renewal/loop-001/measure-detail.js`)
  상태: done (루프 004)
  결과: 정답 카드를 2단 그리드 **밖·위**로 올리고, `AuthInvite`를 컴포넌트 문서가 명시한 자리(정답 카드 직후)로 되돌렸다. 390×844에서 정답 카드 top 1344→79px, h1 1399→216px, 안전 신호 bottom 399px로 카드 전체가 첫 뷰포트에 들어온다. 360×800도 동일 통과. 1440×900은 정답 카드가 전체 폭 헤더가 되고 그 아래 2단(미디어|정보)이 그대로 유지된다.

- [x] ID: DES-002
  문제: `/rankings`가 산정 기간·마지막 업데이트 시점·표본 부족 상태를 전혀 표기하지 않는다(본문 정규식 검사 `기간|집계|기준`, `업데이트|갱신`, `표본|데이터 부족|동률` 모두 미검출). 1위 문서의 누적 조회가 53회인데 1·2·3위를 정확한 순위처럼 제시한다. 「오늘의 급상승 / 이번 주 많이 본 / 다시 뜨는」 세 탭의 산식 차이도 설명이 없다.
  사용자 영향: 4
  데이터/법적 위험: 3
  트래픽 가중치: 3
  해결 확신: 5
  예상 노력: 2
  우선순위 점수: 30.0
  의존성: 없음
  완료 조건: 산정 기간과 마지막 갱신 시각이 노출된다. 표본이 임계치 미만이면 정확한 순위 대신 `표본 적음`을 함께 표시한다. 세 탭 각각의 산식을 한 문장으로 설명한다.
  검증 명령: `npx vitest run` · `/rankings` 텍스트 재검사
  상태: done (루프 006)
  결과: `lib/ranking/methods.ts` 신규(산식·기간·표본 임계치 단일 출처) + 탭별 `MethodNote`. 마지막 집계일은 `job_runs`가 운영자 전용 RLS라 공개 읽기가 열린 `meme_trend_metrics`의 최신 date에서 얻는다. 표본 임계치는 1위 문서의 기간 내 조회 30회 — 현재 7일 총 조회 308회/상위20 합계 107회라 순위 1칸이 조회 1~2회이므로 경고가 켜지고, 트래픽이 늘면 자동으로 꺼진다.

- [x] ID: DES-003
  문제: `components/doc-status-note.tsx:50`의 UI 문구에 조사 placeholder가 하드코딩돼 있다 — `「{title}」을(를) 실제로 써 보셨다면`. DB 본문에는 placeholder가 0건(DQ-M3 통과)이지만 템플릿에 남아 있다. 이 배너는 공개 문서의 96.3%에 렌더되므로 사실상 전 사이트 노출이다.
  사용자 영향: 2
  데이터/법적 위험: 1
  트래픽 가중치: 3
  해결 확신: 5
  예상 노력: 1
  우선순위 점수: 30.0
  의존성: 없음
  완료 조건: 제목의 받침에 따라 조사가 선택되거나, 조사가 필요 없는 문형으로 바뀐다.
  검증 명령: `npx vitest run components`
  상태: done (루프 005)
  결과: 조사를 붙이지 않는 문형으로 바꿨다 — 「{title}」, 실제로 써 보셨다면 …. 받침 판정 함수를 새로 만들지 않은 이유는 제목에 「보아 - No.1」·「12-3-30 챌린지」처럼 비한글로 끝나는 것이 섞여 있어 판정이 항상 옳게 나오지 않기 때문이다. `doc-status-note.test.tsx` 신규 3건 — 괄호 대안형 조사 정규식 회귀 가드 포함.

- [ ] ID: DQ-002
  문제: 공개 문서 3,904건 중 3,759건(96.3%)이 `lib/content-depth.ts` 기준 충실도 미달이다. 결과로 (a) 사이트맵·색인 대상이 145건뿐, (b) “아직 정리 중인 문서예요” 배너가 거의 전 문서에 노출, (c) 광고 게재 대상도 145건뿐. 평균 충실도 2.34/13, 평균 고유 산문 173자(하한 250자). 최상위 문서조차 `description`이 127자 수준이라 임계값 조정만으로 해결되지 않는다.
  사용자 영향: 4
  데이터/법적 위험: 4
  트래픽 가중치: 5
  해결 확신: 5
  예상 노력: 4
  우선순위 점수: 25.0
  의존성: `DECISIONS.md` HG-001 (임계값 재조정 vs 콘텐츠 보강 — 편집 정책 결정)
  완료 조건: HG-001 결정 후 확정.
  상태: blocked

- [ ] ID: DES-004
  문제: 쿠팡 제휴 도크(`aside.fixed.bottom-16`)가 상세·랭킹 본문 위를 덮는다. 랭킹 화면에서는 4위 카드가 도크에 가려지고, 상세에서는 대표 임베드 하단을 가린다. LOOP.md 「하단 고정 내비게이션과 콘텐츠가 겹치지 않는가」 위반. 또한 상세 첫 화면의 로그인 유도 카드(높이 약 410px)가 본문보다 먼저 온다.
  사용자 영향: 3
  데이터/법적 위험: 2
  트래픽 가중치: 3
  해결 확신: 5
  예상 노력: 2
  우선순위 점수: 22.5
  의존성: `DECISIONS.md` HG-005 (광고 위치 변경은 HUMAN_GATE)
  완료 조건: HG-005 결정 후 확정.
  상태: blocked

- [ ] ID: DQ-003
  문제: 공개 문서의 84.8%(3,310건)에서 `usage_context`의 4개 상황 값이 전부 동일하다. 그중 3,298건은 4칸 모두 `green`. 화면(`components/safety-rationale.tsx`)은 상황별 판정처럼 보여주지만 데이터는 단일값이다. 나머지 차등 문서 대부분도 `friends=green` + 나머지 3칸 동일이라 기계적 파생으로 보인다.
  사용자 영향: 4
  데이터/법적 위험: 4
  트래픽 가중치: 2
  해결 확신: 5
  예상 노력: 4
  우선순위 점수: 20.0
  의존성: `DECISIONS.md` HG-002 (안전 등급 산식 변경은 HUMAN_GATE)
  완료 조건: HG-002 결정 후 확정.
  상태: blocked

- [x] ID: PERF-001
  문제: LCP/INP/CLS 기준선이 없어 성능 회귀를 판정할 수 없다. 상세 페이지가 첫 화면에 외부 임베드(Instagram/YouTube)를 즉시 로드하므로 DES-001 작업 전후 비교가 특히 필요하다.
  사용자 영향: 3
  데이터/법적 위험: 1
  트래픽 가중치: 3
  해결 확신: 4
  예상 노력: 2
  우선순위 점수: 18.0
  의존성: 없음
  완료 조건: 4개 route의 LCP/INP/CLS 랩 측정값이 `BASELINE.json`에 기록되고 재실행 명령이 문서화된다.
  검증 명령: `artifacts/renewal/loop-009/perf-baseline.md`의 재실행 절차
  상태: done (루프 009, 부분)
  결과: 이미 연결된 Chrome DevTools MCP를 써서 **의존성 추가 없이** 측정했다. `/` LCP 143ms·CLS 0.00, `/rankings` LCP 1062ms·CLS 0.00, 상세 LCP 1131ms·CLS 0.12. DES-001 전후로 상세 CLS가 0.21→0.12로 43% 개선됐다(외부 임베드가 본문을 밀어내던 구조가 사라진 결과). 상세 CLS는 목표 0.1을 여전히 초과 → PERF-002.
  미측정: INP(트레이스에 상호작용 없음), `/explore`, 필드 지표(CrUX 데이터 없음).

- [ ] ID: DQ-007
  문제: 주장 단위 근거 연결 설비가 비어 있다. `meme_claims` 0건, `meme_media.source_role` 6,111건 전부 `usage_example`(= `original`·`earliest_known` 구분 없음), `rights_basis` 2,193건(35.9%)이 `unknown`이며 같은 수가 `review_state=pending`. 공개 화면의 `meme_sources` 기준으로도 292건이 `copyright_status=unknown`. LOOP.md의 「문서 단위가 아닌 주장 단위 출처」가 스키마에만 있고 운영되지 않는다.
  사용자 영향: 4
  데이터/법적 위험: 5
  트래픽 가중치: 2
  해결 확신: 4
  예상 노력: 5
  우선순위 점수: 16.0
  의존성: DQ-001
  완료 조건: 상위 트래픽 문서부터 `origin`·`meaning` claim에 `source_id`를 연결하고, 신뢰 패널이 claim별 근거 수를 표시한다.
  검증 명령: `pnpm quality:check` (claim 미연결 검사 추가 후)
  상태: blocked

- [ ] ID: DQ-004
  문제: 정규화 후 제목이 겹치는 공개 문서 38건(19그룹)과, 다른 공개 문서의 정식 제목을 alias로 보유한 문서 275건(7.0%). 검색·랭킹에 같은 밈이 두 번 노출되고 alias 검색이 서로를 가린다. LOOP.md critical flag 6번.
  사용자 영향: 3
  데이터/법적 위험: 4
  트래픽 가중치: 2
  해결 확신: 4
  예상 노력: 3
  우선순위 점수: 16.0
  의존성: `DECISIONS.md` HG-003 (대량 문서 병합·삭제는 HUMAN_GATE)
  완료 조건: HG-003 결정 후 확정.
  상태: blocked

- [ ] ID: DQ-006
  문제: 공개 문서 3,904건 **전부** 태그가 0개다(`meme_tags_map` 미연결). `tags` 테이블·매핑 테이블·관련 밈 추천 로직(`getRelatedMemes`의 `tagIds`)이 모두 존재하지만 데이터가 비어 있어 관련 밈이 카테고리·연도만으로 뽑힌다. 충실도 점수에서도 태그 1점을 전 문서가 못 받는다.
  사용자 영향: 3
  데이터/법적 위험: 1
  트래픽 가중치: 3
  해결 확신: 5
  예상 노력: 3
  우선순위 점수: 15.0
  의존성: `DECISIONS.md` HG-004 (프로덕션 backfill은 HUMAN_GATE)
  완료 조건: HG-004 결정 후 확정.
  상태: blocked

- [x] ID: DQ-008
  문제: `year_precision`이 공개 문서 3,904건 전부 `unknown`인데, 화면은 `{origin_year}년생 밈`이라고 단정 표기한다(`page.tsx:323`). 근거보다 세밀한 날짜 정밀도 표시 = LOOP.md critical flag 7번. `source_work_year`/`meme_first_seen_year`/`korea_viral_year` 컬럼도 마이그레이션으로 추가만 되고 채워지지 않았다(각 3,904건 null).
  사용자 영향: 2
  데이터/법적 위험: 3
  트래픽 가중치: 2
  해결 확신: 5
  예상 노력: 2
  우선순위 점수: 15.0
  의존성: 없음
  완료 조건: `year_precision`이 `unknown`인 문서는 연도를 단정 표기하지 않고 「추정」으로 나타낸다. 데이터 수정 없이 표시 계층에서만 처리한다.
  검증 명령: `npx vitest run` · `npx next build --webpack`
  상태: done (루프 007)
  결과: `lib/labels.ts`에 `formatOriginYear(year, precision)` 추가 — `exact`·`year`일 때만 단정하고 그 외에는 「(추정)」을 붙인다. 데이터는 건드리지 않았고, 운영자가 정밀도를 올리면 자동으로 단정 표기로 복귀한다. `/memes/ra86attn` before “2004년생 밈” → after “2004년생 밈 (추정)”.
  남은 것: 같은 단정 표기가 `app/[locale]/memes/[key]/page.tsx:351`(4개 로케일 `copy.born`)과 카드·퀴즈·주간 브리핑의 연도 칩에도 있다 → DQ-011

- [x] ID: A11Y-002
  문제: 브랜드 accent 위 흰 글자가 WCAG AA를 통과하지 못한다. 측정 2.82:1(전경 `#ffffff` / 배경 `#ff6b47` / 14px bold), 요구 4.5:1. 로컬·프로덕션 양쪽에서 동일하게 검출됐다(`body.theme-ink > div.fixed > div.relative > button.no-press`). 같은 조합이 다른 CTA에도 쓰이면 영향 범위가 넓다.
  사용자 영향: 4
  데이터/법적 위험: 2
  트래픽 가중치: 4
  해결 확신: 4
  예상 노력: 3
  우선순위 점수: 21.3
  의존성: 없음 — 다만 브랜드 색을 건드리므로 확정 전 확인 필요
  완료 조건: 작은 굵은 글씨용 accent 대비가 4.5:1 이상이 된다. 선택지 — (A) accent를 어둡게, (B) accent 위 글자색을 어둡게, (C) 작은 텍스트 CTA 전용 `--accent-strong` 토큰 추가. 큰 텍스트(18.66px+ bold)는 3:1이라 현재도 통과하므로 전면 교체는 불필요하다.
  검증 명령: `lighthouse_audit {device:"mobile"}` — accessibility 위반 0건
  상태: done (루프 011)
  결과: **브랜드 색을 바꾸지 않았다.** `--accent-strong`(#d63c1b, white 대비 4.64:1)이 `app/globals.css:12`에 이미 정의돼 있었고 주석까지 “흰 글자 CTA 배경용”이라고 적혀 있었다 — 쓰이지 않고 있었을 뿐이다. `bg-accent` + `text-white` + 14px bold 조합 7곳을 `bg-accent-strong`으로 교체했다. Accessibility 97 → **100**, Agentic Browsing 96 → 100.

- [x] ID: A11Y-003
  문제: 접근성 검사가 CI에서 자동으로 돌지 않는다. DevTools MCP는 사람이 붙어 있는 세션 도구라 회귀를 자동으로 막지 못한다. 4개 route 중 1개만 측정된 상태이기도 하다.
  사용자 영향: 2
  데이터/법적 위험: 2
  트래픽 가중치: 2
  해결 확신: 4
  예상 노력: 3
  우선순위 점수: 5.3
  의존성: A11Y-001 (완료)
  완료 조건: 4개 route가 CI에서 자동 검사되고 위반 수가 기준선 대비 악화되면 실패한다.
  검증 명령: `npx vitest run lib/a11y-contrast.test.ts`
  상태: done (루프 014, 범위 조정)
  결과: **axe를 추가하지 않았다.** 루프 011에서 실제로 터진 결함은 “AA 토큰이 이미 있는데 안 쓰였다”였으므로, 브라우저 전면 감사 대신 그 실패 양식을 정확히 막는 의존성 0 가드 2개를 `pnpm test`(=CI)에 넣었다 — (a) `--accent-strong` 모든 선언의 흰 글자 대비 ≥ 4.5:1, (b) 소스에 `bg-accent` + `text-white` 조합 0건. **두 가드가 실제로 실패하는 것을 증명**했다(재도입 시 각각 검출, 원복 시 통과).
  발견: 초기 구현이 CSS 토큰의 마지막 선언만 보관해 다크 값이 라이트의 결함을 가렸다. 선언마다 검사하도록 고쳤다 — 실패 증명을 하지 않았다면 구멍 뚫린 가드를 넣을 뻔했다.
  범위 조정 사유: 4개 route 브라우저 감사는 CI에서 헤드리스 러너가 필요해 비용이 크다. 전면 감사는 DevTools MCP `lighthouse_audit`(루프 010 절차)이 계속 담당한다 → 필요해지면 A11Y-004로 재등록.

- [x] ID: DQ-011
  문제: 루프 007이 한국어 상세의 연도 단정 표기만 고쳤다. 같은 주장이 다른 화면에도 남아 있다 — `app/[locale]/memes/[key]/page.tsx:351`의 `copy.born(origin_year)`(4개 로케일)와 `meme-guess-game.tsx:153`·`weekly-briefing.tsx:74`·`meme-card`/`meme-compact-card`의 연도 칩. 칩은 문장보다 약한 주장이지만 근거가 없기는 마찬가지다.
  사용자 영향: 2
  데이터/법적 위험: 3
  트래픽 가중치: 3
  해결 확신: 5
  예상 노력: 3
  우선순위 점수: 5.0
  의존성: DQ-008 (완료 — `formatOriginYear` 재사용)
  완료 조건: 연도를 노출하는 모든 화면이 `formatOriginYear`(또는 로케일 대응판)를 거친다. 연도 **필터·그룹핑**(timeline·explore·collections)은 정밀도 주장이 아니므로 대상이 아니다.
  검증 명령: `npx vitest run`
  상태: done (루프 013)
  결과: **항목이 과대 산정돼 있었다.** 조사해 보니 `[locale]` 4개 로케일은 이미 헤지돼 있었다 — `Originated around {year}` / `{year}年ごろに登場` / `约在{year}年出现` / `約在{year}年出現`. 실제 단정 표기는 `components/meme-embed.tsx:188`의 「{originYear}년 등장」 하나였고 이를 「{originYear}년 무렵」으로 바꿔 로케일판과 맞췄다. 정밀도를 prop으로 넘기지 않은 이유는 이 칩이 압축 라벨이고 「무렵」은 정밀도가 올라가도 참이기 때문이다.
  의도적 제외: `meme-guess-game.tsx:153`·`weekly-briefing.tsx:74`의 **맨 숫자 칩**(`2016`)은 문장 단위 주장이 아니라 라벨이다. 목록 UI마다 「(추정)」을 붙이면 잡음 대비 정직성 이득이 작다고 판단했다.

- [ ] ID: DQ-010
  문제: 루프 003의 `TrustNote`가 근거 수·원본 유무·마지막 업데이트까지는 말하지만, LOOP.md 「신뢰 패널」이 요구하는 나머지 세 항목은 아직 표시하지 못한다 — (a) 출처 역할(`meme_media.source_role`)은 6,111건 전부 `usage_example`이라 표시할 정보가 없고, (b) 권리 노출 방식(`meme_sources.copyright_status`)은 292건이 `unknown`, (c) 수정 이력(`meme_revisions`)은 운영자 전용 RLS라 공개 화면에서 읽을 수 없다.
  사용자 영향: 3
  데이터/법적 위험: 3
  트래픽 가중치: 2
  해결 확신: 3
  예상 노력: 4
  우선순위 점수: 6.8
  의존성: DQ-007 (source_role·rights_basis 데이터 채우기)
  완료 조건: 신뢰 패널이 권리 노출 방식과 최근 변경 요약을 표시한다. `meme_revisions` 공개 노출은 개인정보(editor_id) 검토가 선행돼야 한다.
  검증 명령: `npx vitest run` · `pnpm quality:check`
  상태: blocked

- [x] ID: DQ-009
  문제: 목록 화면의 PostgREST 필터가 아직 `dead`만 제외한다 — `app/(default)/explore/page.tsx:115`, `components/explore-grid.tsx:68`, `lib/social-platform-counts.server.ts:27`이 모두 `.neq("availability","dead")`를 쓴다. 루프 002에서 렌더 경로(상세·임베드·충실도·검사기)는 `lib/content-availability.ts`로 통일했지만, 이 세 곳은 JS 술어가 아니라 쿼리 필터라 같은 함수를 쓸 수 없어 범위에서 뺐다. 결과로 `region_blocked` 썸네일이 탐색 그리드에는 계속 노출된다(현재 3건).
  사용자 영향: 2
  데이터/법적 위험: 3
  트래픽 가중치: 3
  해결 확신: 4
  예상 노력: 2
  우선순위 점수: 12.0
  의존성: DQ-005 (완료)
  완료 조건: 세 쿼리가 `dead`와 `region_blocked`를 함께 제외하고, 제외 목록이 `UNAVAILABLE_STATUSES` 하나에서 파생된다. 임베디드 리소스 필터 동작이 바뀌지 않는지 탐색 결과 수로 확인한다.
  검증 명령: `npx vitest run` · `/explore` 결과 수 전후 비교
  상태: done (루프 008)
  결과: 세 쿼리가 `UNAVAILABLE_FILTER`(= `UNAVAILABLE_STATUSES`에서 파생)를 써 `not.in.(dead,region_blocked)`로 거른다. 루프 002에서 남겨 둔 렌더 경로↔쿼리 경로 불일치가 닫혔다. `/explore` 24개·`/explore?platform=youtube` 24개로 회귀 없음. 부수로 `withPublicContent`의 제네릭 제약 누락(tsc 검출)과 과도하게 넓던 테스트 단언 1건을 바로잡았다.

- [ ] ID: PERF-002
  문제: 상세 route의 CLS가 0.12로 목표 0.1을 초과한다(루프 009 측정). DES-001로 0.21에서 크게 내려왔지만 아직 남아 있다. DevTools의 CLSCulprits 인사이트가 원인 분석 진입점이다.
  사용자 영향: 3
  데이터/법적 위험: 1
  트래픽 가중치: 3
  해결 확신: 4
  예상 노력: 3
  우선순위 점수: 12.0
  의존성: PERF-001 (완료) · **`DECISIONS.md` HG-005** — 루프 012에서 원인이 광고 도크로 밝혀져 게이트에 종속됨
  완료 조건: HG-005 결정 후 확정. 도크 배치를 어떻게 정하든 **광고 컨테이너에 크기를 예약**해야 CLS가 잡힌다(서드파티 스크립트가 삽입하는 이미지라 컨테이너 `min-height` 고정이 현실적).
  검증 명령: `artifacts/renewal/loop-009/perf-baseline.md`의 재실행 절차 — 단, **콜드 캐시 기준 최악값**으로 여러 회 측정할 것
  상태: blocked
  루프 012 조사 결과: DevTools `CLSCulprits`가 지목한 유일한 원인은 크기 미지정 쿠팡 광고 이미지(`img1a.coupangcdn.com/.../ajax-loader.gif`)다. `DES-004`와 원인이 같다. 또한 CLS가 실행마다 달랐다 — 콜드 0.12 / 웜 0.00. 루프 009의 0.12는 콜드 측정값이며 단일 측정값으로 다루면 안 된다.

- [x] ID: A11Y-001
  문제: 접근성 자동 검사 도구가 없어 WCAG 2.2 AA 회귀를 확인할 수 없다. LOOP.md STEP 6의 `accessibility check`가 매 루프 `not_run`으로 남는다.
  사용자 영향: 3
  데이터/법적 위험: 2
  트래픽 가중치: 2
  해결 확신: 4
  예상 노력: 2
  우선순위 점수: 12.0
  의존성: 없음
  완료 조건: 핵심 4개 route(`/`, `/explore`, `/rankings`, `/memes/[key]`)에 대해 CI에서 돌아가는 자동 접근성 검사가 있고 위반 수가 기준선으로 기록된다.
  검증 명령: `artifacts/renewal/loop-010/a11y-baseline.md`의 재실행 절차
  상태: done (루프 010, 부분)
  결과: 의존성 추가 없이 Chrome DevTools MCP `lighthouse_audit`으로 측정. 상세 route Accessibility **97**(로컬·프로덕션 동일), 위반 1건 = `color-contrast` → A11Y-002. 프로덕션을 함께 측정해 로컬에서만 나온 CSP 콘솔 오류 6건이 계측 아티팩트임을 확인했다(프로덕션 0건) — 없는 버그를 보고할 뻔했다.
  잔여: 4개 route 중 1개만 측정했고, CI 자동 실행은 되지 않는다(DevTools MCP는 세션 도구). CI 게이트가 필요하면 별도 러너 도입 필요 → A11Y-003.

---

- [ ] ID: ANL-001
  문제: LOOP.md 「분석 이벤트」 13종 중 4종만 구현돼 있다(`search_submit`·`search_no_result`·`search_result_click`·`share_click`). 특히 **`meme_source_opened`와 `correction_report_started`가 없어**, 루프 003(근거 표시 정직화 + 제보 CTA)과 루프 006(표본 경고)이 참여를 해쳤는지 도왔는지 검증할 수 없다. LOOP.md 핵심 지표의 「상세 → 출처 확인」·「상세 → 정정 제보」가 정확히 비어 있다.
  사용자 영향: 3
  데이터/법적 위험: 4
  트래픽 가중치: 3
  해결 확신: 5
  예상 노력: 2
  우선순위 점수: 30.0
  의존성: `DECISIONS.md` **HG-006** (이벤트 추가 = 사용자 데이터 수집 범위 확대 → HUMAN_GATE)
  완료 조건: HG-006 결정 후 확정.
  상태: blocked

- [ ] ID: ANL-002
  문제: 기존 `search_submit(query)`·`search_no_result(query)`가 **원문 검색어를 그대로 GA4로 보낸다.** LOOP.md는 「원문 검색어를 무조건 저장하지 말고 개인정보 가능성을 검토한다」고 명시한다. 사용자가 검색창에 이름·연락처를 입력하는 경우가 있어 새 이벤트를 늘리는 것보다 이쪽이 개인정보 노출이 크다. 루프 015에서 발견했다.
  사용자 영향: 2
  데이터/법적 위험: 5
  트래픽 가중치: 3
  해결 확신: 4
  예상 노력: 2
  우선순위 점수: 20.0
  의존성: `DECISIONS.md` HG-006 (같은 결정에서 함께 다룸)
  완료 조건: HG-006 결정 후 확정. 선택지 — 길이 제한, 해시, 상위 N개 화이트리스트.
  상태: blocked

- [ ] ID: SEO-001
  문제: 존재하지 않는 밈 URL이 **200 + not-found UI**(soft-404)로 응답하고 ISR 캐시에 200으로 저장된다(`x-nextjs-prerender: 1`, `s-maxage=600`). 프로덕션도 동일. `generateMetadata`에 `notFound()`를 추가해도 재현 — Next 16 ISR/스트리밍 경로에서 상태 코드가 먼저 확정되는 것으로 보인다. 검색엔진이 soft-404를 저품질 신호로 읽고, 삭제·비공개된 밈 URL이 색인에 200으로 남을 수 있다. 루프 018의 smoke 스크립트가 첫 실행에서 검출했다.
  사용자 영향: 2
  데이터/법적 위험: 3
  트래픽 가중치: 3
  해결 확신: 3
  예상 노력: 3
  우선순위 점수: 6.0
  의존성: `DECISIONS.md` HG-007 — 루프 019 조사 결과, 가능한 해결책 4안이 전부 성능·검증 비용 트레이드오프를 가진다
  완료 조건: HG-007 결정 후 확정. 존재하지 않는 `/memes/*`가 404로 응답하면 `smoke.mts`의 `knownIssue` 플래그를 제거해 정식 게이트로 승격한다.
  검증 명령: `pnpm smoke`
  상태: blocked
  루프 019 조사: 라우터 수준 404는 정상(`/qqqq` → 404). ISR 세그먼트 내 notFound()만 200이 된다 — `experimental.globalNotFound` + ISR 조합, Next 16.2.10. 상세는 `artifacts/renewal/loop-019/seo-001-investigation.md`.

- [x] ID: HOME-001
  문제: 홈이 §5 「예시 검색어 제공」을 충족하지 않았다 — placeholder만 있고 처음 온 사용자가 무엇을 검색하는 곳인지 입력 없이 파악할 수단이 없었다. 루프 020 감사에서 발견.
  사용자 영향: 3 / 데이터/법적 위험: 1 / 트래픽 가중치: 3 / 해결 확신: 5 / 예상 노력: 1
  우선순위 점수: 45.0
  상태: done (루프 021)
  결과: 검색 폼 아래 고정 예시 3종(최신 챌린지·일상 유행어·추억 밈 각 1) 링크 칩. 실시간 인기어가 아닌 고정 예시를 쓴 이유 — 트래픽이 표본 부족이고(랭킹 경고와 같은 근거), 고정 예시는 수집 이슈가 없어 HG-006과 무관하다. 첫 후보 「가스라이팅」이 zero-result로 확인돼 실제 문서가 있는 검색어로 교체·검증했다.

- [x] ID: SRCH-001
  문제: zero-result 화면에 §6이 요구하는 「오타 후보」 제안이 없다.
  상태: **rejected (루프 022)** — 구현 후 실측으로 가설 기각, 변경 되돌림(LOOP.md STEP 7)
  근거: `search_memes` RPC의 ilike+trgm+초성+별칭 조합이 이미 오타·자연어 질의를 흡수한다. 실측 — 「잘자 내꿈꾸」「브금테」「브금 zzweird」「잘자 내꿈꿔 뜻이 뭐야」 전부 결과 반환. zero-result는 유사한 것이 전혀 없을 때만 발생하며, 그때는 완화 질의도 후보를 찾지 못한다(「zzqqxx」 → 제안 0건 실증). 오타 후보 섹션은 사실상 발동 불가한 죽은 코드가 되므로 되돌렸다.

---

## 기각된 항목

- **`을(를)` 조사 placeholder가 DB 본문에 남아 있다** (LOOP.md 초기 가설 4)
  → **데이터에서는 기각.** 공개 문서 3,904건 중 `DQ-M3-placeholder-text` 검출 0건.
  단 UI 템플릿에는 남아 있어 `DES-003`으로 범위를 좁혀 유지한다.
