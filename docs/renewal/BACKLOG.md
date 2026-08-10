# BACKLOG

우선순위 = `(user_impact × max(data_risk, traffic_weight) × confidence) / effort`
각 축은 1~~5. 트래픽 가중치는 실측(전 사이트 누적 조회 1,298건, 최다 문서 53회)이
아직 매우 낮아 대부분 2~~3으로 보정했다. 근거는 `DATA_QUALITY_REPORT.json`과
`DESIGN_AUDIT.md`.

정렬: 우선순위 내림차순.

---

- [x] ID: BR-001
      문제: LOOP 완료 커밋과 worktree/브랜치 변경이 main 및 production에 모두 반영됐는지 한 번에 확인할 증적이 없었다.
      사용자 영향: 3
      데이터/법적 위험: 2
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 22.5
      의존성: 없음
      완료 조건: 모든 브랜치의 조상 관계·dirty worktree·production 배포를 대조하고, 안전한 미커밋 SEO/GEO 변경만 main에 이식한다.
      검증 명령: `git branch -a -vv` · `git worktree list` · `pnpm exec vitest run` · `pnpm exec tsc --noEmit`
      상태: done (루프 051)
      결과: 완료 루프는 main 조상으로 확인했고, 오래된 스냅샷·생성물은 제외했다. reviewed en이 있는 문서의 x-default만 영어로 연결하는 변경을 main에 이식했다.

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

- [x] ID: DQ-013
      문제: `summarizeEvidence()`가 URL만 세어, title·creator가 둘 다 null인 맨 링크(출처 행의 62.4% — 2,876/4,608)가 `primary`로 집계되고 상세가 「● 근거 출처 N개 확인 (원본·보도 N개)」를 출력했다. 근거 1건 문서가 확인 불가한 URL로 「원본 확인」을 주장하는 셈 — 루프 003의 다음 층 과대 주장. 루프 023 표본에서 14/50(top_traffic 8/15).
      사용자 영향: 4 / 데이터/법적 위험: 4 / 트래픽 가중치: 3 / 해결 확신: 5 / 예상 노력: 2
      우선순위 점수: 40.0
      상태: done (루프 025)
      결과: `EvidenceSummary`에 `identifiedPrimary`(제목 또는 작성자가 있는 primary) 추가, `TrustNote`에 4번째 단계 신설 — 맨 URL뿐이면 「▲ 출처 링크 N개 수집 — 서지 확인 중」. citableSources의 기존 원칙(제목 없는 출처는 근거가 아니다)과 정합. 프로덕션 실측: `uefmryky` before 「● 근거 출처 1개 확인 (원본·보도 1개)」 → after 「▲ 출처 링크 1개 수집」. 서지 있는 문서(`z4ywt995`)는 불변.

- [ ] ID: DQ-012
      문제: `usage_context.friends`가 사실상 상수다 — approved 3,903건 중 99.0%가 green, **red 103건 중 84건(81.6%)도 friends=green**. caution이 "가볍게 쓰면 안 됨"인 문서(`2frja29t`)조차 친구 칸은 「써도 됨」을 표시한다. 위험 등급과 역상관조차 없어 정보량이 0에 가깝다. (루프 023 전수 확인)
      사용자 영향: 5 / 데이터/법적 위험: 5 / 트래픽 가중치: 3 / 해결 확신: 4 / 예상 노력: 2
      우선순위 점수: 50.0
      의존성: `DECISIONS.md` HG-003 (전제 갱신됨 — friends 칸은 「미확인」 표시가 아니라 렌더 중단이 후보)
      상태: blocked

- [ ] ID: DQ-014b
      문제: `media_type` 축이 어떤 저장 자산과도 대응되지 않는다 — `meme_contents` 전수 100%가 `type='embed'`(이미지 행 0건)인데 approved 1,364건(34.9%)이 `media_type='image'` 선언. (루프 023 전수 확인. 기존 DQ-014(copyright 도메인 갈림)와 별건)
      사용자 영향: 3 / 데이터/법적 위험: 2 / 트래픽 가중치: 3 / 해결 확신: 4 / 예상 노력: 3
      우선순위 점수: 12.0
      의존성: 조사 후 재정의 또는 폐기 판단 — 축 폐기는 편집 정책 변경이라 게이트 후보
      상태: blocked

- [ ] ID: DQ-015b
      문제: `category='comment'`가 분류 실패의 catch-all이다 — approved 732건. 루프 023 표본의 category 오류 22건 다수가 comment였고, 실제로는 영화 대사·오디션 사건·사회현상·방송 코너였다.
      사용자 영향: 3 / 데이터/법적 위험: 2 / 트래픽 가중치: 3 / 해결 확신: 4 / 예상 노력: 4
      우선순위 점수: 9.0
      의존성: 대량 재분류 = 프로덕션 backfill → HG-004 계열
      상태: blocked

- [x] ID: DQ-016b
      문제: `recent` 등록 파이프라인이 출처 요구 없이 「밈 아닌 항목」을 통과시킨다.
      상태: done (루프 034 — 근본 원인 특정·차단)
      결과: **`scripts/jsonl-to-postgrest.mjs:43`이 `moderation_status:"approved"`를 하드코딩** — 대량 수입이 검수 파이프라인을 통째로 우회해 approved 직행. 기본값을 `pending`으로 교체(`IMPORT_APPROVED=1` 명시 시에만 기존 동작). **부수 발견: 같은 파일 `friends:"green"` 하드코딩이 friends 상수 결함(전수 99% green, red 84건 포함)의 근원** — 다른 칸과 동일 보수값으로 교체. 이미 들어간 문서의 정리는 HG-008(밈 아님 방침) 결정 후.

- [x] ID: LOC-002
      문제(원 framing): "[locale] 검수 배지가 무조건 노출 — ko의 DQ-001 허위 주장이 로케일에 잔존".
      상태: **rejected-as-framed (루프 033)** — 증거 재검토로 전제 기각
      근거: 배지 조건 `!needsReview`는 구조적으로 항상 참이 맞지만, 그 이유가 데이터 계층(`lib/meme-translations.ts:232`)이 `translation.status==='reviewed' && isCurrent`인 행만 페이지에 도달시키기 때문이다. 즉 렌더되는 모든 페이지에서 "사람이 확인한 번역" 주장은 **참**이다 — DQ-001(근거 없는 검수 주장)과 달리 허위가 아니다. 도달 불가한 machine/stale 배너·noindex 분기는 이중 방어(데이터 계층이 바뀌면 렌더 계층이 받치는 구조)로 해석 가능해 삭제하지 않는다(절대규칙 12 — 미변경 영역 임의 정리 금지).
      잔여 분리: TrustNote 동등물(근거 수 표시)의 로케일 이식은 실제 기능 격차 → **LOC-006**으로 재등록, 번역 공개(현재 0건) 전제라 blocked.

- [ ] ID: LOC-006
      문제: [locale] 상세에 ko의 TrustNote 동등물(근거 출처 수·서지 확인 단계 표시)이 없다 — 기능 격차(허위 주장 아님). 출처 0건이면 섹션 침묵.
      사용자 영향: 2 / 데이터/법적 위험: 2 / 트래픽 가중치: 1 / 해결 확신: 4 / 예상 노력: 3
      우선순위 점수: 5.3
      의존성: meme_translations 공개(현재 0건 — 노출 0)
      상태: blocked

- [x] ID: GLO-001
      문제: Plus 가격 페이지는 쿠키로만 UI 언어를 바꾸고, `/en/pricing` 등 실제 정적 전환 URL·
      locale metadata·sitemap이 없었다. 글로벌 사용자가 가격 페이지에서 언어를 바꾸면 홈으로
      이탈하며, 공유/검색 결과도 한국어 canonical·OG를 유지했다.
      사용자 영향: 4
      데이터/법적 위험: 1
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 40.0
      의존성: SEO locale route와 `PREMIUM_COPY` 재사용; 결제 정책/DB 변경 없음
      완료 조건: `/pricing`와 en/ja/zh/zh-tw의 실제 가격 route가 canonical·hreflang·sitemap으로
      상호 연결되고, selector/Plus CTA가 존재하는 locale URL만 생성한다.
      검증 명령: `pnpm test` · `pnpm lint` · `npx tsc --noEmit` · `pnpm build` · `git diff --check`
      상태: done (루프 053 — 86 files / 686 tests; 배포는 수행하지 않음)
      결과: `localizedStaticPath()`를 `/`·`/pricing`에만 제한하고 static localized pricing page,
      shared metadata, sitemap 5 URL, locale-preserving selector/CTA를 추가했다. 실제 결제·가격·
      production write는 변경하지 않았다.

- [x] ID: GLO-002
      문제: 잠긴 고급 export 옵션의 Plus CTA가 `/premium`으로 고정돼, 글로벌 사용자가 실제
      locale 가격/checkout 설명 페이지를 건너뛰고 공용 대시보드로 이동했다. close control도
      고정 한국어 accessible name을 사용했다.
      사용자 영향: 4
      데이터/법적 위험: 1
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 30.0
      의존성: 루프 053 `localizedStaticPath()`와 실제 localized `/pricing` static routes; 결제/DB 변경 없음
      완료 조건: locked export CTA가 active locale의 실제 pricing route만 생성하며 UI-only locale은
      unprefixed `/pricing`을 유지한다. 닫기 control의 accessible name도 locale copy를 쓴다.
      검증 명령: `pnpm test` · `pnpm lint` · `npx tsc --noEmit` · `pnpm build` · `git diff --check`
      상태: done (루프 055 — 90 files / 695 tests; 배포는 수행하지 않음)
      결과: `exportUpgradeHref()`가 `localizedStaticPath("/pricing", locale)` 하나를 통해 ko/en/ja/zh/zh-tw의
      public conversion path를 고정했다. export enforcement/checkout/data/migration은 그대로다.

- [x] ID: GLO-003
      문제: Plus trend-alert bell의 “관심 카테고리 설정” 링크가 존재하지 않는 `/my/interests`로 향한다.
      글로벌 사용자가 도달해야 할 onboarding도 nickname·관심사·연령 안내와 submit/skip 상태를 고정 한국어로 보여,
      개인화와 알림의 출발 경로가 언어 문맥과 route 양쪽에서 끊긴다.
      사용자 영향: 4
      데이터/법적 위험: 1
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 26.7
      의존성: existing `/onboarding`, `completeOnboarding`, UI locale copy; profile data/schema/analytics 변경 없음
      완료 조건: alert bell은 로그인된 사용자의 실제 onboarding path로 이동하고, onboarding의 heading·field·선택·skip·pending
      상태가 모든 UI locale에서 렌더된다. action validation의 기존 보수적 server boundary와 redirect semantics는 유지한다.
      검증 명령: targeted UI/action tests · `pnpm test` · `pnpm lint` · `npx tsc --noEmit` · `pnpm build` · `git diff --check`
      상태: done (루프 058 — actual onboarding recovery link, form + metadata locale copy, production write 없음)
      결과: `TREND_ALERTS_INTERESTS_HREF`가 `/onboarding?next=/premium`을 단일화했다. OnboardingForm은
      MY copy의 category/age/copy fallback으로 렌더하며, browser metadata도 request locale을 사용한다.

- [x] ID: GLO-004
      문제: `/submit`의 page/error/loading, `SubmitForm`, TikTok import state와 server validation response가
      fixed Korean copy를 출력한다. 글로벌 사용자는 제보 직전 input 오류와 import 실패를 이해하지 못한다.
      사용자 영향: 4
      데이터/법적 위험: 2
      트래픽 가중치: 3
      해결 확신: 4
      예상 노력: 4
      우선순위 점수: 12.0
      의존성: existing submission action/schema/RPC/oEmbed policy and UI locale copy; production writes remain user-triggered only
      완료 조건: submit UI와 validation/error/async states가 all UI locales에서 일관되며, source URL/attachment/TikTok error의
      existing security validation and status semantics remain unchanged.
      검증 명령: targeted submit/action/i18n tests · `pnpm test` · `pnpm lint` · `npx tsc --noEmit` · `pnpm build` · `git diff --check`
      상태: done (루프 059 — 96 files / 728 tests; production write/deploy 없음)
      결과: `SUBMIT_COPY`가 page/form/preview/error/TikTok state와 metadata를 locale fallback으로
      단일화했다. action은 trusted request locale만 읽어 Zod/oEmbed/auth/attachment/RPC 경계를 유지하고,
      success badge도 caller-provided locale label만 재정의한다.

- [x] ID: SUB-002
      문제: Plus의 무제한 저장·folder/note가 존재해도 `/my`는 최근 저장순 50개씩만 보여 줘
      저장 수가 늘면 원하는 밈을 찾거나 안전한 재사용 후보를 고를 방법이 없었다. folder/note
      editor의 고정 한국어 문구도 글로벌 사용 경험을 끊었다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 25.0
      의존성: existing `saved_memes` RLS, `memes` title/summary/safety_level, Plus entitlement 및
      기존 folder/note RPC. schema·data write 없음.
      완료 조건: active Plus만 owner-scoped 저장 라이브러리를 title/summary·사용 신호로 필터하고,
      free URL 조작은 서버에서 무시한다. 결과 수·page·clear가 필터를 보존하며, Vault와
      folder/note editor가 모든 UI locale에서 localized pricing CTA를 쓴다.
      검증 명령: `pnpm test` · `pnpm lint` · `npx tsc --noEmit` · `pnpm build` · `git diff --check`
      상태: done (루프 054 — 89 files / 694 tests; production data/migration/deploy 미수행)
      결과: `lib/saved-library.ts`가 sanitization·entitlement·page URL을 단일화했고, `/my`는
      `memes!inner` referenced-table search/safety query와 filtered head count를 쓴다. `MY_COPY`
      및 SavedMetaEditor도 현지화했다.

- [ ] ID: SUB-001
      문제: Plus는 개인화 피드·무제한 저장·상세 추이·카테고리 급상승 알림을 각각 제공하지만,
      사용자가 직접 저장한 밈이 급상승해도 이를 발견하게 하는 흐름이 없다. 저장 기능의
      재방문 가치와 Plus의 차별성이 대시보드·알림함에서 연결되지 않는다.
      사용자 영향: 5
      데이터/법적 위험: 1
      트래픽 가중치: 3
      해결 확신: 4
      예상 노력: 3
      우선순위 점수: 20.0
      의존성: existing `saved_memes` · `trend_alerts` · `has_active_plus()` · 일일 trend pulse.
      production schema migration 적용 및 cron 결과 검증은 운영 권한 필요.
      완료 조건: active Plus 사용자의 own saved meme만 `saved_rising` 후보가 되고, 관심사
      일반 알림과 중복되지 않는다. 관심사 미설정 Plus도 대상이며, 사용자당 15개·30일 보존·
      unique 제약을 지킨다. UI는 현재 locale로 saved/category 신호를 구분하고 private saved
      metadata를 노출하지 않는다.
      검증 명령: `pnpm test` · `npx tsc --noEmit` · `pnpm lint` · `pnpm build` ·
      `supabase db lint --local`(Docker 가능 시) · 적용 뒤 service-role cron/RLS 확인
      상태: code_complete (루프 062 — 코드·source contract·local HTTP QA 완료, production migration 미적용)
      결과: `20260808113000_plus_saved_meme_rising_alerts.sql`이 security-definer fanout을
      확장했다. `/api/trend-alerts`는 signed-out/non-Plus를 잠그고, `/premium`과 global alert UI는
      own scope·PremiumCopy locale을 사용한다. route·bell·migration contract와 local HTTP QA를 통과했지만,
      local DB daemon 부재로 실제 SQL/RLS/cron 실행과 production 적용은 배포 전 운영 검증으로 남음.

- [ ] ID: LOC-007
      문제: 루프 049의 후속 다국어 배치가 380개 문서 × 4개 로케일을 worklist에 선언했지만,
      SQL 아티팩트의 중복·대상 문서·로케일 일치를 확인하는 자동 게이트가 없었다. 부분 파일을
      수동 적용하면 누락·중복·잘못된 meme_id를 발견하기 어렵다.
      사용자 영향: 3
      데이터/법적 위험: 3
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 22.5
      의존성: 루프 049의 번역 worklist 및 운영자 SQL 적용 권한
      완료 조건: clean source-locked `machine` artifact가 기본 검사와 `--require-complete`를 통과하고,
      기존 artifact의 UPDATE·DELETE·MERGE·CALL·reviewed 승격은 fail-closed 오류로 남는다. 잔여 누락은
      로케일별로 출력하며 전체 배치 완료 시 `--require-complete`가 1,520행에서 통과한다.
      검증 명령: `pnpm translation:check` · `pnpm translation:check:complete`
      상태: code_complete (루프 092 — machine-only gate hardening; historical artifact 적용 보류)
      결과: 루프 050 checker·JSON 리포트, 루프 052 snapshot-locked 8행(2문서 × 4 locale), 루프 056
      `--emit-artifact` SQL-only mode, 루프 082 intake gate를 유지한다. Loop 092에서 checker가
      `meme_translations` 대상 UPDATE·DELETE·MERGE·CALL/RPC 및 reviewed 승격 INSERT를 fail-closed로
      거부하고, clean source-locked machine 1문서 × 4 locale fixture는 complete gate를 통과했다.
      canonical historical artifact는 **448/1,520행**이고 위험 mutation **18건**이 있어 `ok=false`가
      의도된 상태다. 새 GPT 호출·프로덕션 쓰기·사람 승인·공개 발행은 수행하지 않음.

- [x] ID: A11Y-005
      문제: generic 요소 aria-label 잔존 — HIGH 1건(trend-alerts-bell 안 읽음 점: 자식 텍스트 0이라 스크린리더에서 상태 완전 소실) + LOW 6건(admin 로딩 스켈레톤). 3번째 재발 유형.
      상태: done (루프 032)
      결과: 안 읽음 점은 aria-hidden 장식 + sr-only 텍스트로 분리. admin 로딩 6파일은 `role="status"` 부여(라벨·aria-busy 동시 유효). **회귀 가드 신설** — role 없는 div/span의 aria-label을 전수 스캔하는 테스트를 `pnpm test`(=CI)에 추가, 재도입 시 파일:줄 지목 실패를 증명함(감사가 제안한 rg 패턴의 상시화).

- [ ] ID: DQ-017
      문제: 링크 생존 표본 400건 검사(루프 024) — 부실률 2.5%(dead+private), 전체 외삽 ≈115건. 문제 링크의 56.5%가 나무위키에 몰렸고 timeout 11건은 전부 나무위키. **dead 확정 나무위키 5건**은 문서 삭제/이동 추정. 부수 발견: `meme_sources` 카운트가 anon 4,608 vs 관리자 5,717로 갈림 — RLS상 anon은 공개(approved/limited) 밈의 출처만 보므로, 차이 ≈1,109행은 비공개 밈의 출처로 설명된다.
      사용자 영향: 3 / 데이터/법적 위험: 3 / 트래픽 가중치: 2 / 해결 확신: 4 / 예상 노력: 2
      우선순위 점수: 18.0
      완료 조건: dead 확정 5건 정리(대체 또는 제거)는 데이터 편집 → 운영자 큐. 나무위키 timeout 11건 재검증은 비게이트.
      상태: **재검증 완료 — 측정 오류로 판명 (루프 035).** 함대 판정 timeout/dead 9건을 브라우저 UA + 20초로 재검사한 결과 **9건 전부 alive(200)** — 함대의 curl 기본 UA + 8초 제한이 나무위키 봇 차단에 걸린 거짓 양성. "부실률 2.5%·dead 확정 5건" 결론을 강등한다. 실제 부실률은 보고치보다 낮으며, 데이터 편집 큐 항목 없음. 링크 검사 도구화 시 브라우저 UA·20초·재시도 1회를 표준으로 할 것.

- [ ] ID: DQ-018
      문제: 제목 정규화로 못 잡는 신규 중복 3쌍 발견(루프 024) — `5dqfn236`↔`53df75yr`, `5syxxsa9`↔`46x2hg97`, `uvdujpcy`↔`knk2hsye`. 기존 HG-004(a) 19그룹에 없음. 제목이 서로 달라 의미 기반 대조로만 검출됨.
      사용자 영향: 3 / 데이터/법적 위험: 3 / 트래픽 가중치: 2 / 해결 확신: 4 / 예상 노력: 2
      우선순위 점수: 18.0
      의존성: HG-004 (병합 = 게이트)
      상태: blocked

- [x] ID: A11Y-012
      문제: 터치 대상 44px 미달 4곳 — export-button.tsx:213-214 · hero-web3.tsx:97 · submit-form.tsx:470 · source-evidence.tsx:37. (루프 024, 점수 45.0)
      상태: done (루프 028)
      결과: 3곳 수정 — export 닫기 버튼 h-8→h-11(라벨도 "close"→"닫기"), 홈 예시 칩 min-h-8→min-h-11, 출처 링크 min-h-6→min-h-11. 뒤 2곳은 루프 021·003에서 내가 만든 코드다. **submit-form.tsx `file:h-8`은 해당 없음으로 판정** — file: 의사요소는 별도 터치 대상이 아니라 input 전체(py-3, ≥44px)가 히트 영역이다.

- [x] ID: DES-007
      문제: 카드 제목 truncate 시 접근 가능한 전체 title 부재(meme-card.tsx:73, meme-compact-card.tsx:58) — LOOP.md §6. (점수 40.0)
      상태: done (루프 029)
      결과: line-clamp 제목 `<p>`에 `title={meme.title}` 부여 — 잘린 제목의 전체 텍스트 접근 경로 확보. 스크린리더는 원래 전문을 읽으므로(클램프는 시각 전용) 시각 사용자용 툴팁 보완이다.

- [x] ID: PERF-003
      문제: AnswerCardSkeleton에 SignalTrace 블록 누락 + MemeDetailSkeleton에 대응 없는 블록 — 양방향 CLS 위험. (점수 30.0)
      상태: done (루프 030)
      결과: 스켈레톤을 실제 AnswerCard 구성(헤더→파형→h1→뜻→신호등, ~341px)에 맞춰 재구성. 대응물 없던 h-11×4 블록 제거, 페이지 순서(카드→미디어→본문)와 일치.

- [x] ID: SEO-002
      문제: 얇은 문서(96.3%)에서도 MemeWebPageJsonLd가 무조건 완전하게 나감 — LOOP.md §10 위반. (점수 20.0)
      상태: done (루프 031)
      결과: WebPage JSON-LD를 `isIndexableMeme()`으로 게이트 — 색인·광고와 같은 단일 기준(D-001 원칙). 브레드크럼·비디오 JSON-LD는 사실 서술이라 유지. 실측: noindex 문서(e8ferq5u·uefmryky) WebPageLD 0건·브레드크럼 유지, 색인 문서(jkd7vu6x) 정상 출력.

- [x] ID: PERF-004
      문제: route별 First Load JS 기준선 부재. (점수 24.0)
      상태: done (루프 037)
      결과: 실측 — gzip 기준 / 323.0 · /rankings 309.2 · /explore 318.9 · 상세 318.4 · /search 313.3 KB. route 간 차 ~14KB로 공유 청크가 지배적 → route별 축소는 공유 청크 분해가 선행 조건. `BASELINE.json`·`artifacts/renewal/loop-037/` 기록.

- [ ] ID: DES-005
      문제: 탐색 결과 수 미표시 — LOOP.md §6. (점수 22.5)
      상태: done (루프 040 — DevTools Chrome 실측으로 완료 조건 확인)
      결과: `countOnly`(head+exact) 옵션 + 마운트 effect + 「결과 N개」 aria-live. DevTools 제어 Chrome 실측 — 무필터 「결과 3,904개」, category 필터 「결과 571개」(그리드와 동일 쿼리라 표시·목록 항상 일치). 검색(q) 경로는 RPC 50건 캡이라 표시 제외. 루프 038의 보류는 Browser 페인 테스트 한계였음(EXP-001 해결 참조).

- [ ] ID: EXP-001
      문제: **클라이언트 상호작용이 합성 테스트에서 관찰되지 않는다 — 기존 기능 포함.** /explore의 기존 무한 스크롤이 로컬 프리뷰·프로덕션 양쪽에서 합성 scrollTo 후 supabase 요청 0건(신규 count effect도 동일). 원인 후보: (a) 브라우저 페인의 합성 스크롤이 IntersectionObserver를 못 깨움(테스트 방법 한계) (b) 실제 하이드레이션 문제(심각 — 실사용자도 24개 이후 못 봄). 로컬에서는 Serwist 서비스워커의 구빌드 캐싱도 확인됨(해제 후에도 재현). 실기기 확인이 필요하다.
      사용자 영향: 4(만약 b) / 데이터/법적 위험: 1 / 트래픽 가중치: 3 / 해결 확신: 2 / 예상 노력: 3
      우선순위 점수: 8.0 (확신 낮음 반영)
      완료 조건: 실기기(모바일 브라우저)에서 /explore 스크롤 시 25번째 카드 로드 여부 확인. b로 판명 시 심각도 재산정.
      상태: **resolved (루프 040) — 제품 결함 아님, 테스트 방법 한계로 판명.** DevTools 제어 Chrome에서 점진 스크롤(600px 단위) 실측: 프로덕션 /explore가 **3,336개 카드 로드 + supabase 요청 6건** — 무한 스크롤 완전 정상. Browser 페인의 즉시 scrollTo(0, 바닥)가 IntersectionObserver를 깨우지 못한 것이 원인. 교훈: IO 기반 기능 검증은 점진 스크롤 + DevTools 계측을 표준으로.

- [ ] ID: DES-006
      문제: 카드에서 category·lifecycle·usage signal 신호 과밀(§6). (점수 12.0)
      상태: blocked (루프 039 재분류) — 어떤 신호를 뺄지는 정보 우선순위 판단 = 디자인·편집 결정. 자동 확정 부적합, HG-009 후보로 DECISIONS 검토 대상.

- [x] ID: A11Y-011
      문제: 외부 embed iframe onError 폴백 부재(§8). (점수 6.0)
      상태: rejected (루프 039) — cross-origin iframe은 로드 실패를 onError로 신뢰성 있게 감지할 수 없다(브라우저가 오류를 불투명 처리). 실효 있는 대안은 availability 재검증 배치(DQ-016 계열)이며 이미 별도 항목으로 존재. 죽은 이벤트 핸들러 추가는 무의미.

- [x] ID: DES-008
      문제: Pretendard 서체 데드코드(§9). (점수 4.0)
      상태: rejected (루프 039) — LOOP.md 절대규칙 12 「변경하지 않은 영역을 임의로 정리하지 않는다」에 저촉. 실사용자 영향 없는 데드코드 제거는 이 리뉴얼 범위 밖.

- [ ] ID: DES-009
      문제: DocStatusNote가 §4의 4필드 구조 미충족 — 설계안(incomplete-doc-v2.md) 존재하나 「마지막 검수」 필드 신설이 편집 표면 확장이라 게이트 후보. (점수 30.0)
      상태: blocked (HUMAN_GATE 후보 — HG-009로 검토)

> 루프 024의 전체 후보 10건·상세 근거는 `artifacts/renewal/loop-024/design-2-synthesis.md`·
> `data-quality-2-synthesis.md` 참조. 신뢰 패널은 reader-first 안이 승자로 판정됨
> (`trust-panel-verdict.md`) — 구현은 TrustNote 흡수·권리 문구 교체 조건부.

> 루프 023 감사가 도출한 나머지 후보(LOC-001·003~~005, A11Y-006~~, DQ-014·015 갱신분 등 16건 전체)는
> `artifacts/renewal/loop-023/audit-synthesis.md`에 근거·점수와 함께 있다. 다음 루프에서 triage.

---

## 기각된 항목

- **요약↔본문 의미 충돌 · 안전 신호↔본문 충돌** (LOOP.md §2 검사 항목)
  → **기각 (루프 024).** 상위 트래픽 100건 표본에서 확정 충돌 0건. 커버리지 ~2.5%라
  전수 무결 단정은 아니지만 critical flag 격상 근거 없음.

- **`을(를)` 조사 placeholder가 DB 본문에 남아 있다** (LOOP.md 초기 가설 4)
  → **데이터에서는 기각.** 공개 문서 3,904건 중 `DQ-M3-placeholder-text` 검출 0건.
  단 UI 템플릿에는 남아 있어 `DES-003`으로 범위를 좁혀 유지한다.

## 완료 (루프 046)

- **DES-WEB3-V2 — 전 페이지 web3 인터랙티브 리뉴얼(Signal Desk v2)**
  → **done (루프 046).** 50 에이전트 편성(정찰6/구현35/검증9). 신규 전역 유틸 6종 +
  ~100파일 스타일 전용. 게이트 전부 그린(tsc/eslint/vitest 634/BUILD). 리뷰 발견
  6건 전부 해소(포커스 링 캐스케이드 근본 수정 포함). DESIGN.md §16.

---

- [x] ID: PLUS-002
      문제: Plus가 트렌드·저장·알림을 제공해도 사용자가 밈을 실제 문구로 활용하는 마지막 단계가 비어 있었다.
      사용자 영향: 4 / 데이터·법적 위험: 2 / 트래픽 가중치: 2 / 해결 확신: 4 / 예상 노력: 2
      우선순위 점수: 16.0
      의존성: 기존 billing entitlement·상세 editorial fields
      완료 조건: Plus 사용자에게 설명·게시·안전 체크 세 문구와 전체 복사, 비구독자에게 locale-safe pricing CTA를 제공하고,
      글로벌 상세 route에서 동일 기능을 노출한다. 새 사실을 생성하지 않는다.
      검증 명령: `pnpm exec vitest run lib/meme-use-kit.test.ts components/premium/meme-use-kit.test.tsx lib/i18n-premium.test.ts` · `pnpm exec tsc --noEmit`
      상태: done (루프 060; production write/deploy 미수행)
      결과: 한국어·en·ja·zh·zh-tw 상세에 `MemeUseKit`을 연결하고 fallback copy, locked CTA, deterministic builder를 추가했다.

- [x] ID: GLO-005
      문제: locale 상세의 x-default가 영어 번역이 있어도 한국어를 가리키고, 공개 밈 조회 실패 시 sitemap이 정적 URL만 남긴 채 성공할 수 있었다.
      상태: done (루프 061; production deploy 미수행)
      결과: reviewed/indexable 영어 상세를 x-default로 통일하고 locale metadata의 missing guard를 추가했다. sitemap 공개 밈 조회 오류는 부분 결과를 반환하지 않고 예외로 중단한다.
      검증: locale metadata/sitemap targeted 30 tests, 전체 test 99 files / 734 tests, build, local smoke.

- [x] ID: GLO-006
      문제: reviewed/current 번역이 없는 언어는 글로벌 상세에서 요청할 수 없었고, `llms.txt`는 machine/stale draft가 독자에게 보이는 것처럼 설명해 공개 피드 정책과 어긋났다.
      사용자 영향: 4
      데이터/법적 위험: 2
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 30.0
      의존성: existing `TranslationPriorityButton`·`/api/translation-priority`·reviewed/current translation getter·Plus owner scope
      완료 조건: 한국어 canonical 상세가 빠진 `en`·`ja`·`zh`·`zh-tw`만 요청 CTA로 보여주고, `llms.txt` 네 locale이 machine/stale draft를 operator-private이며 공개 페이지·검색·AI feed에서 제외한다고 설명한다. 번역 생성·자동 공개·sitemap/hreflang 변경은 없다.
      검증 명령: `pnpm exec vitest run 'app/[locale]/llms.txt/route.test.ts' 'app/(default)/memes/[key]/page.test.ts' components/premium/translation-priority-button.test.tsx lib/meme-translations.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: done (루프 069 로컬 code; 번역 생성/적용·production deploy 미수행)
      결과: missing locale bridge와 공개 피드 정책 문구를 추가했다. targeted 4 files / 23 tests, 전체 121 files / 815 tests 통과. 번역 checker는 448/1,520 rows이며 complete gate는 추가 1,072행 전까지 의도적으로 실패한다. 로컬 Supabase `notFound`로 Plus authenticated 화면 manual QA는 미검증이다.

- [x] ID: PLUS-003
      문제: 저장 밈 급상승 알림과 Saved Reuse Radar가 발견 신호를 제공해도 사용자는 상세에서 Meme Use Kit을 다시 찾아야 했다.
      사용자 영향: 4 / 데이터·법적 위험: 1 / 트래픽 가중치: 3 / 해결 확신: 5 / 예상 노력: 2
      우선순위 점수: 30.0
      의존성: existing `saved_memes` owner-scoped Radar · `MemeUseKit` · locale detail routes
      완료 조건: Plus dashboard가 기존 Radar 결과에서 안전한 다음 행동을 최대 3개로 고르고, 각 항목이 현재 locale의 상세 Use Kit anchor로 이동한다. 저장 밈이 없으면 `/explore` CTA를 보여준다. 새 사실·DB write·안전 산식 변경은 없다.
      검증 명령: targeted action/copy/UI tests · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: done (루프 063; production deploy 미수행)
      결과: `buildPlusActionQueue`와 `PlusActionQueue`를 추가해 `useNow`·`checkContext`·`review`를 locale-safe Meme Use Kit 링크로 연결했다. 전체 test 101 files / 741 tests.

- [x] ID: PLUS-004
      문제: Plus 사용자가 이번 주 저장 밈·관심사 후보 중 무엇이 실제로 변했는지 보려면 개별 Trend Panel을 여러 개 열어야 했다. Radar는 현재 상태만, 알림은 개별 rising 이벤트만 보여준다.
      사용자 영향: 5 / 데이터·법적 위험: 1 / 트래픽 가중치: 3 / 해결 확신: 4 / 예상 노력: 3
      우선순위 점수: 20.0
      의존성: existing `meme_trend_metrics` public read · owner-scoped `saved_memes` · profile interests · Radar/alerts exclusion
      완료 조건: 최근 7일 KST에서 두 날짜 이상의 양수 trend delta가 있는 green/current 후보를 최대 3개로 보여주고, Radar·최근 알림 중복을 제거하며, 데이터가 부족하면 과장 추천을 하지 않는다. 새 write·schema·추적은 없다.
      검증 명령: weekly helper/UI/copy tests · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: done (루프 064; production deploy 미수행)
      결과: `/premium` 서버가 saved/interests 후보와 KST metrics를 owner scope 안에서 조합하고, `PlusWeeklyDeltaBrief`가 locale-safe Trend Panel 링크를 제공한다. 전체 test 103 files / 746 tests.

- [x] ID: ADMIN-AI-001
      문제: 관리자 검수 화면의 AI 초안이 Anthropic 고정 호출이었고, 번역 큐에는 원문 대조형 AI 검수 결과가 없었다.
      사용자 영향: 4 / 데이터·법적 위험: 3 / 트래픽 가중치: 1 / 해결 확신: 4 / 예상 노력: 2
      완료 조건: 관리자 밈·제보·번역 검수에서 GPT-5.6 Sol high를 서버 전용으로 호출하고, 구조화된 교정본·판정·신뢰도·메모를 제공한다. 자동 저장·자동 게시 없이 기존 운영자 승인/CAS를 유지한다.
      검증 명령: targeted 14 tests · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `git diff --check` · `pnpm build`
      상태: done (루프 065; build는 원격 Supabase DNS 게이트로 실패, production key/deploy 미수행)
      결과: `lib/openai-review.server.ts`로 Responses API(`gpt-5.6-sol`, `reasoning.effort=high`, strict JSON Schema)를 통일하고, `/admin/translations`에 GPT 검수 버튼을 추가했다.

- [x] ID: PLUS-005
      문제: Plus가 트렌드·주간 변화·저장 재사용 신호는 보여주지만, 저장한 밈의 안전 신호·편집 내용·번역 검수 변화는 직접 재방문해야 했다.
      사용자 영향: 5 / 데이터·법적 위험: 3 / 트래픽 가중치: 3 / 해결 확신: 4 / 예상 노력: 3
      의존성: `saved_memes` owner scope · `memes` 공개 상태 · `meme_translations` stale/reviewed 상태 · Plus entitlement
      완료 조건: 공개 콘텐츠 변화만 immutable event로 기록하고 활성 Plus의 자기 저장 밈에만 전달하며, Premium에서 locale-safe 상세 링크·읽음 처리·마이그레이션 전 폴백을 제공한다. 트렌드 점수 배치를 콘텐츠 변경으로 오인하지 않는다.
      검증 명령: `pnpm exec vitest run lib/saved-context-watch.test.ts supabase/plus_saved_context_watch.test.ts components/premium/plus-saved-context-watch.test.tsx app/api/saved-context-alerts/route.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: done (루프 066; build는 원격 Supabase DNS 게이트로 실패, production migration/deploy 미수행)
      결과: `meme_public_change_events`·`plus_saved_context_alerts`·self-scoped read RPC/cron과 `PlusSavedContextWatch`를 추가했다. 전체 test 111 files / 769 tests.

- [x] ID: PLUS-006
      문제: Plus 사용자가 저장한 밈의 번역을 원해도 수요를 전달할 경로가 없고, 운영자는 어떤 밈·언어를 먼저 검수할지 알 수 없으며 완료 뒤 요청자에게 돌아가는 신호도 없었다.
      사용자 영향: 5 / 데이터·법적 위험: 3 / 트래픽 가중치: 2 / 해결 확신: 4 / 예상 노력: 3
      우선순위 점수: 20.0
      의존성: Loop 065 관리자 GPT 보조 검수 · Loop 066 `meme_public_change_events`/`plus_saved_context_alerts` · active Plus · owner-scoped `saved_memes`
      완료 조건: Plus 사용자가 자기 저장 밈의 en/ja/zh/zh-tw 번역 검수를 idempotent하게 요청하고, 운영자가 수요순 큐에서 claim하며, 최신 reviewed 번역 승인 시 요청 완료와 owner-scoped 알림이 중복 없이 연결된다. 자동 번역 승인·자동 게시를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run app/api/translation-priority/route.test.ts components/premium/translation-priority-button.test.tsx lib/actions/admin-translations.test.ts supabase/plus_translation_priority_requests.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint`
      상태: done (루프 067 로컬 코드·SQL source contract; production migration/deploy 미승인·미수행)
      결과: `plus_translation_requests`와 요청/수요 큐/claim/완료 trigger 계약, locale 상세 CTA, 관리자 수요 큐를 연결했다. targeted 4 files / 20 tests, 전체 114 files / 784 tests 통과. 실제 Supabase RLS/RPC/trigger와 완료 알림 fan-out은 migration 적용 전이라 미검증이다.

- [x] ID: PLUS-007
      문제: Plus 대시보드의 급상승·저장 밈 변화·주간 브리프가 사용자의 재방문 이후에만 보이는 pull-only 구조라, 하루 단위 구독 반복 가치가 약하다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 3
      해결 확신: 4
      예상 노력: 4
      우선순위 점수: 15.0
      의존성: active Plus entitlement · `trend_alerts` saved/category fan-out · current reviewed translations · 외부 email relay
      완료 조건: 명시적 수신 동의 사용자만 KST 날짜당 최대 1회 원장에 들어가고, 저장 밈 급상승을 먼저 최대 3개 제공한다. approved/limited·rising·green/yellow와 현재 reviewed locale 번역만 사용하며, 수신 언어·상세 링크·안전 신호를 포함한다. provider 미설정 시 claim/send를 하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-daily-signal.server.test.ts lib/plus-daily-signal-delivery.server.test.ts components/premium/plus-daily-signal-settings.test.tsx app/api/plus/daily-signal/preferences/route.test.ts app/api/cron/plus-daily-signal/route.test.ts supabase/plus_daily_signal.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 068 로컬 코드·SQL·mock relay contract; production migration/relay/deploy 미승인·미수행)
      결과: `plus_digest_preferences`·`plus_digest_deliveries`와 service-role queue/claim/finish RPC, `/premium` 수신 설정, localized email builder, mock relay cron을 연결했다. targeted 7 files / 102 tests, 전체 120 files / 809 tests 통과. 실제 Supabase RLS/RPC 실행·relay credential·발송/수신·production 적용은 별도 게이트다.

- [x] ID: PLUS-008
      문제: Plus 사용자가 저장 밈을 폴더로 분류해도 콘텐츠 후보·게시 준비물로 묶으려면 상세를 다시 열어 뜻·주의·메모를 수동으로 정리해야 했다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 37.5
      의존성: owner-scoped `saved_memes`·기존 Plus entitlement·`meme_translations` reviewed/current getter·`MemeUseKit`
      완료 조건: 활성 Plus가 자기 컬렉션을 선택해 최대 100개의 approved/limited 밈을 private Markdown으로 내려받는다. 파일에는 뜻·유래·안전/유행 신호·현재 reviewed locale 번역 또는 명시적 한국어 fallback·locale-safe 상세 링크·개인 메모·Use Kit이 포함되고, 무료/비로그인·공개되지 않은 밈·타인 저장 데이터는 포함되지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-collection-brief.test.ts app/api/plus/collection-brief/route.test.ts 'app/(default)/my/my-content.test.tsx' lib/i18n-my.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 070 로컬 private export contract; production deploy·authenticated download 미수행)
      결과: `/my#saved` 컬렉션 선택 UI와 `/api/plus/collection-brief` attachment route를 연결했다. targeted 4 files / 50 tests, 전체 123 files / 822 tests 통과. signed-out `/my` 307·brief POST 401·`/en/pricing` 200을 HTTP로 확인했다.

- [x] ID: PLUS-009
      문제: Daily Signal 이메일은 수신 동의·KST 원장·localized relay payload까지 준비됐지만 외부 relay credential과 production migration이 없으면 Plus 사용자가 대시보드에서 당일 신호를 바로 확인할 수 없었다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 37.5
      의존성: owner-scoped `trend_alerts` · approved/limited public memes · current reviewed translations · existing Daily Signal candidate builder
      완료 조건: active Plus의 `/premium`에 최근 36시간 `rising`/`saved_rising` 신호를 최대 3개 표시하고 saved signal을 먼저 정렬한다. green/yellow·approved/limited·현재 reviewed locale 번역만 사용하며, free branch에는 신호 데이터나 UI를 노출하지 않는다. 새 migration·write·외부 발송은 없다.
      검증 명령: `pnpm exec vitest run components/premium/plus-daily-signal.test.tsx components/premium/premium-dashboard-content.test.tsx lib/plus-daily-signal.server.test.ts lib/plus-daily-signal-delivery.server.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 071 로컬 in-app signal contract; Supabase migration/relay/production deploy 미승인·미수행)
      결과: 기존 Daily Signal 후보 필터와 locale-safe 링크를 MY PLUS 카드로 재사용하고, 이메일 relay가 `not_configured`여도 Plus 사용자가 현재 검수 신호를 즉시 확인할 수 있게 했다. 인증된 production Plus manual QA와 실제 relay 수신은 운영 게이트로 남겼다.

- [x] ID: PLUS-010
      문제: Daily Signal로 급상승 신호를 볼 수 있어도 Plus 사용자가 매일 검수된 글로벌 밈을 이해하고 직접 확인하는 반복 사용과 완료 보상이 없었다. 날짜·locale별 콘텐츠를 임의로 조합하면 번역 품질과 일정 재현성도 보장할 수 없다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 4
      우선순위 점수: 21.7
      의존성: Asia/Seoul KST 날짜·approved/limited public memes·5개 locale reviewed/current translations·active Plus entitlement·기존 `buildQuestions()`·Supabase RPC 경계
      완료 조건: `/daily`와 4개 localized route가 signed-out/free/active Plus/unavailable 상태를 정직하게 분리하고, KST 날짜당 reviewed/current 5 locale 후보 12개에서 locale별 3문제를 deterministic하게 제공한다. 완료 요청은 locale만 허용하고 서버가 사용자·날짜·밈 ID를 결정하며, user/date당 한 번의 completion과 streak를 기록한다. machine/stale/missing 번역을 public quiz로 fallback하지 않는다.
      검증 명령: `pnpm exec vitest run lib/global-daily-challenge.test.ts lib/global-daily-challenge.server.test.ts supabase/plus_global_daily_challenge.test.ts app/api/plus/global-daily/complete/route.test.ts components/premium/global-daily-challenge.test.tsx components/premium/premium-dashboard-content.test.tsx lib/i18n-routing.test.ts lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 072 로컬 5 locale Daily contract; Supabase migration/RLS/RPC·authenticated Plus QA·production deploy 미승인·미수행)
      결과: KST 고정 12후보/3문제 생성기, 5개 locale route·copy·Plus dashboard entry, completion API와 idempotent streak RPC를 연결했다. targeted 8 files / 125 tests, 전체 129 files / 852 tests 통과. local HTTP에서 3 route·security/noindex·invalid completion input을 확인했으며 실제 DB-backed 성공 흐름은 Docker daemon 부재로 미검증이다.

- [x] ID: PLUS-011
      문제: 글로벌 상세에는 reviewed/current 현지어 설명이 있어도 공유용 Plus 카드 내보내기 버튼이 없고, 기존 export 서버가 canonical 한국어 제목·요약을 렌더링해 글로벌 사용자의 마지막 콘텐츠 활용 단계가 끊겨 있었다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 37.5
      의존성: existing `ExportButton`·`meme_translations` reviewed/current gate·public `approved`/`limited` memes·Plus entitlement·locale proxy contract
      완료 조건: `en`·`ja`·`zh`·`zh-tw` 상세에서 현재 locale을 전달한 카드 export를 제공하고, 서버가 공개 밈과 exact reviewed/current/complete 번역만 사용한다. missing/machine/stale/incomplete 번역은 한국어 fallback 없이 404, unsupported locale은 400, 성공 응답은 PNG attachment·private no-store·언어/보안 헤더를 제공한다. 기존 무료/Plus 옵션과 서버 entitlement gate를 보존하며 새 write·migration·자동 게시를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run proxy.test.ts 'app/(default)/memes/[key]/export/route.test.ts' components/export-button.test.tsx 'app/[locale]/memes/[key]/page.test.ts'` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP/PNG QA
      상태: code_complete (루프 073 로컬 localized export contract; production deploy·authenticated Plus premium download 미수행)
      결과: 글로벌 상세 action grid와 locale-aware export route/proxy를 연결했다. targeted 4 files / 27 tests, 전체 130 files / 859 tests 통과. 실제 `/en` 상세 200과 1200×630 PNG 200, `locale=fr` 400, stale/missing translation 404를 확인했다.

- [x] ID: PLUS-012
      문제: Plus Daily Signal이 검수된 급상승 후보를 보여줘도 사용자가 실제 게시·공유용 문구와 카드를 만들려면 상세를 다시 열고 수동으로 정리해야 했다. 불완전한 글로벌 번역을 공유 CTA에 노출하면 검수 경계도 흐려진다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: existing Plus Daily Signal candidate builder · `dailySignalLocale` · reviewed/current complete prose · existing localized export route · browser Web Share/clipboard/download
      완료 조건: active Plus의 Daily Signal 후보 중 공개 상태·green/yellow·현재 reviewed/current·title/summary/description/origin complete 후보에만 share CTA를 제공한다. 서버 export가 Plus entitlement와 콘텐츠 경계를 재검증하고, native file share 또는 caption clipboard+PNG download fallback을 사용한다. 5개 locale의 caption/safety/card 라벨이 locale-safe이며 외부 SNS POST·자동 게시·새 migration/write가 없다.
      검증 명령: `pnpm exec vitest run 'app/(default)/memes/[key]/export/route.test.ts' components/premium/plus-daily-share-action.test.tsx components/premium/plus-daily-signal.test.tsx lib/plus-daily-signal-delivery.server.test.ts lib/plus-daily-signal.server.test.ts lib/plus-daily-share-pack.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP/PNG QA
      상태: code_complete (루프 074 로컬 share pack contract; production deploy·authenticated native share 미수행)
      결과: 기존 Daily Signal 후보에 share-ready prose 경계를 추가하고, deterministic share pack과 localized OS share/fallback UI를 연결했다. targeted 6 files / 25 tests, 전체 133 files / 876 tests 통과. signed-out Plus 402, invalid locale 400, 글로벌 PNG 200·1200×630을 확인했다.

- [x] ID: LOC-008
      문제: 운영자는 live `meme_translations` 행만 페이지 단위로 검수해 공개 글로벌 catalog에서 로케일별로 몇 건이 최신 검수됐고, 원문 변경·검수 대기·누락이 얼마나 남았는지 한눈에 알 수 없었다. offline LOC-007 artifact 448/1,520행과 live DB coverage를 섞으면 실제 공개 가능성을 과장할 위험도 있다.
      사용자 영향: 4
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 30.0
      의존성: operator auth · public `approved`/`limited` memes · `meme_translations.source_updated_at` · 기존 CAS 검수 흐름
      완료 조건: 관리자 번역 화면이 live public catalog를 분모로 하여 `en`·`ja`·`zh`·`zh-tw`별 reviewed/current·machine current·stale revision·missing을 상호 배타적으로 표시한다. 1,000행 경계를 넘는 조회도 페이지네이션하며, 조회 오류를 0건으로 표시하지 않는다. coverage 경로는 read-only이고 기존 GPT-5.6-sol high 검수·운영자 승인/CAS·자동 공개 금지 경계를 유지한다.
      검증 명령: `pnpm exec vitest run lib/actions/admin-translations.test.ts lib/translation-coverage.test.ts components/admin/translation-coverage-panel.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP signed-out admin redirect
      상태: code_complete (루프 075 로컬 Global Translation Desk; production deploy·operator authenticated 200·DB/RLS 실행 미수행)
      결과: 순수 coverage 분류기·operator-only paginated public query·오류 상태 패널·machine/stale review 링크를 연결했다. targeted 3 files / 14 tests, 전체 135 files / 883 tests 통과. `/admin/translations` signed-out 요청은 `/login?next=%2Fadmin%2Ftranslations` 307로 보호됨을 확인했다. LOC-007 offline artifact는 별도 지표로 448/1,520행을 유지한다.

- [x] ID: LOC-009
      문제: coverage desk가 누락 수는 보여주지만 운영자가 실제 공개 원문을 선택해 글로벌 번역 초안을 검토할 수 없어, 1,072건의 누락이 다음 수작업으로 이어지지 않았다.
      사용자 영향: 4
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 26.7
      의존성: operator auth · public `approved`/`limited` memes · `meme_translations` locale identity · existing OpenAI Responses helper · human CAS review/publish
      완료 조건: 선택 locale의 공개 밈 중 기존 번역 행이 없는 원문만 관리자에게 제공하고, 명시적 클릭에서만 `gpt-5.6-sol` high source-only structured draft를 읽기 전용으로 보여준다. GPT 호출 전후 source revision·번역 부재를 검증하며 insert/update/delete/audit/RPC/revalidation·자동 저장/발행을 하지 않는다.
      검증 명령: `pnpm exec vitest run lib/actions/admin-translations.test.ts components/admin/missing-translation-draft-preview.test.tsx lib/translation-coverage.test.ts components/admin/translation-coverage-panel.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP signed-out admin redirect
      상태: code_complete (루프 076 로컬 read-only draft preview; authenticated operator/GPT/DB 운영과 production deploy 미수행)
      결과: missing list·preview server action·revision conflict 폐기·읽기 전용 UI를 연결했다. targeted 4 files / 24 tests, 전체 136 files / 893 tests 통과. 번역 행·감사 로그·공개 상태·sitemap은 변경하지 않았다.

- [x] ID: PLUS-014
      문제: 기존 Plus 번역 요청은 상세 CTA에서 생성되고 관리자 수요 큐에서 처리되지만, 요청자가 자신의 요청 상태·완료 시각·정확한 locale 재진입 경로를 확인할 중앙 surface가 없어 글로벌 번역 공급의 operator handoff가 사용자 가치로 닫히지 않았다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: existing `plus_translation_requests` · active Plus entitlement · owner-scoped `saved_memes` request RPC · operator queue/claim · human CAS reviewed/current publication trigger · SEO content locales
      완료 조건: active Plus의 `/premium`에 자기 요청만 최대 20건 표시하고 `requested`·`in_review`·`completed`·`dismissed` 상태와 시각·exact locale 상세 링크를 제공한다. 완료는 exact locale reviewed/current일 때만 ready이며 원문 revision 변경은 stale로 표시한다. free/expired/blank owner는 fulfillment query·DTO를 만들지 않는다. 성공 empty와 query unavailable을 구분하고 operator claim·human publish 경계를 유지한다.
      검증 명령: `pnpm exec vitest run lib/plus-translation-fulfillment.test.ts lib/plus-translation-fulfillment.server.test.ts components/premium/plus-translation-fulfillment-center.test.tsx components/premium/premium-dashboard-content.test.tsx lib/i18n-premium.test.ts supabase/plus_translation_priority_requests.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP signed-out `/premium`/translation API
      상태: code_complete (루프 078 로컬 Plus fulfillment/RLS contract; production migration·authenticated Plus/operator E2E·deploy 미수행)
      결과: 순수 fulfillment builder·server-only owner loader·4 locale copy/zh-tw fallback UI·Premium wiring을 추가하고 translation request self-read RLS를 owner + active Plus로 강화했다. targeted 6 files / 110 tests, 전체 142 files / 937 tests, tsc/lint/build/diff check·signed-out premium 307·translation POST 401을 확인했다. 실제 요청→운영자 claim→human reviewed completion→알림과 Supabase RLS 실행은 운영 게이트로 남겼다.

- [x] ID: PLUS-013
      문제: Daily Signal은 최근 급상승 알림이고 Global Meme Daily는 퀴즈·완료 루프라, active Plus가 매일 검수된 글로벌 밈을 읽고 바로 상세로 확인하는 발견 표면이 비어 있었다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: active Plus entitlement · public `approved`/`limited` memes · `green`/`yellow` · `rising`/`active` · 5개 SEO locale reviewed/current translations · existing Premium server boundary
      완료 조건: active Plus에서만 조회·ReactNode 생성이 일어나고, `ko`는 canonical source, `en`·`ja`·`zh`·`zh-tw`는 exact locale의 `reviewed`·source revision current·필수 4필드 complete translation만 사용한다. KST 날짜와 source ID로 입력 순서에 무관한 deterministic max-5 deck을 만들며, DB 오류는 `unavailable`, 후보 부재는 `empty`로 분리한다. UI-only locale은 기존 `dailySignalLocale` 해석으로 지원 SEO locale에 매핑하고 다른 locale fallback·write·audit·자동 게시를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-global-scout.test.ts lib/plus-global-scout.server.test.ts components/premium/plus-global-scout.test.tsx components/premium/premium-dashboard-content.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP signed-out `/premium`
      상태: code_complete (루프 077 로컬 read-only Plus Global Scout; authenticated Plus/실제 DB·production deploy 미수행)
      결과: top 240 public candidate overfetch·stable source ordering·KST daily rank·5 locale card/copy·empty/unavailable state를 연결하고 `/premium` active branch에만 삽입했다. targeted 4 files / 31 tests, 전체 139 files / 923 tests, build와 signed-out premium HTTP 보호를 확인했다.

- [x] ID: PLUS-015
      문제: Loop 078에서 앱 경로는 만료 Plus의 private alert 접근을 막지만, `trend_alerts`와 `plus_saved_context_alerts`의 직접 authenticated select 정책은 owner identity만 확인해 만료 사용자의 과거 Plus alert 조회 우회가 가능했다.
      사용자 영향: 5
      데이터/법적 위험: 5
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 75.0
      의존성: `has_active_plus(auth.uid())` · 기존 owner-scoped policies · service/operator flow
      완료 조건: 두 private alert self-read 정책 모두 owner + active Plus를 요구하고, browser write grant·RPC·service fan-out을 변경하지 않는다. forward migration과 active/expired/cross-owner source contract를 남긴다.
      검증 명령: `pnpm exec vitest run supabase/plus_alert_entitlement_rls.test.ts supabase/plus_saved_context_watch.test.ts supabase/plus_saved_meme_rising_alerts.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 079 local forward RLS contract; production migration·JWT PostgREST E2E 미수행)
      결과: `20260809190000_plus_alert_entitlement_rls.sql`과 source contract를 추가했다. targeted 3 files / 14 tests, 전체 143 files / 942 tests 통과. 실제 DB 적용과 active/expired/cross-owner 관찰은 운영 게이트다.

- [x] ID: PLUS-016
      문제: Plus Global Scout·Daily Signal·번역 이행 센터가 분리되어 사용자가 다음 행동을 직접 조합해야 했고, 미완료 번역 요청도 열 수 없는 locale detail 링크를 만들 수 있었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: existing Plus fulfillment · share-ready Daily Signal · Global Scout · exact reviewed/current locale routes · Premium server boundary
      완료 조건: active Plus에서만 최대 5개의 unique deterministic action을 `translation_ready > saved_signal > new_reviewed` 순서로 제공하고, 웹 요청 locale의 exact reviewed/current 콘텐츠만 link한다. requested/in_review/stale/dismissed는 링크가 없고 empty/unavailable/partial failure를 구분한다. free/signed-out branch에는 private inbox DTO/query가 없다.
      검증 명령: `pnpm exec vitest run lib/plus-global-action-inbox.test.ts components/premium/plus-global-action-inbox.test.tsx components/premium/plus-translation-fulfillment-center.test.tsx components/premium/premium-dashboard-content.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP signed-out `/premium`
      상태: code_complete (루프 080 local read-only Action Inbox; authenticated Plus/live DB·production deploy 미수행)
      결과: 기존 read models를 재사용한 `/premium` action inbox와 5 locale copy를 연결하고, complete reviewed/current가 아닌 fulfillment에는 link를 제거했다. targeted 6 files / 22 tests, 전체 145 files / 949 tests, tsc/lint/build/diff check·signed-out premium 307·`/en/pricing` 200을 확인했다. 번역 448/1,520과 live Plus manual QA는 별도 게이트다.

- [x] ID: PLUS-017
      문제: Action Inbox가 다음 밈을 발견해 상세로 보내지만, 사용자가 실제로 활용했는지 기록하지 않아 구독 가치가 발견·클릭에서 끝나고 재방문 루프가 없었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 4
      우선순위 점수: 25.0
      의존성: 기존 Plus Action Inbox read models · active Plus entitlement · KST 날짜 · reviewed/approved public content · 새 owner-scoped completion RPC
      완료 조건: 활성 Plus만 활용 완료 API/RPC에 접근하고, 사용자·밈·KST 날짜별 완료를 멱등 기록한다. 오늘 완료한 밈은 인박스에서 제외하고, 카드에서 검수된 텍스트를 복사·공유하며 오늘 완료 수·연속 활용 일수를 표시한다. migration은 파일로만 남기고 적용·자동 게시·외부 SNS POST는 하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-global-action-inbox.test.ts lib/plus-global-action-inbox.server.test.ts components/premium/plus-global-action-inbox.test.tsx app/api/plus/action-inbox/complete/route.test.ts supabase/plus_meme_use_completions.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP
      상태: code_complete (루프 081 local Plus use loop; migration/RLS/RPC authenticated E2E·production deploy 미수행)
      결과: Action Inbox에 server-derived completion summary, copy/share/mark-used controls, owner + active Plus gated API, KST idempotent completion migration 초안을 연결했다. targeted 5 files / 18 tests, 전체 148 files / 961 tests, tsc/lint/build/diff check·signed-out premium/invalid API HTTP를 확인했다. 실제 Supabase 적용·Plus 인증 사용자 완료 기록은 운영 게이트다.

- [x] ID: LOC-010
      문제: LOC-007의 MLX-linked 생성기는 모델이 준비된 경우의 원문 snapshot·검수 대기 SQL만 만들 수 있어, 사람이 제공한 번역 묶음을 글로벌 catalog 공급으로 안전하게 넘길 표준 intake가 없었다. 임의 SQL을 수동으로 만들면 4개 locale 누락·원문 revision drift·중복을 적용 전에 놓칠 수 있다.
      사용자 영향: 4
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 40.0
      의존성: `artifacts/renewal/loop-050/worklist.json` · 기존 source snapshot/CAS SQL builder · `translation-batch-check` · 사람 번역 문구와 운영자 최종 검수
      완료 조건: JSON pack이 지원 locale 네 개만 사용하고, 밈별 4-locale 완결·동일 source snapshot·worklist membership·중복 부재·기존 언어/source-fidelity validator를 통과한다. 기본 실행은 report-only이고, `--emit-artifact --require-complete`에서만 locale별 machine SQL을 만들며 reviewed/publication 경계는 유지한다.
      검증 명령: `pnpm translation:intake:test` · `pnpm translate:memes:mlx-linked:test` · `pnpm translation:check` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 082 local artifact-first intake; 실제 번역 pack·Supabase 적용·operator publish·production deploy 미수행)
      결과: `scripts/translation-intake.mjs`와 회귀 테스트를 추가했다. duplicate/worklist/source snapshot/4-locale/언어·fidelity 검증, report-only 기본값, 명시적 complete artifact write, 기존 atomic SQL CAS를 확인했다. 현재 실제 offline catalog는 문구를 임의 생성하지 않아 448/1,520행 그대로다.

- [x] ID: PLUS-018
      문제: Loop 081의 Action Inbox가 활용 완료·copy/share까지 제공해도, 사용자가 여러 밈을 실제 게시 준비물로 묶으려면 카드마다 다시 export하고 캡션·안전 문구를 수동으로 합쳐야 했다. 이 단계가 없으면 Plus 가치가 발견·단건 공유에서 끊긴다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: 기존 Plus Action Inbox · exact reviewed/current locale 콘텐츠 · 기존 localized card export · Web Share/clipboard/download
      완료 조건: active Plus Action Inbox 안에서 기존 우선순위·중복 제거·완료 제외·최대 5개를 그대로 사용해 Creator Pack을 만들고, 통합 caption·safety note·locale-safe detail link·PNG를 제공한다. native multi-file share가 가능하면 한 번에 공유하고, 불가능하면 caption 복사와 개별 카드 다운로드로 fallback한다. 일부 export 실패는 성공/실패 수를 분리하며 새 migration/RPC/cron/DB mutation/외부 SNS POST는 없다.
      검증 명령: `pnpm exec vitest run lib/plus-creator-pack.test.ts lib/plus-global-action-inbox.test.ts lib/plus-translation-fulfillment.test.ts lib/plus-translation-fulfillment.server.test.ts components/premium/plus-global-action-inbox.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production browser QA
      상태: code_complete (루프 083 local Creator Pack; authenticated Plus/live DB·production deploy 미수행)
      결과: `PlusGlobalActionInbox` 내부에 기존 export route와 `buildPlusDailySharePack()`을 재사용하는 Creator Pack을 연결했다. target 5 files / 25 tests, 전체 149 files / 966 tests, tsc/lint/build/diff check와 local `/en/pricing` browser render·signed-out `/premium` login redirect를 확인했다. 실제 Plus populated data·native OS share·production deploy는 운영 게이트다.

- [x] ID: PLUS-019
      문제: Creator Pack이 여러 카드를 준비해도 사용자가 실제 활용을 마친 시점과 기존 Plus 활용 원장이 연결되지 않아, 공유·다운로드와 구독 가치 사이에 마지막 확인 단계가 비어 있었다. 또한 다른 로케일의 ready translation이 현재 콘텐츠 로케일 Action Inbox에 섞일 수 있었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: 기존 Creator Pack export 성공 항목 · 기존 `/api/plus/action-inbox/complete` · active Plus completion boundary · 콘텐츠 로케일
      완료 조건: Pack 생성·공유·다운로드에서는 completion API를 호출하지 않고, 성공적으로 준비된 카드만 명시적 receipt 확인으로 기존 API에 순차 기록한다. 부분 실패는 성공 항목만 제거하고 실패 항목·재시도 CTA를 유지한다. ready translation은 요청 콘텐츠 로케일과 일치할 때만 노출한다.
      검증 명령: `pnpm exec vitest run lib/plus-global-action-inbox.test.ts components/premium/plus-global-action-inbox.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production browser QA
      상태: code_complete (루프 084 local Outcome Receipt + locale isolation; authenticated Plus/RLS·production deploy 미수행)
      결과: Creator Pack receipt가 성공 카드만 보존하고 명시적 확인에서 기존 completion API를 사용하도록 연결했다. targeted 2 files / 13 tests, 전체 149 files / 969 tests, tsc/lint/build/diff check·local `/en/pricing` 200·signed-out `/premium` login redirect를 확인했다. 실제 Plus populated receipt/API와 번역 448/1,520 보완은 운영 게이트다.

- [x] ID: PLUS-020
      문제: Unifi provider status 응답이 `transactionId`·`orderId`·`storeId`·금액·통화 중 일부를 생략해도 검증 객체로 넘어갈 수 있어, 결제 귀속과 Plus 권한 전환 경계가 malformed response에 대해 fail-open이었다.
      사용자 영향: 5
      데이터/법적 위험: 5
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: `getUnifiPayTransaction()` · `isExpectedUnifiPayTransaction()` · Unifi webhook settlement flow · configured store/price/currency
      완료 조건: 필수 결제 필드가 하나라도 없거나 transaction ID가 요청과 다르면 status lookup이 retryable 5xx가 되고, 조회된 거래의 store·금액·통화가 설정과 다르면 200 ignored로 권한을 만들지 않는다. 유효한 동일 transaction만 기존 멱등 process flow로 진입한다.
      검증 명령: `pnpm exec vitest run lib/billing/unifi-pay.server.test.ts app/api/billing/unifi/webhook/route.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP `/en/pricing`·signed-out `/premium`
      상태: code_complete (루프 085 local fail-closed settlement contract; 실제 Unifi 결제·Supabase·authenticated Plus·production deploy 미수행)
      결과: parser와 defensive predicate를 함께 강화하고 malformed lookup 500·mismatch ignored 200·권한 미생성 회귀를 추가했다. targeted 2 files / 30 tests, 전체 149 files / 976 tests, tsc/lint/build 73/73·diff check·local HTTP boundary를 확인했다. 실제 결제/DB/RLS 관찰은 운영 게이트다.

- [x] ID: PLUS-021
      문제: `/premium`과 `/my`의 Plus 개인 피드가 UI locale과 무관하게 canonical 한국어 `title`·`summary`·`slug`를 렌더해, 글로벌 구독자에게 번역된 개인 트렌드 레이더처럼 보이면서 한국어 상세로 보냈다. 현재 offline 번역 공급도 448/1,520행이라 조용한 한국어 fallback은 신뢰를 해친다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: public `approved`/`limited` memes · exact reviewed/current `meme_translations` · `isIndexableLocalizedMeme()` · active Plus 서버 경계
      완료 조건: `ko`는 기존 6개 source feed를 유지하고, `en`·`ja`·`zh`·`zh-tw`는 최대 60개 후보 중 localized detail과 동일한 depth/publication gate를 통과한 exact reviewed/current 카드만 최대 6개 표시한다. 관심사 성공-empty만 fresh로 폴백하며 query error·empty coverage를 분리한다. same content-locale 상세 링크, free zero-query, UI-only English label, `zh-tw` 전용 상태 문구를 보장한다.
      검증 명령: `pnpm exec vitest run lib/plus-localized-feed.test.ts lib/plus-localized-feed.server.test.ts components/my-feed.test.tsx lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP `/en/pricing`·signed-out `/premium`·`/my`
      상태: code_complete (루프 086 local locale-safe Plus feed; authenticated Plus/live DB·translation publish·production deploy 미수행)
      결과: `MyFeed` 직접 조회를 static-anon server loader와 순수 projection으로 분리하고, 기존 detail indexability contract·stable source ordering·4개 상태·same-locale href를 연결했다. focused 4 files / 104 tests, 전체 152 files / 993 tests, tsc/lint/build 73/73/diff check 및 local HTTP boundary를 통과했다. 실제 검수 번역 공급·authenticated populated feed는 운영 게이트다.

- [x] ID: PLUS-022
      문제: Plus 기능은 개인 피드·Daily Signal·Global Scout·Action Inbox로 나뉘어 있지만, 첫 화면에서 구독자가 오늘 무엇을 끝내야 하는지 직접 조합해야 했다. Creator Pack을 만들고도 실제 사용 완료 상태가 작은 보조 문구에 머물러 구독의 결과 가치가 약하게 보였다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: 기존 `buildPlusGlobalActionInbox()`·Creator Pack export·owner-scoped completion API·기존 5개 UI locale copy
      완료 조건: Action Inbox가 active Plus 첫 업무 영역으로 표시된다. `ready`·`prepared`·`complete`·`empty`·`unavailable` 상태가 정직하게 구분된다. Creator Pack 공유/다운로드는 completion API를 호출하지 않고 명시적 receipt 확인에서만 기존 API를 호출한다. 완료 후 “오늘의 결과 완료”가 남고, `ko`·`en`·`ja`·`zh`·`zh-tw` 문구와 active Daily CTA가 일치한다.
      검증 명령: `pnpm exec vitest run components/premium/plus-global-action-inbox.test.tsx components/premium/premium-dashboard-content.test.tsx lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `pnpm translation:check` · `git diff --check` · local production HTTP
      상태: code_complete (루프 087 local outcome workflow; authenticated Plus/RLS·production deploy 미수행)
      결과: 기존 Action Inbox를 대시보드 첫 영역으로 올리고, 오늘 결과 상태 판정·5개 locale copy·44px touched CTA·active Daily 시작 CTA를 연결했다. focused 3 files / 98 tests, 전체 152 files / 995 tests, tsc/lint/build 73/73/diff check와 `/zh/pricing` 200·`/zh/daily` 200·signed-out `/zh/premium`/`/zh/my` 307을 확인했다. 실제 Plus populated Creator Pack/native share·completion RPC와 번역 448/1,520 보완은 운영 게이트다.

- [x] ID: PLUS-023
      문제: Plus 번역 priority queue의 누락 locale 요청은 `in_review` claim 뒤에도 기존 `meme_translations` 행이 없어 `/admin/memes/[id]`의 빈 검수 화면으로 끝났다. 기존 GPT-5.6 Sol high 누락 번역 기능도 read-only preview만 제공해 글로벌 콘텐츠 공급이 운영자 편집·검수 큐로 이어지지 않았다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: 기존 `meme_translations` machine/reviewed 공개 게이트 · `list_translation_priority_queue` · `gpt-5.6-sol` high preview · operator audit/RLS
      완료 조건: 번역 행이 없는 Plus 요청은 exact locale·meme focus 경로로 이동한다. GPT 미리보기는 no-write로 유지한다. 운영자가 결과를 수정하고 명시적으로 저장할 때만 현재 공개 원문 revision에 맞는 단일 `machine` 행이 생성되며, deterministic localized slug·provider/model/prompt metadata·null review fields·audit가 기록된다. stale source·private source·duplicate·non-operator는 mutation 없이 거절하고, machine 행은 reviewed 전까지 public/Plus ready가 아니다.
      검증 명령: `pnpm exec vitest run lib/actions/admin-translations.test.ts components/admin/missing-translation-draft-preview.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `pnpm translation:check` · `pnpm exec eslint lib/actions/admin-translations.ts lib/actions/admin-translations.test.ts components/admin/missing-translation-draft-preview.tsx components/admin/missing-translation-draft-preview.test.tsx components/admin/translation-priority-queue.tsx 'app/(default)/admin/translations/page.tsx'` · `git diff --check`
      상태: code_complete (루프 088 local translation-demand bridge; authenticated operator/live DB·human review/publication·production deploy 미수행)
      결과: priority queue missing link, focus loader, operator edit form, explicit machine insert/audit/CAS를 연결했다. focused 2 files / 20 tests, 전체 152 files / 996 tests, tsc/lint/build 73/73/translation check 448/1,520/diff check를 확인했다. 실제 operator session·GPT live call·machine→reviewed publication과 1,072행 번역 보완은 운영 게이트다.

- [x] ID: PLUS-024
      문제: Loop 088의 Plus 번역 priority queue에서 번역 행이 없는 요청은 `초안 만들기` focus 링크로 바로 이동해, 운영자가 작업을 시작해도 요청 상태가 `requested`에 남을 수 있었다. 큐의 수요·운영자 작업 상태가 어긋나면 Plus fulfillment와 실제 공급 우선순위를 신뢰하기 어렵다.
      사용자 영향: 4
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 40.0
      의존성: 기존 `claim_translation_priority_request` RPC · `claimTranslationPriority` server action · Loop 088 focus route · gpt-5.6-sol high preview
      완료 조건: missing translation row도 focus route 이동 전에 operator claim을 성공시킨다. claim 실패 시 route 이동이나 GPT 호출 없이 큐에 오류를 남긴다. 기존 translation row의 claim→meme detail 경로와 GPT source-only/no-auto-publish 경계를 유지한다.
      검증 명령: `pnpm exec vitest run components/admin/missing-translation-draft-preview.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `pnpm translation:check` · `git diff --check` · local production HTTP signed-out `/admin/translations`
      상태: code_complete (루프 089 local claim continuity; authenticated operator/live RPC·GPT call·human publication·production deploy 미수행)
      결과: missing row의 `초안 만들기`를 claim-aware button으로 바꾸고 성공 시에만 exact locale/meme focus route로 이동시켰다. claim failure는 큐에 남는다. focused 1 file / 7 tests, 전체 152 files / 998 tests, tsc/lint/build 73/73·translation check 448/1,520·signed-out admin 307·diff check를 확인했다.

- [x] ID: LOC-011
      문제: Loop 082의 intake는 `meme` source shape를 기대하지만, Loop 052에서 이미 생성된 완전한 4-locale machine batch는 `source` shape·`source_snapshot_hash`·Postgres `+00` timestamp를 사용해 다시 intake할 수 없었다. 이 불일치는 기존 draft를 안전한 검수 artifact로 재사용하지 못하게 한다.
      사용자 영향: 4
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 40.0
      의존성: 기존 `scripts/translation-intake.mjs` · `scripts/translate-memes-mlx-linked.mjs` source snapshot/hash · Loop 052 legacy batch · Loop 050 canonical artifact checker
      완료 조건: canonical `meme`와 legacy `source` row를 모두 허용하고, source snapshot hash·worklist membership·4-locale completeness·language/fidelity·duplicate gate를 유지한다. pack provenance의 provider/model을 보존하고, `+00` timestamp는 source hash 문자열을 바꾸지 않고 검증한다. report-only 기본값과 명시적 artifact emit·machine/reviewed/public 경계를 유지한다.
      검증 명령: `pnpm translation:intake:test` · `pnpm translate:memes:mlx-linked:test` · `node scripts/translation-batch-check.test.mjs` · 실제 Loop 052 batch `pnpm translation:intake -- ... --require-complete --json` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 090 local legacy handoff; 실제 GPT-5.6 Sol high 신규 생성·human review/publication·Supabase 적용·production deploy 미수행)
      결과: Loop 052 batch가 **8/8 valid**, 2 memes × 4 locales, error 0으로 통과하고 임시 4 SQL artifact/checker도 통과한다. canonical Loop 050에 이미 있는 동일 8행은 duplicate로 차단된다. 기존 canonical 공급은 448/1,520으로 변하지 않았다.

- [x] ID: PLUS-025
      문제: Plus는 발견·카드 준비·활용 완료 표시까지는 있지만, 실제 활용의 채널·exact locale·산출물·성과 메모를 이어 저장하지 않아 구독 기간이 길어져도 개인 작업 기억이 쌓이지 않는다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 4
      예상 노력: 4
      우선순위 점수: 20.0
      의존성: existing `plus_meme_use_completions` · active Plus entitlement · exact reviewed/current locale · owner-scoped RLS/RPC · Action Inbox/Creator Pack explicit receipt
      완료 조건: 명시적 활용 완료 뒤에만 private receipt를 만들고, channel·locale·artifact kind·선택적 게시 URL/성과/메모를 저장한다. KST completion과 1:1 멱등 연결, owner + active Plus만 read/write, machine/stale/missing locale 거절, 7일 요약의 채널·locale·성과 입력 대기 상태를 제공한다. 서버는 URL fetch나 SNS 자동 게시를 하지 않는다.
      검증 명령: domain/KST unit · migration/RLS/RPC contract · API owner/Plus/locale negative · Action Inbox/Creator Pack UI regression · authenticated Supabase E2E
      상태: code_complete (루프 091 local private Outcome Ledger; production migration·authenticated Supabase E2E·human review/publication·production deploy 미수행)
      결과: `plus_meme_use_receipts` 1:1 receipt 원장과 atomic `record_plus_meme_use_receipt` RPC를 추가하고, 기존 completion 원장과 KST 멱등 연결을 유지했다. Action Inbox/Creator Pack은 명시적 inline receipt 저장 뒤에만 completion과 receipt를 기록하며, channel·exact locale·artifact kind·선택적 URL/성과/개인 메모와 private 7일 channel/locale/artifact 요약을 제공한다. machine/stale/missing locale은 거절하고 URL fetch·SNS 자동 게시·production DB write는 하지 않는다. focused 6 files / 51 tests, 전체 155 files / 1,032 tests, tsc/lint/build/diff check를 통과했다.

- [x] ID: PLUS-026
      문제: Loop 091의 private Outcome Ledger가 `성과 입력 대기 N건`만 집계하고, 사용자가 나중에 실제 성과를 보충하거나 회고할 경로가 없어 개인 작업 기억의 마지막 루프가 끊겼다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: `plus_meme_use_receipts` · active Plus entitlement · owner-scoped RLS/RPC · 기존 7일 Outcome Ledger
      완료 조건: 최근 7일 receipt 최대 5건을 성과 미입력 우선으로 표시하고, 제목·날짜·채널·언어·산출물만 노출한다. active Plus 본인의 미입력 receipt만 성과 메모(필수, 최대 1,000자)를 한 번 갱신하고 기존 값은 덮어쓰지 않는다. 저장 성공 시 대기 수와 목록을 새로고침 없이 갱신하며 실패 시 입력값을 보존한다. ko/en/ja/zh/zh-tw 카피와 signed-out/free/RPC negative 경계를 포함한다.
      검증 명령: `pnpm exec vitest run lib/plus-outcome-follow-up.test.ts lib/plus-outcome-follow-up.server.test.ts app/api/plus/outcome-ledger/performance/route.test.ts components/premium/plus-outcome-follow-up.test.tsx supabase/plus_meme_use_performance_followup.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP
      상태: code_complete (루프 093 local Outcome Follow-up; production migration·JWT/RLS authenticated E2E·실제 Plus 저장·production deploy 미수행)
      결과: 기존 Outcome Ledger 안에 최근 활용 목록과 `성과 추가` 인라인 form을 연결했다. `record_plus_meme_use_performance` RPC/API는 owner + active Plus와 one-time update를 강제하며 URL/private note를 client로 보내지 않는다. focused 7 files / 25 tests, 전체 160 files / 1,045 tests, tsc/lint/build·signed-out `/premium` 307·성과 API 401을 확인했다.

- [x] ID: LOC-012
      문제: 관리자 번역 검수 화면의 GPT 경로는 `gpt-5.6-sol` + high를 사용하고 있었지만, 일반 기존 번역 검수 경로가 계약 drift를 호출 전에 fail-closed로 차단하지 않아 향후 설정 변경 시 다른 모델이 호출될 여지가 있었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: `lib/openai-review.server.ts`의 고정 model/reasoning/store 계약 · `/admin/translations` operator gate · strict JSON/no-auto-publish 경계
      완료 조건: 일반 검수와 누락 번역 preview 모두 `gpt-5.6-sol`·`reasoning.effort=high`·`store=false` 계약을 사용하고, 계약 drift 시 GPT 요청·audit·저장 없이 명시적 오류를 반환한다. 오래된 `OPENAI_REVIEW_MODEL` override는 무시한다.
      검증 명령: `pnpm exec vitest run lib/openai-review.server.test.ts lib/actions/admin-translations.test.ts components/admin/meme-translation-review.test.tsx components/admin/missing-translation-draft-preview.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP signed-out `/admin/translations`
      상태: code_complete (루프 094 local admin review contract; authenticated operator/live GPT·human publication·production deploy 미수행)
      결과: 일반 `reviewMemeTranslationWithGpt`에 fail-closed guard와 regression을 추가했다. focused 4 files / 31 tests, 전체 160 files / 1,046 tests, tsc/lint/build 73/73·local signed-out admin 307·pricing 200·성과 API 401을 확인했다. 실제 OpenAI 호출·Supabase write·공개 발행은 운영 게이트다.

- [x] ID: LOC-013
      문제: 번역 intake가 여러 historical artifact directory를 canonical 공급 manifest로 합치지 못하고, unsafe SQL이 있는 directory의 행을 현재 공개 공급량으로 오인할 수 있다.
      사용자 영향: 5
      데이터/법적 위험: 5
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: `scripts/translation-intake.mjs` · `scripts/translation-batch-check.mjs` · Loop 050 historical artifact · Loop 052 legacy pack
      완료 조건: existing artifact를 read-only로 병합하고 파일 단위 safe/unsafe 행을 분리한다. 입력의 new/duplicate/source mismatch/worklist 이탈을 분류하고 locale별 missing before/after/delta를 남긴다. historical unsafe directory는 격리한 채 clean 별도 output의 machine-only emit을 허용하고, output 자체의 unsafe 상태는 fail-closed 한다.
      검증 명령: `pnpm translation:intake:test` · `node scripts/translation-batch-check.test.mjs` · `pnpm translate:memes:mlx-linked:test` · 실제 Loop 052 preflight · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 095 local canonical intake preflight; historical artifact 적용·operator review/publication·production deploy 미수행)
      결과: Loop 050 448행을 safe 168·unsafe 280으로 분리하고 18개 historical 오류를 보존했다. Loop 052의 8행은 duplicateExisting으로 전부 차단되며, 새 clean pack은 별도 output으로만 machine artifact를 만들 수 있다.

- [x] ID: PLUS-027
      문제: Loop 093의 Outcome Follow-up은 자유 텍스트 성과 메모를 남길 수 있지만, 그 결과가 다음 추천에 구조적으로 반영되지 않아 Plus가 개인 작업 기억으로 학습하지 못한다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: `plus_meme_use_receipts` · active Plus entitlement · owner-scoped rating RPC · 기존 Action Inbox/Outcome Follow-up
      완료 조건: 최근 28일·최대 50건의 `hit|neutral|miss` 평가를 owner + active Plus만 1회 저장한다. 평가 3건 미만은 학습 중으로 표시하고, hit는 가산·miss는 감점·동점은 기존 Action Inbox 순서를 유지한다. 오늘 완료한 밈은 다음 추천에서 제외하며, 평가를 저장하면 같은 화면의 Next Move가 즉시 재정렬된다. URL·private note·자유 텍스트는 추천 DTO나 UI에 노출하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-next-move.test.ts components/premium/plus-next-move.test.tsx app/api/plus/outcome-ledger/rating/route.test.ts supabase/plus_meme_use_outcome_ratings.test.ts components/premium/plus-outcome-follow-up.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP
      상태: code_complete (루프 096 local Plus Next Move; production migration·authenticated JWT/RLS·실제 rating 저장·production deploy 미수행)
      결과: `performance_rating` additive migration/RPC/API와 28일 rating loader, deterministic Next Move ranking, 5-locale copy, one-time rating UI를 연결했다. focused 7 files / 28 tests, 전체 164 files / 1,060 tests, tsc/lint/build 73/73·signed-out premium/admin/rating 경계를 확인했다. 기존 note follow-up은 migration rolling fallback으로 유지된다.

- [x] ID: PLUS-028
      문제: Plus가 Action Inbox·Outcome Ledger·Next Move까지 활용 원장을 쌓아도, `/premium` 첫 화면에서는 그 가치가 Action Inbox 내부의 접힌 요약에 묻혀 구독자가 실제 누적 결과를 즉시 확인하기 어려웠다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 33.3
      의존성: 기존 owner-scoped outcome summary·completion·rating read model · active Plus entitlement · 5개 locale copy
      완료 조건: active Plus `/premium` 헤더 아래에 오늘 활용·연속 일수·최근 활용·성과 입력 대기·평가 수를 서버 집계값으로 표시한다. `ready`·`empty`·`unavailable`을 구분하고 실패를 0으로 위장하지 않는다. receipt ID·meme ID·URL·private/performance note는 렌더링하지 않는다. Action Inbox와 기존 상세 요약을 유지하며 5개 locale 및 UI-only locale fallback을 제공한다.
      검증 명령: `pnpm exec vitest run components/premium/plus-outcome-snapshot.test.tsx components/premium/premium-dashboard-content.test.tsx components/premium/plus-global-action-inbox.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP `/premium`
      상태: code_complete (루프 098 local Plus outcome snapshot; production migration·authenticated Plus/RLS·실제 receipt/rating 저장·production deploy 미수행)
      결과: `PlusOutcomeSnapshot`을 헤더 직후에 연결하고 기존 7일 요약을 기본 펼침으로 바꿨다. 서버 read model만 사용하며 신규 API/RPC/migration/POST는 없다. focused 3 files / 13 tests, 전체 166 files / 1,066 tests, tsc/lint/build 77/77·signed-out premium 307을 확인했다.

- [x] ID: LOC-014
      문제: 글로벌 locale 상세 페이지는 reviewed/current 번역이 있어도 검색 진입점이 없고, 번역이 없는 결과를 무리하게 locale URL로 연결하면 404·기계 번역·언어 신호 혼선이 생긴다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: `search_memes` RPC · `meme_translations` reviewed/current 공개 게이트 · `localizedMemePath` · locale header/search form
      완료 조건: `/en|ja|zh|zh-tw/search`가 locale HTML/metadata와 함께 렌더되고, exact reviewed/current/depth-qualified 번역만 locale 상세로 연결한다. 나머지는 `lang=ko` 원문 라벨과 한국어 canonical로 폴백한다. query variant는 noindex/follow self-canonical만 가지며 hreflang·sitemap에 들어가지 않는다. 언어 전환 시 query를 보존한다.
      검증 명령: `pnpm exec vitest run 'app/[locale]/search/page.test.ts' lib/i18n-routing.test.ts components/language-selector.test.tsx lib/meme-translations.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP `/en|ja|zh|zh-tw/search`
      상태: code_complete (루프 097 local global search surface; 번역 공급·human review/publication·production Supabase write·production deploy 미수행)
      결과: 단일 batch translation lookup과 safe fallback card, locale copy/input/header/query-preserving switch, noindex self-canonical metadata를 연결했다. focused 4 files / 41 tests, 전체 165 files / 1,063 tests·tsc·lint·build 77/77·local 200 smoke를 확인했다.

- [x] ID: LOC-015
      문제: 글로벌 번역 coverage 표의 `누락` 수가 작업 화면으로 연결되지 않아 운영자가 로케일을 다시 선택하고 누락 원문 preview를 수동으로 찾아가야 했다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: `TranslationCoveragePanel` · `listMissingMemeTranslations` · `MissingTranslationDraftPreview` · operator auth gate
      완료 조건: 양수 누락 수는 기존 `/admin/translations?locale=<locale>` 작업 경로로 연결하고, accessible name에 언어명·수·작업 의도를 포함한다. 0건은 링크로 위장하지 않는다. 새 데이터 공급·GPT 호출·저장·발행은 추가하지 않는다.
      검증 명령: `pnpm exec vitest run 'components/admin/translation-coverage-panel.test.tsx'` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · changed-source whitespace check · local production HTTP signed-out `/admin/translations?locale=en`
      상태: code_complete (루프 099 local operator navigation; authenticated operator/live DB/GPT/publication/production deploy 미수행)
      결과: coverage 누락 수를 locale 필터로 직접 연결하고, 0건은 숫자만 유지했다. focused 1파일 / 2건, 전체 166파일 / 1,066건, tsc/lint/build 77/77·signed-out admin 307을 확인했다.

- [x] ID: PLUS-029
      문제: Plus `/premium` 첫 화면에서 Outcome Snapshot·Action Inbox·7일 요약이 함께 시작해 오늘 할 일이 분산되고, Creator Pack을 만들어도 실제 카드 결과를 확인하기 전까지 구독 효과가 약하게 느껴졌다. 완료된 번역 요청은 원문 depth가 얇아도 `ready`처럼 보일 수 있어 공개 action이 404로 이어질 위험도 있었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: 기존 owner-scoped Plus Action Inbox·localized export·completion/receipt API · `isIndexableMeme` · 5개 locale copy
      완료 조건: active Plus 첫 화면은 eligible action 하나를 먼저 보여주고, 기존 export 결과의 이미지 preview·캡션·상세 링크를 확인한 뒤에만 공유/다운로드와 명시적 활용 기록을 수행한다. one-cut receipt는 채널·산출물 중심으로 짧고, full inbox receipt는 기존 선택 입력을 보존한다. source depth 미달 번역은 `source_incomplete`로 링크/action에서 제외한다. free/signed-out/DB write/publication 경계와 기존 full inbox 기본 동작을 유지한다.
      검증 명령: `pnpm exec vitest run components/premium/plus-global-action-inbox.test.tsx lib/plus-translation-fulfillment.test.ts lib/plus-translation-fulfillment.server.test.ts components/premium/plus-translation-fulfillment-center.test.tsx lib/plus-global-action-inbox.test.ts components/premium/premium-dashboard-content.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP signed-out `/premium`
      상태: code_complete (루프 100 local Plus one-cut/source gate; authenticated Plus/RLS·실제 receipt 저장·translation publication·production deploy 미수행)
      결과: `/premium`에 one-cut action-first surface, PNG blob preview, compact explicit receipt, next-card progression을 연결했다. `source_incomplete`는 공개 `isIndexableMeme` depth gate를 공유하고 localized detail/action link를 차단한다. focused one-cut 1파일 12건, 전체 166파일 1,072건, tsc/lint/build 77/77·signed-out premium 307을 확인했다.

- [x] ID: LOC-016
      문제: 글로벌 홈·검색에는 locale 진입점이 있었지만 공개 탐색 허브가 없어 번역된 밈을 발견하는 흐름이 끊겼다. Plus Global Scout도 원문 필수 텍스트만 검사해 실제 localized detail의 content-depth 공개 게이트와 어긋날 수 있었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 41.7
      의존성: `meme_translations` reviewed/current gate · `isIndexableMeme` · localized route allowlist · sitemap metadata · Plus Global Scout
      완료 조건: 네 SEO locale의 `/explore`가 exact reviewed/current/depth-qualified 카드만 서버 렌더하고, locale당 24개 이상일 때만 indexable active로 본다. 미달 coverage-empty·조회 unavailable·query noindex를 구분하고, 적격 locale만 sitemap/hreflang에 넣는다. Scout도 같은 원문 depth projection을 사용한다. 기존 한국어 explore·Plus 5-card/entitlement 경계와 read-only 운영 조건을 유지한다.
      검증 명령: `pnpm exec vitest run lib/localized-explore.test.ts lib/i18n-routing.test.ts app/sitemap.test.ts lib/plus-global-scout.test.ts lib/plus-global-scout.server.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP `/en|ja|zh|zh-tw/explore` · sitemap · robots
      상태: code_complete (루프 101 local reviewed localized explore; translation publication·authenticated Plus/RLS·production deploy 미수행)
      결과: `app/[locale]/explore/page.tsx`, localized card/copy/loader, route navigation, 24-item sitemap threshold와 Scout depth gate를 연결했다. focused locale/sitemap/routing 30건 + Scout 17건, 전체 167파일 1,077건, tsc/lint/build 81/81·네 locale 200·query noindex·24 localized href·sitemap `<loc>` smoke를 통과했다.

- [x] ID: LOC-017
      문제: Plus Weekly Change Brief가 `/premium` UI locale과 무관하게 원문 한국어 `title`·`summary`·`slug`를 후보에 넣어, 글로벌 구독자에게 번역된 추이 카드처럼 보이면서 한국어 내용을 노출할 수 있었다. 번역 reviewed/current·원문 depth·public moderation gate도 주간 후보에는 적용되지 않았고, localized detail에 trend anchor가 없어 CTA 목적지가 불완전했다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 3
      우선순위 점수: 33.3
      의존성: `buildPlusWeeklyDeltaBrief` · exact reviewed/current `meme_translations` · `isIndexableMeme` · active Plus page query · localized detail trend panel
      완료 조건: `ko`는 기존 source copy를 유지하고, `en`·`ja`·`zh`·`zh-tw`와 UI-only locale은 resolved content locale의 exact reviewed/current·필수 필드·localized slug·approved/limited·`isIndexableMeme` source만 사용한다. 누락/stale/machine/incomplete/shallow/private 후보는 Korean fallback 없이 제외하고 적격 하위 후보로 채운다. KST 7일 positive delta·safety/lifecycle·surfaced exclusion·3개 cap을 유지하며 query unavailable·locale coverage-empty·no-candidate·insufficient-history를 구분한다. free branch는 weekly candidate/translation/metric query를 실행하지 않고, localized CTA는 실제 `#trend-panel-title` anchor에 도착한다.
      검증 명령: `pnpm exec vitest run lib/plus-weekly-brief.test.ts components/premium/plus-weekly-delta-brief.test.tsx lib/i18n-premium.test.ts 'app/[locale]/memes/[key]/page.test.ts'` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP signed-out `/premium`, `/zh-tw/pricing`, `/en/explore`, localized detail
      상태: code_complete (루프 102 local locale-safe Plus weekly brief; reviewer remediation complete; authenticated Plus/live DB·translation publication·production deploy 미수행)
      결과: `buildPlusWeeklyBriefCandidates`에 reviewed/current/required-slug/public/depth gate와 coverage backfill을 추가하고, Premium page를 resolved content locale query로 연결했다. UI-only English route·전용 zh-tw weekly copy·localized detail `MemeTrendPanel` anchor와 free no-weekly-read 경계를 고정했다. 후속 reviewer finding에 따라 한국어 source query 오류를 `unavailable`로 보존하고, 이력은 충분하지만 상승이 없는 후보를 `no_change`로 분리했다. focused 4파일 106건, 전체 167파일 1,087건, tsc/lint/build 81/81·diff check, 새 production 서버의 `/premium` 307·localized detail 200·`lang=en`·`trend-panel-title` smoke를 확인했다.

- [x] ID: PLUS-030
      문제: Plus의 기능은 이미 충분하지만 pricing·active dashboard가 trend radar를 앞세워, 구독 직후 사용자가 체감할 one-cut 결과(검수 밈 선택 → 게시용 카드 준비 → 실제 사용 기록)를 선명하게 약속하지 못했다. checkout signed-out redirect도 locale을 잃고, 결과 흐름의 퍼널 계측이 없었다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: 기존 one-cut Action Inbox·Outcome Snapshot·checkout route·`localizedStaticPath`·5개 locale copy
      완료 조건: 기존 one-cut/Outcome Snapshot 순서를 유지하면서 pricing·active/upgrade copy를 결과 중심으로 정렬한다. pricing·dashboard checkout form은 locale을 전달하고, checkout API는 지원 로케일만 localized pricing `next`로 보존한다. pricing view·checkout start/return·one-cut ready/prepared·receipt saved 이벤트를 추가하되 meme ID·title·URL·private/performance note는 전송하지 않는다. 새 DB table/RPC/migration/payment 상태 판정은 추가하지 않는다.
      검증 명령: `pnpm exec vitest run app/api/billing/checkout/route.test.ts components/premium/pricing-content.test.tsx components/premium/premium-dashboard-content.test.tsx components/premium/plus-global-action-inbox.test.tsx lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP `/en/pricing`, `/zh-tw/pricing`, signed-out `/premium`
      상태: code_complete (루프 103 local Plus value-proof/locale handoff; production 결제·authenticated Plus·migration/RLS·translation publication·production deploy 미수행)
      결과: 5개 핵심 locale의 result-first copy, locale-safe checkout redirect, 6개 privacy-safe Plus 퍼널 이벤트와 regression을 연결했다. focused 5파일 111건, 전체 168파일 1,095건, tsc, lint 0 error/8 warning, network 권한 build 81/81, diff check, `/en/pricing` 200·`/zh-tw/pricing` 200·`/premium` 307 smoke를 확인했다.

- [ ] ID: ACT-001
      문제: Loop 103이 Plus의 one-cut 가치 약속을 local code로 정렬했지만, 실제 결제·entitlement·completion·receipt가 하나의 유료 사용자 흐름으로 연결되는 증거가 없다. local pricing 200은 public production 배포나 authenticated Plus 권한을 증명하지 않으며, 글로벌 reviewed 번역 공급도 448/1,520에 머문다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 4
      우선순위 점수: 25.0
      의존성: clean release candidate SHA · 격리 preview Supabase · completion/receipt migration 선행 스키마 · Unifi test payment 자격증명 · reviewed/current 영어 fixture · 분석 수신처
      완료 조건: production을 건드리지 않고 preview에서 signed-out/Free/active/expired/cross-owner JWT/RLS를 검증한다. 사람이 검수한 영어 fixture 하나로 `/en/pricing`→test payment→webhook/status→active entitlement→one-cut card→명시적 receipt→새로고침 재조회까지 완주하고, 다른 owner는 receipt를 읽지 못한다. Loop 103의 6개 privacy-safe event가 실제 수신처에 도착하며 meme ID·title·URL·private note가 없다.
      검증 명령: preview migration ledger·rollback 확인 · authenticated browser E2E · RPC/RLS negative matrix · analytics receiver audit · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build`
      상태: human_gate (루프 104 — preview DB·결제 테스트 권한·clean RC·reviewed/current 영어 fixture 미확보; 새 기능/production write로 우회하지 않음)
      결과: live read-only endpoint `/en/pricing` 404·`/en/explore` 404·`/premium` 307과 worktree 85 modified/218 untracked를 확인했다. 다음 루프는 선행 조건을 확보한 뒤에만 시작한다.

- [x] ID: PLUS-031
      문제: Plus one-cut Action Inbox가 Creator Pack 준비 CTA와 준비 결과를 추천 카드보다 먼저 렌더해, 구독자가 무엇을 쓸지 확인하기 전에 준비 행동을 만나 결과 흐름이 끊겼다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: 기존 `PlusGlobalActionInbox` · `ActionCard` · Creator Pack export · compact receipt
      완료 조건: active one-cut DOM/시각 순서가 추천 밈→카드/캡션 준비→준비 결과→활용 기록이다. 기존 exact reviewed/current locale href, copy/share, receipt/completion, analytics, empty/unavailable 경계를 유지하고 새 DB/API/schema를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run components/premium/plus-global-action-inbox.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP `/en/pricing`, `/zh-tw/pricing`, `/en/explore`, signed-out `/premium`
      상태: code_complete (루프 105 local presentation-only remediation; ACT-001 production activation·translation publication·deploy 미수행)
      결과: `one_cut`에서만 추천 `ActionCard` 목록을 Creator Pack CTA 앞으로 이동하고, 기본 inbox 순서를 보존했다. one-cut receipt는 준비 블록 뒤·ActionCard 밖에 둔다. focused 1파일 14건, 전체 168파일 1,097건, tsc/lint/build/diff check와 fresh local production route smoke를 통과했으며 독립 코드 리뷰 PASS를 받았다.

- [x] ID: LOC-018
      문제: 글로벌 locale Explore의 `coverage-empty` 상태가 검수 번역을 기다리라는 메시지에서 끝나, 방문자가 한국어 원본 탐색으로 이어질 수 있다는 다음 행동을 알지 못한다.
      사용자 영향: 4
      데이터/법적 위험: 2
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: `app/[locale]/explore/page.tsx` · `LOCALIZED_EXPLORE_COPY` · 한국어 `/explore` route
      완료 조건: 네 SEO locale의 `coverage-empty`에서만 한국어 원본 탐색 CTA를 `/explore`로 제공한다. active 카드와 unavailable 상태는 변경하지 않고, reviewed/current/depth/no-fallback 공개 게이트를 유지한다.
      검증 명령: locale explore focused render test · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · local `/en|ja|zh|zh-tw/explore`
      상태: code_complete (루프 106 local discovery-only CTA; 번역 publication·production coverage·deploy 미수행)
      결과: `coverage-empty`에서만 네 locale copy의 한국어 원본 `/explore` CTA를 렌더하고 active/unavailable에는 추가하지 않았다. focused 2파일 5건, 전체 169파일 1,099건, tsc/lint/build/diff check와 fresh local 네 locale Explore 200, 독립 코드 리뷰 PASS를 통과했다.

- [x] ID: PLUS-032
      문제: 실제 Premium dashboard가 `mode="one_cut"`으로 Action Inbox를 렌더하지만, 성과 입력·평가 후속 UI는 full inbox의 7일 요약 안에만 있어 `성과 입력 대기` 수치가 다음 행동 없는 dead end가 된다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: 기존 `PlusOutcomeFollowUp` · owner-scoped performance/rating API · `PlusGlobalActionInbox` one-cut · Next Move callback
      완료 조건: one-cut + ready follow-up에서 성과 메모와 hit/neutral/miss가 보이고, receipt/Creator Pack 뒤에 렌더된다. locked/empty/unavailable·default inbox·privacy/API 경계를 유지하고 새 DB/API/schema를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run components/premium/plus-global-action-inbox.test.tsx components/premium/plus-outcome-follow-up.test.tsx components/premium/plus-outcome-snapshot.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP `/en/pricing`, `/zh-tw/pricing`, `/en/explore`, signed-out `/premium`
      상태: code_complete (루프 107 local subscription outcome loop; authenticated Plus/RLS/production activation 미수행)
      결과: 기존 `PlusOutcomeFollowUp`을 one-cut ready branch에 연결하고 기존 callback/API/copy를 재사용했다. focused 3파일 22건, 전체 169파일 1,101건, tsc/lint/build/diff check·local route smoke와 독립 코드 리뷰 PASS를 확인했다.

- [x] ID: LOC-019
      문제: 관리자 Plus 번역 수요 큐는 요청 수만 보여주므로, 사람이 제공한 번역 pack의 source snapshot·worklist·중복·unsafe gate와 대조해 실제로 먼저 처리할 locale/밈을 결정하려면 별도 수작업이 필요하다.
      사용자 영향: 4
      데이터/법적 위험: 3
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: `scripts/translation-intake.mjs` JSON report · operator-safe `list_translation_priority_queue` export · 네 locale 공개 공급 gate
      완료 조건: 기존 intake report의 source/worklist/duplicate/unsafe gate를 보존하면서 locale별 missing before/after/delta와 Plus active/actionable 수요를 한 결정론적 report로 제공한다. exact source revision과 locale에 따라 missing/stale/review-needed/ready/unknown을 분류하고 공급이 막힌 행을 먼저 정렬한다. owner ID/private note/번역 본문을 출력하지 않으며 DB/RPC/OpenAI/SQL/publication을 호출하지 않는다.
      검증 명령: `pnpm translation:demand-report:test` · Loop 095 intake preflight + local demand fixture CLI JSON · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 108 report-only local operator tooling; 실제 demand export·authenticated operator·번역 publication·production deploy 미수행)
      결과: `scripts/translation-demand-report.mjs`와 contract test/package scripts를 추가했다. malformed/duplicate/revision mismatch와 failed intake를 fail-closed로 유지하고, private input fields는 결과에서 제거한다. 글로벌 reviewed 공급은 448/1,520 그대로다.

- [x] ID: PLUS-033
      문제: Loop 107에서 one-cut에 성과 메모와 hit/neutral/miss 평가를 연결했지만, 평가 결과로 재계산되는 `Next Move`는 full inbox에서만 보여 구독자가 같은 화면에서 개인화 효과를 확인할 수 없었다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: 기존 `PlusGlobalActionInbox` one-cut · `PlusOutcomeFollowUp` rating callback · `buildPlusNextMove` · owner-scoped rating API
      완료 조건: one-cut 초기 화면은 action-first 순서를 유지하고, 기존 평가가 있거나 현재 평가 저장이 성공한 경우에만 outcome follow-up 뒤에 `Next Move`를 표시한다. 성공 저장 직후 local rating으로 추천을 재정렬하고, 실패/잘못된 응답에서는 노출하지 않는다. full inbox·empty/unavailable·privacy/API 경계와 새 DB/API/schema 부재를 유지한다.
      검증 명령: `pnpm exec vitest run components/premium/plus-global-action-inbox.test.tsx lib/plus-next-move.test.ts components/premium/plus-next-move.test.tsx components/premium/plus-outcome-follow-up.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 109 local one-cut learning handoff; authenticated Plus/RLS·production activation·translation publication·production deploy 미수행)
      결과: one-cut의 rating signal gate와 follow-up 뒤 Next Move를 연결했다. 성공 저장 시 즉시 재정렬하고 실패 저장 시 숨김을 회귀 고정했다. focused 4파일 31건, 전체 169파일 1,106건, tsc/lint/build 81/81·diff check, 독립 code review PASS를 확인했다.

- [x] ID: PLUS-034
      문제: 글로벌 locale 상세에서 Plus 사용자가 번역 검수를 요청할 수 있지만, `requested`·`in_review`가 된 뒤 진행 상황을 확인할 Plus 요청함으로 직접 이동할 수 없어 요청 경험이 단절된다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 125.0
      의존성: 기존 `TranslationPriorityButton` · `/api/translation-priority` · `PlusTranslationFulfillmentCenter` · `#plus-translation-fulfillment-title`
      완료 조건: 확인된 `requested`·`in_review` 상태와 성공 요청 응답 직후에만 기존 `/premium#plus-translation-fulfillment-title` tracking link를 표시한다. malformed 2xx status는 `requested`로 추정하지 않고 fail-closed한다. current reviewed/free/signed-out/terminal/unavailable 상태에는 링크가 없고, 5개 locale copy/fallback·기존 RPC/RLS/privacy 경계를 유지한다.
      검증 명령: `pnpm exec vitest run components/premium/translation-priority-button.test.tsx app/api/translation-priority/route.test.ts lib/i18n-routing.test.ts lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 110 local global Plus handoff; authenticated Plus/RLS·human translation publication·production activation·production deploy 미수행)
      결과: requested/in_review 확인 전용 tracking link와 순수 상태 renderer, malformed response fail-closed를 추가했다. free/signed-out·positive/negative SSR·성공 client transition 회귀를 포함해 focused 4파일 121건, 전체 169파일 1,119건, tsc/lint/build 81/81·diff check, 독립 code review PASS를 확인했다.

- [x] ID: PLUS-035
      문제: 글로벌 localized detail에서 Plus 구독자가 밈을 읽은 뒤 실제로 써 보려면 페이지 아래의 Use Kit을 다시 찾아야 해, 공개 discovery와 구독자의 즉시 활용 결과가 끊긴다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 125.0
      의존성: 기존 MemeUseKit · localized detail facts · clipboard/Web Share · locale-safe pricing gate
      완료 조건: 상세 action row 아래에 기존 Use Kit anchor 진입 CTA를 제공하고, active Plus의 copy/share 성공 뒤 session-only prepared 상태를 표시한다. free/signed-out은 locked pricing gate를 유지하며, AbortError·copy 실패는 완료로 표시하지 않는다. reviewed/current localized facts·5 locale fallback·Save/translation/export·새 DB/API/RPC/persistence 경계를 보존한다.
      검증 명령: `pnpm exec vitest run components/premium/meme-use-kit.test.tsx app/[locale]/memes/[key]/page.test.ts lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local Chromium `/en/memes/ra86attn` CTA fragment/locked pricing smoke
      상태: code_complete (루프 111 local global detail→Use Kit handoff; authenticated Plus/RLS·human translation publication·production activation·production deploy 미수행)
      결과: `Open the Use Kit` CTA, native share·clipboard fallback, session-only prepared feedback과 reload reset 회귀를 추가했다. leader focused 3파일 98건, independent reviewer focused 4파일 100건, 전체 169파일 1,124건, tsc/lint/build 81/81·diff check, local Chromium smoke와 독립 code review PASS를 확인했다.

- [x] ID: PLUS-036
      문제: Global Meme Daily 완료가 score/streak에서 끝나고, 구독자가 검수된 글로벌 밈을 실제로 써 보는 기존 Use Kit 흐름으로 이어지지 않는다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 125.0
      의존성: 기존 GlobalDailyChallenge · localizedMemePath · localized detail Use Kit anchor
      완료 조건: 성공 및 already-completed 상태에서만 score/streak 아래 locale-safe current-locale detail→Use Kit CTA를 제공한다. signed-out/locked/unavailable·completion API·streak·5 locale·reviewed/current·privacy 경계를 보존하고 새 DB/API/RPC/schema/persistence/analytics event를 만들지 않는다.
      검증 명령: `pnpm exec vitest run components/premium/global-daily-challenge.test.tsx lib/global-daily-challenge.test.ts lib/global-daily-challenge.server.test.ts lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local Chromium `/en/daily` and detail Use Kit fragment
      상태: code_complete (루프 112 local Global Daily→Use Kit handoff; authenticated Plus/RLS·production completion write·translation publication·production deploy 미수행)
      결과: completion/completed re-entry next-step CTA와 English/Japanese exact fragment regression을 추가했다. leader focused 4파일 102건, independent reviewer focused 6파일 39건, 전체 169파일 1,125건, tsc/lint/build 81/81·diff check, browser smoke와 독립 code review PASS를 확인했다.

- [x] ID: PLUS-037
      문제: 결제 확인 직후에도 활성 구독자가 `/premium`에서 첫 One-Cut을 직접 찾아야 해, 결제 성공이 즉시 체감 가능한 Plus 행동으로 이어지지 않는다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 125.0
      의존성: 기존 `CheckoutReturnStatus` · `/api/billing/entitlement` · `#plus-global-action-inbox-title` · five-locale Premium copy
      완료 조건: `checkout=return`에서 서버 entitlement가 확인된 경우에만 payment confirmation과 current Plus first One-Cut CTA를 보여준다. exact `/premium#plus-global-action-inbox-title` target, pre-confirmation/timeout/signed-out no-CTA, polling/router.refresh/provider/privacy boundaries와 새 DB/API/RPC/schema/persistence/payment-state logic/analytics event 부재를 보존한다.
      검증 명령: `pnpm exec vitest run components/premium/checkout-return-status.test.tsx lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local Chromium `/premium?checkout=return`
      상태: code_complete (루프 113 local checkout→One-Cut handoff; ACT-001 payment/entitlement/RLS/production deploy 미수행)
      결과: confirmed initial/polling CTA, polling rejection/timeout/no-CTA, signed-out boundary와 5개 locale copy regression을 추가했다. focused 2파일 98건, 전체 170파일 1,135건, tsc/lint/build 81/81·diff check, browser signed-out redirect smoke, independent review PASS를 확인했다.

- [x] ID: LOC-020
      문제: 글로벌 locale 검색에 한국어 결과는 있지만 해당 언어의 reviewed/current 번역이 하나도 없으면, 사용자가 원문 탐색으로 복구할 명시적 다음 행동이 없다.
      사용자 영향: 4
      데이터/법적 위험: 2
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: `app/[locale]/search/page.tsx` · `getLocalizedSearchMemesResult` · existing Korean `/explore` · `LOCALIZED_EXPLORE_COPY`
      완료 조건: `en`·`ja`·`zh`·`zh-tw` query search에서 Korean result > 0, query-localized result = 0, lookup `coverage-empty`일 때만 exact `/explore` CTA를 보여준다. active localized result, unavailable, zero result, existing fallback labels/links, reviewed/current/depth 및 metadata 경계를 유지한다. 새 translation content나 DB/API/persistence/analytics/payment/OpenAI surface는 추가하지 않는다.
      검증 명령: `pnpm exec vitest run 'app/[locale]/search/page.test.ts' 'app/[locale]/search/page.render.test.tsx' lib/meme-translations.test.ts lib/i18n-routing.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local Chromium `/en/search?q=좋다`
      상태: code_complete (루프 114 local localized search recovery; translation publication/coverage/production deploy 미수행)
      결과: 네 locale coverage-empty CTA와 active/unavailable/zero-result no-CTA render matrix, Supabase lookup active/coverage-empty/unavailable 직접 회귀를 추가했다. focused 4파일/48건, 전체 171파일/1,154건, build 81/81, browser `/en/search?q=좋다` → `/explore` click smoke와 독립 review PASS를 확인했다.

- [x] ID: LOC-021
      문제: 글로벌 locale 검색에서 한국어 결과만 남으면 사용자가 원문 Explore로 이동한 뒤에도 기존 번역 요청 영역을 다시 찾아야 해, 글로벌 수요가 Plus 번역 가치로 이어지지 않는다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 125.0
      의존성: existing `localized-search-recovery` · `memePathFrom` · `#global-translation-title` · `TranslationPriorityButton` · five-locale `GLOBAL_SEARCH_COPY`
      완료 조건: successful `coverage-empty` query result에서만 Korean original Explore와 locale copy translation-options CTA를 표시하고, 첫 canonical Korean detail `#global-translation-title`로 연결한다. active/unavailable/zero-result no-CTA, existing detail gates, Korean fallback/query/metadata/analytics/submit boundaries, no new DB/API/RPC/schema/persistence/translation/OpenAI/payment/analytics event.
      검증 명령: `pnpm exec vitest run 'app/[locale]/search/page.test.ts' 'app/[locale]/search/page.render.test.tsx' lib/meme-translations.test.ts lib/i18n-routing.test.ts components/premium/translation-priority-button.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local Chromium `/en/search?q=좋다` → `#global-translation-title`
      상태: code_complete (루프 115 local search→translation-options handoff; authenticated Plus/RLS·human translation publication·production deploy 미수행)
      결과: 네 locale copy와 exact canonical anchor, active/unavailable/zero-result no-CTA를 회귀 고정했다. focused 5파일/63건, 전체 171파일/1,154건, tsc/lint/build 81/81·diff check, browser actual anchor 도착 및 independent review PASS를 확인했다.

- [x] ID: PLUS-038
      문제: Action Inbox가 오늘 완료 후보를 모두 제외하면 empty가 되어, 이미 저장한 current/green 밈을 다시 활용할 다음 행동이 Plus dashboard에서 끊긴다.
      사용자 영향: 5
      데이터/법적 위험: 1
      트래픽 가중치: 3
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 75.0
      의존성: existing `SavedReuseRadar.readyNow` · `PlusNextMove` · `getLocalizedMemeByShortId` · `#meme-use-kit-title`
      완료 조건: Action Inbox `empty` + completion `available`에서만 saved `readyNow` candidate를 Next Move로 연결한다. green/current만 사용하고 completed IDs를 제외한다. ko canonical, en/ja/zh/zh-tw exact reviewed/current/required/depth-qualified content only; missing/stale/query failure/active/unavailable/rating unavailable fail-closed. no new DB/API/RPC/schema/write/analytics/private metadata.
      검증 명령: focused Plus tests · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local Chromium `/premium` signed-out boundary
      상태: code_complete (루프 116 local empty Action Inbox→saved Next Move; authenticated Plus/RLS/production deploy 미수행)
      결과: saved fallback adapter, 5-locale content gate, completed exclusion, Use Kit fragment와 no-private-metadata regression을 추가했다. leader focused 6파일/39건, 전체 171파일/1,158건, tsc/lint/build 81/81·diff check, signed-out browser `/premium`→login redirect, initial review 3 medium 수정 후 fresh independent review PASS를 확인했다.

- [x] ID: PLUS-039
      문제: 기존 Creator Pack은 범용 card만 준비하고 실제 게시 채널을 receipt 단계에서 다시 물어, Plus 구독자가 준비된 결과물을 바로 게시하기까지 한 단계가 끊긴다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: existing `PlusGlobalActionInbox` · `creatorPackFormatForChannel` · localized export GET · `PlusOutcomeReceiptForm` · five-locale Premium copy
      완료 조건: 생성 전에 9개 게시 채널 선택을 요구하고, `instagram`·`tiktok`·`youtube`는 story, 나머지는 card export로 결정론적으로 매핑한다. One-Cut generic completion은 준비 성공 전 숨기고, 성공 뒤에만 선택 채널이 미리 채워진 editable `creator_pack` receipt를 명시적으로 연다. share 취소·일부 export 실패·clipboard 실패는 완료/receipt POST로 오인하지 않는다. story/card preview는 intrinsic ratio를 보존하고 ko/en/ja/zh/zh-tw copy를 제공한다. 새 DB/API/RPC/schema/migration/production write/analytics/OpenAI surface는 추가하지 않는다.
      검증 명령: `pnpm exec vitest run lib/i18n-premium.test.ts lib/plus-creator-pack.test.ts components/premium/plus-global-action-inbox.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local Chromium signed-out `/premium`
      상태: code_complete (루프 117 local channel-ready Creator Pack; authenticated Plus/RLS/receipt production write·translation publication·production deploy 미수행)
      결과: 9채널 format helper, channel-required UI, One-Cut receipt gate, editable prefilled channel, zh-tw copy, intrinsic preview와 share/clipboard fail-closed regression을 추가했다. focused 3파일/127건, 전체 171파일/1,171건, tsc/lint/build 81/81·diff check, signed-out Chromium boundary와 fresh `gpt-5.6-sol` high review PASS를 확인했다.

- [x] ID: PLUS-040
      문제: Loop 117에서 게시 채널을 먼저 선택하게 했지만, 최근 성과가 좋은 채널이 다음 Creator Pack의 기본값에 반영되지 않아 구독자가 매번 같은 선택을 반복한다.
      사용자 영향: 4
      데이터/법적 위험: 2
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 80.0
      의존성: existing `plus_meme_use_receipts` · `PlusOutcomeRatingRow` · `PlusGlobalActionInbox` · five-locale Creator Pack copy
      완료 조건: 기존 owner-scoped 최근 28일 receipt rating의 channel을 사용해 전체 3건 이상·채널별 2건 이상이고 양수인 경우에만 결정론적 추천을 표시한다. hit-rate·sample·최근 완료일·고정 순서 tie-break를 사용하고 neutral/negative/invalid/unavailable는 fail-closed한다. 추천은 초기값일 뿐이며 수동 선택과 늦은 rating 응답이 서로 덮어쓰지 않는다. 기존 story/card export·`creator_pack` receipt·5 locale·privacy/entitlement와 새 DB/API/RPC/schema/migration/write/analytics/OpenAI 경계를 유지한다.
      검증 명령: `pnpm exec vitest run lib/plus-outcome-channel-recommendation.test.ts lib/plus-outcome-ledger.server.test.ts components/premium/plus-global-action-inbox.test.tsx components/premium/plus-outcome-follow-up.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local Chromium `/premium` signed-out 및 `/zh-tw/pricing`
      상태: code_complete (루프 118 local outcome-based channel recommendation; authenticated Plus/RLS/payment/receipt production write·translation publication·production deploy 미수행)
      결과: 순수 추천기·channel-aware rating query/parser·available-only recommendation·manual selection race guard·5 locale copy와 regression을 추가했다. focused 4파일/47건, 전체 172파일/1,182건, tsc/lint/build 81/81·diff check, signed-out premium redirect·번체 pricing 렌더, fresh `gpt-5.6-sol` high verifier PASS를 확인했다.

- [x] ID: PLUS-041
      문제: Creator Pack이 검수된 제목·요약·안전 안내만 묶어, 실제 상황에서 바로 보낼 한 줄을 고르는 Plus 행동이 없었다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 100.0
      의존성: `usage_examples` reviewed/current locale gate · `PlusGlobalScout` · `PlusTranslationFulfillment` · `PlusDailySignal` · `PlusCreatorPack` · five-locale Premium copy
      완료 조건: 한국어 canonical 또는 정확히 최신 reviewed 번역 행의 최대 3개 예문만 Action Inbox Creator Pack facts로 전달한다. One-Cut에서 사용자가 상황을 선택하면 선택한 검수 텍스트를 기존 localized caption·safety·detail link와 함께 share text/preview에 포함하고, 예문이 없으면 새 문장을 생성하지 않는 상태를 표시한다. 외국어→한국어 예문 fallback, DB/API/RPC/schema/migration/write/analytics/OpenAI/publication 자동화는 금지한다.
      검증 명령: `pnpm exec vitest run lib/plus-daily-share-pack.test.ts lib/plus-creator-pack.test.ts lib/plus-global-scout.test.ts lib/plus-global-action-inbox.test.ts lib/plus-translation-fulfillment.test.ts lib/plus-daily-signal-delivery.server.test.ts components/premium/plus-global-action-inbox.test.tsx lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 119 local reviewed usage-example Scenario One-Cut; authenticated Plus/live supply·human translation publication·production deploy 미수행)
      결과: 공통 parser·Scout/Fulfillment/Daily Signal 전달·선택 예문 share text·예문 부재 fail-closed UI와 회귀를 추가했다. focused 8파일/176건, 전체 172파일/1,188건, tsc/lint/build 81/81, One-Cut 실제 렌더 상호작용과 fresh `gpt-5.6-sol` high reviewer PASS를 확인했다.

- [x] ID: PLUS-042
      문제: Loop 119의 Scenario One-Cut은 첫 밈 하나만 상황별 예문을 고를 수 있었다. `/premium`의 후보가 여러 개여도 Creator Pack 결과에는 한 장만 들어가거나, 다중 pack 경로에서는 하나의 example index가 모든 밈에 재사용되어 밈별 문맥성이 끊긴다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: `PlusGlobalActionInbox` one-cut items · reviewed/current `usageExamples` · `PlusCreatorPack` · five-locale Premium copy
      완료 조건: `/premium`은 한 장 One-Cut을 기본으로 유지하되 후보가 2개 이상일 때 명시적 opt-in으로 추가 카드를 포함할 수 있다. 포함한 각 memeId별로 최대 3개의 검수 예문 중 하나를 독립 선택하고, 그 텍스트가 같은 밈의 share text/preview에만 반영된다. 예문이 없는 item은 새 문장을 만들지 않는 상태를 보인다. 기존 locale/current/no-fallback/channel/export/receipt/privacy/entitlement 및 no-new-write 경계를 유지한다.
      검증 명령: `pnpm exec vitest run lib/plus-daily-share-pack.test.ts lib/plus-creator-pack.test.ts lib/plus-global-scout.test.ts lib/plus-global-action-inbox.test.ts lib/plus-translation-fulfillment.test.ts lib/plus-daily-signal-delivery.server.test.ts components/premium/plus-global-action-inbox.test.tsx lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local `/premium` One-Cut component flow
      상태: code_complete (루프 120 local opt-in multi-card Scenario Creator Pack; authenticated Plus/RLS/payment/receipt production write·live translation supply·human publication·production deploy 미수행)
      결과: One-Cut 기본값과 explicit include-more checkbox, memeId keyed selection map, item별 share text projection, 5 locale copy와 no-example 상태를 추가했다. focused 8파일/179건, 전체 172파일/1,191건, tsc/lint/build·diff check와 independent `gpt-5.6-sol` high review PASS를 확인했다.

- [x] ID: LOC-022
      문제: `/admin/translations`의 누락 번역 목록이 원문 최신순만 사용해, 번역 후 실제 글로벌 locale route와 Plus 공급을 열 수 있는 원문을 먼저 처리하지 못한다. Plus 수요 RPC 조회 실패도 대기 요청 없음과 같은 화면으로 축소된다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: existing `isIndexableMeme()` · `content-depth` · `/admin/translations` missing preview · `list_translation_priority_queue`
      완료 조건: 공개 approved/limited 원문을 전체 read-only scan하고 `isIndexableMeme()` 통과 source를 `routeUnlockCandidate`로 표시한다. 후보 우선·updatedAt desc·memeId asc 정렬을 보장하고 limit을 적용한다. `focusMemeId`가 있으면 해당 행을 limit 안에 첫 행으로 예약한다. thin source는 원문 보강 필요로 명시한다. Plus queue RPC 오류는 `unavailable` alert로 분리한다. 기존 GPT-5.6-sol high preview·human save/review/publication, operator guard, locale/focus route와 no-write 경계를 유지한다.
      검증 명령: `pnpm exec vitest run lib/translation-worklist.test.ts lib/actions/admin-translations.test.ts components/admin/translation-coverage-panel.test.tsx components/admin/missing-translation-draft-preview.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · `pnpm translation:check`
      상태: code_complete (루프 121 local route/worklist contract; live translation supply·operator session·Supabase publication·production deploy 미수행)
      결과: 기존 depth gate를 재사용한 source classifier, 전체 스캔 deterministic queue, focused Plus 행 limit 보존, candidate/thin 상태 배지, Plus queue unavailable/empty 분리와 회귀를 추가했다. focused 4파일/30건, 전체 173파일/1,196건, tsc/lint/build 81/81·diff check를 통과했고 fresh `gpt-5.6-sol` high re-review도 PASS였다. translation checker는 기존 448/1,520·누락 1,072·forbidden mutation 18건으로 실패 상태를 정직하게 유지했다.

- [x] ID: ACT-001-LITE
      문제: Loop 117~121의 Plus 결과·번역 계약은 로컬 mock 중심이어서 실제 local Auth/JWT/RLS/receipt 원장을 관통한 증거가 없었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: local Supabase CLI/Docker · existing Plus migrations · seeded public meme · no production credentials
      완료 조건: local-only URL/key guard, temporary reviewed/current English fixture, active/free/canceled/cross-owner JWT/RLS receipt flow, idempotent retry, outcome summary, cleanup를 재현 가능한 명령으로 검증하고 production boundary를 보존한다. full ACT-001 payment activation은 닫지 않는다.
      검증 명령: `supabase db push --local --dry-run` · `supabase db push --local` · `pnpm run plus:activation:local` · `node --check scripts/plus-activation-local.mjs` · `pnpm exec eslint --no-ignore scripts/plus-activation-local.mjs` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check`
      상태: code_complete (루프 122 local activation evidence; payment provider·production Supabase/RLS·live translation publication·deploy 미수행)
      결과: 실제 local HTTP Auth/JWT/RLS로 active Plus의 reviewed/current English receipt·멱등 재시도·outcome summary·owner isolation을 확인하고 free/canceled를 차단했다. 잘못된 URL/key fail-closed와 실행 후 translation/user/receipt 0건 cleanup도 확인했으며 fresh `gpt-5.6-sol` high review PASS, 전체 173파일/1,196건 test·tsc·lint 0 errors/8 warnings·build 81/81을 통과했다. full ACT-001 human gate와 1,072행 번역 공급 게이트는 유지한다.

- [x] ID: PLUS-043
      문제: One-Cut Creator Pack이 공유·영수증 저장까지는 닫혀도, 사용자가 같은 세션에서 결과를 다시 공유하거나 카드 한 장만 다시 저장하려면 이미 성공한 export를 다시 실행해야 했다. receipt 성공 뒤 prepared 결과가 사라지면 Plus 결과의 반복 사용 가치도 끊긴다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: existing `PlusGlobalActionInbox` · retained Blob export result · `PlusOutcomeReceiptForm` · five-locale Premium copy
      완료 조건: 성공한 One-Cut 결과를 session-only Blob으로 유지하고 `Share prepared cards`와 카드별 `Save card again`을 제공한다. receipt 저장 뒤에도 준비 결과를 유지하되 미완료 item만 completion UI에서 제거한다. partial export·native share cancel·clipboard fallback 상태를 보존하고 재공유 중 중복 share/download/create를 막는다. 새 DB/API/RPC/schema/migration/receipt write/analytics/OpenAI/publication은 추가하지 않는다.
      검증 명령: `pnpm exec vitest run components/premium/plus-global-action-inbox.test.tsx lib/plus-creator-pack.test.ts lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm run build` · `git diff --check` · local production route smoke
      상태: code_complete (루프 123 local prepared-artifact reuse; authenticated Plus populated/native share·production receipt/payment·live translation supply·publication·deploy 미수행)
      결과: retained Blob 재공유·개별 재다운로드·receipt 이후 재사용·partial/cancel/concurrency 회귀와 5개 locale copy를 구현했다. focused 3파일/139건, 전체 173파일/1,200건, tsc/lint/build 81/81·route smoke 6/6·fresh `gpt-5.6-sol` high re-review PASS를 확인했다. translation checker는 기존 448/1,520·missing 1,072·forbidden mutation 18건 상태를 유지한다.

- [x] ID: PLUS-044
      문제: Outcome Snapshot과 최근 5건 Follow-up만으로는 Plus 사용자가 자신의 최근 활용 전체를 날짜·채널·평가별로 다시 찾을 수 없어, receipt와 rating이 다음 추천으로 연결되는 개인 작업 기억이 화면에 남지 않는다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: existing `plus_meme_use_receipts` · owner + active Plus RLS · `PlusOutcomeRating` · canonical meme detail route · five-locale outcome copy
      완료 조건: active Plus의 `/premium`에 최근 30일 owner-scoped receipt를 최대 50건 표시하고, 채널·평가 필터·완료일·언어·산출물·성과 메모 상태·밈 상세 링크를 제공한다. non-Plus는 locked, row 없음은 empty, query 오류는 unavailable로 분리한다. `result_url`·`private_note`를 조회하거나 렌더링하지 않고 새 write/API/RPC/schema/migration/analytics/OpenAI/publication은 추가하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-outcome-ledger.server.test.ts components/premium/plus-outcome-history.test.tsx components/premium/plus-outcome-follow-up.test.tsx components/premium/plus-outcome-snapshot.test.tsx components/premium/premium-dashboard-content.test.tsx lib/plus-next-move.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm exec eslint lib/plus-outcome-ledger.ts lib/plus-outcome-ledger.server.ts lib/plus-outcome-history-copy.ts components/premium/plus-outcome-history.tsx components/premium/premium-dashboard-content.tsx 'app/(default)/premium/page.tsx'` · `pnpm build` · `git diff --check` · local production `/premium` signed-out redirect + route smoke
      상태: code_complete (루프 124 local Plus Outcome History; authenticated Plus populated/RLS·production receipt/payment·live translation publication·production deploy 미수행)
      결과: 기존 owner-scoped receipt read와 canonical detail route를 재사용해 30일/50건 bounded history, deterministic date order, channel/rating filter, performance note state, locked/empty/unavailable UI와 5 locale fallback을 추가했다. RSC에는 locale만 전달하고 malformed row는 unavailable로 fail-closed하며, legacy follow-up fallback은 missing-column 오류에만 제한했다. focused 6파일/38건, 전체 174파일/1,213건, tsc/lint/build 81/81을 통과했고 fresh `gpt-5.6-sol` high re-review도 PASS(0 findings)였다. HTTP smoke는 `/rankings` 기존 marker mismatch로 5/6이며 SEO-001 soft-404는 기존 known warning으로 남겼고, signed-out `/premium`·authenticated Plus/RLS·production write는 별도 게이트다.

- [x] ID: PLUS-045
      문제: Plus Daily Signal 이메일이 검수된 밈의 상세 페이지에서 끝나, 이메일을 읽은 뒤 `/premium`에서 오늘 바로 실행할 One-Cut을 다시 찾아야 했다. 로그인 전 query 복귀도 원래 path만 보존해 focus 후보가 끊길 수 있었다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: existing `plus-daily-signal-delivery.server` reviewed/current gate · `PlusGlobalActionInbox` · One-Cut Creator Pack · `proxy` auth return path · existing analytics event types · five-locale Daily Signal copy
      완료 조건: Daily Signal 이메일의 각 후보 CTA가 안전한 `focus`·정확한 locale·`from=daily_signal`을 포함한 `/premium` 경로로 연결된다. `/premium`은 실제 eligible action inbox에 존재하는 후보만 preferred One-Cut으로 올리고, unknown/stale/completed/unsafe 후보는 기존 deterministic 순서로 fallback한다. 로그인 redirect도 전체 query를 `next` 안에 보존한다. `plus_one_cut_ready`·`plus_one_cut_prepared`·`plus_receipt_saved`는 사용자 ID·본문·URL·receipt ID·private note 없이 기존 퍼널만 계측한다. reviewed/current exact-locale/no-fallback, entitlement/RLS, 기존 export/receipt, 5 locale, no-new DB/API/RPC/schema/migration/OpenAI/publication 경계를 유지한다.
      검증 명령: `pnpm exec vitest run lib/plus-daily-signal-routing.test.ts lib/plus-daily-signal.server.test.ts lib/plus-global-action-inbox.test.ts components/premium/plus-global-action-inbox.test.tsx lib/plus-daily-signal-delivery.server.test.ts proxy.test.ts --reporter=dot` · `pnpm test -- --reporter=dot` · `pnpm exec tsc --noEmit --pretty false` · scoped `pnpm exec eslint` · `pnpm build` · `git diff --check` · `pnpm translation:check` · local `next start -p 3100` + Daily Signal focus/login redirect curl
      상태: code_complete (루프 125 local Daily Signal→focused One-Cut; authenticated Plus/RLS/payment/receipt production write·live translation supply/publication·production deploy 미수행)
      결과: 5 locale CTA에 focus/locale/source를 연결하고, exact source-gated action inbox preferred promotion과 completed/unknown fallback, allowlisted proxy login return, PII-free ready/prepared/receipt funnel analytics를 추가했다. focused 6파일/87건, 전체 175파일/1,228건, tsc, scoped lint 0 errors/1 existing `<img>` warning, build 81/81, diff check를 통과했다. local production에서 focused `/premium`은 허용된 `next=/premium?focus=...&locale=...&from=daily_signal`만 보존했고 invalid/duplicate source는 `/premium`, checkout은 `checkout=return`만 보존했다. `translation:check`는 기존 448/1,520·missing 1,072·forbidden mutation 18 및 비-machine reviewed publication 1건으로 실패했다. fresh independent `gpt-5.6-sol` high re-review는 APPROVE였고 prior 2 MEDIUM findings를 해소했으며, explicit duplicate/checkout regression도 추가했다.

- [x] ID: PLUS-046
      문제: Next Move가 ratings를 반영해 다음 후보를 골라도 CTA가 항상 상세 Use Kit으로 이동해, 구독자가 추천을 실제 One-Cut 실행 순서로 바꾸려면 다시 큐를 찾아야 했다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: `PlusGlobalActionInbox` one-cut local state · `PlusNextMove` · existing Creator Pack/receipt busy state · five-locale Next Move copy
      완료 조건: eligible Next Move 후보가 현재 One-Cut Action Inbox에 있고 Creator Pack 준비·receipt·재사용 작업이 잠기지 않았을 때만 인라인 activation button을 제공한다. 클릭하면 후보를 첫 One-Cut 카드로 재배치하고 include-more/example 선택을 초기화하며, live status와 first-card focus를 제공한다. saved-revisit 전용·empty·completed·unavailable·busy/prepared 상태는 기존 상세 Use Kit 링크를 유지한다. 새 DB/API/RPC/schema/migration/write/analytics/OpenAI/publication 자동화는 추가하지 않는다.
      검증 명령: `pnpm exec vitest run components/premium/plus-next-move.test.tsx components/premium/plus-global-action-inbox.test.tsx lib/plus-next-move.test.ts` · `pnpm test` · `pnpm exec eslint components/premium/plus-next-move.tsx components/premium/plus-next-move.test.tsx components/premium/plus-global-action-inbox.tsx components/premium/plus-global-action-inbox.test.tsx lib/plus-next-move.ts lib/plus-next-move-copy.ts` · `pnpm build` · `git diff --check` · local `/premium` authenticated UI flow
      상태: code_complete (루프 126 local Next Move→One-Cut activation; authenticated Plus populated UI·receipt/payment production write·live translation supply/publication·production deploy 미수행)
      결과: `onActivate` callback, five-locale activation/status copy, eligible-only reorder guard, include-more/example reset, status live region와 first-card focus, 기존 detail-link fallback 및 2개 interaction regression을 추가했다. focused 3파일/49건, 전체 175파일/1,230건, build 81/81을 통과했다. scoped lint는 0 errors/1 existing `<img>` warning이었다. local signed-out `/premium`은 `/login?next=%2Fpremium`으로 인증 gate에 도달했으며 credentials/OTP/우회 없이 중단했다.

- [x] ID: LOC-023
      문제: zh Plus 번역 요청 큐와 route-unlock 누락 원문 큐가 분리되어, 운영자가 수요 우선순위를 놓치고 초안 저장 뒤 다음 후보를 다시 찾아야 했다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: existing `list_translation_priority_queue` · `isIndexableMeme()` · `listMissingMemeTranslations` · GPT-5.6 Sol high preview · machine draft CAS save · human review/publication gate
      완료 조건: zh의 translationStatus=null Plus 요청 ID를 누락 번역 worklist 앞에 stable priority로 배치하고, Plus 요청이 없으면 route-unlock·updatedAt desc·memeId asc 순서를 유지한다. fixed limit과 focus reservation을 보존한다. 운영자가 행을 선택할 때만 GPT-5.6 Sol high preview를 실행하고 source revision mismatch는 차단한다. 저장은 machine 초안으로만 남고 reviewed/publication으로 자동 전이하지 않는다. 저장 성공 뒤 다음 후보를 UI에서 선택하지만 다음 GPT 호출은 명시적으로 실행한다. priority RPC unavailable은 empty와 분리한다.
      검증 명령: `pnpm exec vitest run lib/translation-worklist.test.ts lib/actions/admin-translations.test.ts components/admin/missing-translation-draft-preview.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit --pretty false` · scoped `pnpm exec eslint lib/translation-worklist.ts lib/translation-worklist.test.ts lib/actions/admin-translations.ts lib/actions/admin-translations.test.ts 'app/(default)/admin/translations/page.tsx' components/admin/missing-translation-draft-preview.tsx components/admin/missing-translation-draft-preview.test.tsx` · `pnpm build` · `git diff --check` · local `next start` + `/admin/translations` login redirect curl
      상태: code_complete (루프 127 local zh operator batch lane; authenticated operator session·live translation supply·human publication·production deploy 미수행)
      결과: stable priority partition, UUID/limit fail-closed validation, focus/limit preservation, zh lane marker/priority badge/current candidate, explicit preview→machine save→next candidate interaction과 unavailable/empty 경계를 추가했다. focused 3파일/32건, 전체 175파일/1,234건, tsc/lint/build 81/81·diff check를 통과했다. local production `/admin/translations`는 `/login?next=%2Fadmin%2Ftranslations`로 인증 게이트까지 관찰했다. 기존 translation checker artifact 448/1,520·missing 1,072·human publication gate는 변하지 않았다.

- [x] ID: PLUS-047
      문제: Plus Outcome History가 receipt의 locale과 무관하게 항상 한국어 canonical detail link를 보여줘, 실제로 검수된 글로벌 번역이 있어도 사용자가 사용했던 언어의 결과를 다시 열 수 없었다. 반대로 stale/missing 번역을 추측해 locale route로 만들면 공개 SEO·언어 신호가 깨진다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: `plus_meme_use_receipts` owner + active Plus RLS · `meme_translations` reviewed/current gate · `isIndexableLocalizedMeme()` · `localizedMemePath()` · five-locale history copy
      완료 조건: 최근 30일/최대 50건 owner-scoped history가 receipt locale을 기준으로 정확히 reviewed/current·충실도·비어 있지 않은 `reviewed_at`/`reviewed_by` 감사 조건을 통과한 번역에만 `/{locale}/memes/{short_id}-{localized_slug}`를 연결한다. ko는 canonical, stale/missing/incomplete은 Korean fallback, nested translation data 자체를 확인할 수 없으면 row-level unavailable로 닫는다. private note/result URL을 select·DTO·UI에 넣지 않고, UI는 세 link status를 구분하며 unavailable row에 fake link를 만들지 않는다. 새 DB/API/RPC/schema/migration/write/AI/publication 자동화는 추가하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-outcome-ledger.server.test.ts components/premium/plus-outcome-history.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · scoped `pnpm exec eslint lib/plus-outcome-ledger.server.ts lib/plus-outcome-ledger.ts lib/plus-outcome-ledger.server.test.ts lib/plus-outcome-history-copy.ts components/premium/plus-outcome-history.tsx components/premium/plus-outcome-history.test.tsx` · `pnpm build` · local `next start` + `/premium` auth redirect and localized route curl
      상태: code_complete (루프 128 local localized replay; authenticated Plus populated receipt/RLS·live translation supply·human publication·production deploy 미수행)
      결과: 기존 공개 `isIndexableLocalizedMeme()` 판정을 batch nested read 한 번에 재사용하고 root 공개 상태·review audit·localized/Korean fallback/unavailable DTO와 5 locale status copy를 추가했다. focused 2파일/25건, 전체 175파일/1,237건, tsc·scoped lint·network-enabled build를 통과했다. full lint는 0 errors/8 기존 warnings였다. local production `/premium`은 `/login?next=%2Fpremium`으로 인증 게이트를 관찰했고 `/en/memes/meme-1-global-use-en`은 200을 반환했다. sandbox build의 첫 실패는 Supabase DNS 차단이었고 권한 재검증에서 통과했다. Loop 127의 translation checker baseline 448/1,520·missing 1,072·forbidden mutation 18과 human publication gate는 유지된다.

- [x] ID: PLUS-048
      문제: Outcome History는 최근 성과를 보여주지만, 성공한 결과를 다음 방문에 다시 실행하는 경로가 없어 개인 작업 기억이 수동 로그로 끝났다. 같은 밈이 현재 후보에 다시 들어올 때만 rating이 Next Move에 반영되어 과거 hit를 직접 재사용할 수 없었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: `plus_meme_use_receipts` owner + active Plus RLS · existing Outcome History localized/current gate · `PlusGlobalActionInbox` One-Cut · Creator Pack/receipt flow · five-locale copy
      완료 조건: 최근 30일 `hit` receipt 중 현재 `approved/limited`·indexable·green/yellow·rising/active·exact-locale reviewed/current 조건을 서버에서 재검증하고, 통과한 행만 Outcome Replay CTA와 One-Cut first card로 연결한다. receipt locale이 UI locale과 달라도 유지하고 이전 channel을 Creator Pack 기본값으로 사용한다. 오늘 완료 ID 또는 completion unavailable은 replay를 제외한다. query source/duplicate/mixed mode와 unavailable/non-hit/fallback/stale/unsafe 상태는 fail-closed한다. private note/result URL/receipt ID와 새 DB/API/RPC/schema/migration/write/AI/publication 자동화는 추가하지 않는다.
      검증 명령: `pnpm exec vitest run proxy.test.ts lib/plus-outcome-replay-routing.test.ts lib/plus-outcome-ledger.server.test.ts lib/plus-global-action-inbox.test.ts components/premium/plus-outcome-history.test.tsx components/premium/plus-global-action-inbox.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · scoped/full `pnpm exec eslint`/`pnpm lint` · `pnpm build` · `git diff --check` · local `next start` replay/login redirect smoke
      상태: code_complete (루프 129 local Outcome Replay One-Cut; authenticated Plus/RLS·production receipt/payment·live translation supply/publication·production deploy 미수행)
      결과: history CTA·locale/source-safe routing·proxy next preservation·server current safety/translation replay loader·cross-locale inbox injection·prior channel prefill·completion unavailable lock·privacy-safe DTO/UI를 추가했다. focused 6파일/113건, 전체 176파일/1,250건, tsc, full lint 0 errors/8 existing warnings, build 81/81, local smoke와 fresh `gpt-5.6-sol` high review PASS/APPROVE를 통과했다. 기존 translation checker 448/1,520·missing 1,072·forbidden mutation 18과 human publication gate는 유지된다.

- [x] ID: ACT-001-RC
      문제: Loop 122 local activation과 Loop 129 replay는 실제 preview payment→entitlement→eligible action→receipt→outcome 경로를 증명하지 못했다. 단순 env flag나 401/403을 schema 증거로 인정하면 잘못된 key·오래된 배포·미적용 migration이 READY처럼 보일 수 있다.
      사용자 영향: 5
      데이터/법적 위험: 5
      트래픽 가중치: 5
      해결 확신: 4
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: authenticated preview JWT · PostgREST OpenAPI catalog · Unifi test payment evidence · target migration ledger · privacy/provider/outcome/retention review · release SHA header
      완료 조건: read-only GET/manual redirect만으로 public route·authenticated core access·actual core relation/RPC catalog·local migration source·target ledger·clean preview SHA·Unifi test E2E·privacy artifact를 검증하고, artifact bytes SHA-256/realpath/timestamp 및 세 route 동일 release SHA를 통과할 때만 READY가 된다. missing credential/schema/evidence·401/403·mixed SHA·stale/future/symlink/URL artifact는 BLOCKED로 남고 supporting relation degraded를 별도 표시한다.
      검증 명령: `pnpm plus:activation:preflight:test` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local `next start -p 3100` + route/preflight smoke
      상태: code_complete (루프 130 local read-only preflight; authenticated preview/production schema·payment·privacy legal review·deploy 미수행)
      결과: `scripts/plus-activation-preflight.mjs`와 contract test, `X-MemeCatch-Release-Sha` response marker, package test command를 추가했다. 실제 HTTP mock에서 authenticated JWT/catalog, invalid JWT, 401/403, manual redirect, timeout, mixed/missing SHA, CLI exit/redaction, artifact hash/URL/symlink/future timestamp를 검증했다. full 176파일/1,250건, tsc, lint 0 errors/8 warnings, build 81/81, fresh `gpt-5.6-sol` high review PASS/APPROVE를 통과했으며 production write/deploy는 수행하지 않았다.

- [x] ID: LOC-024
      문제: Plus 번역 요청은 네 SEO locale에서 발생하지만 관리자 누락 worklist의 수요 우선화는 `zh`에만
      연결되어 있었다. 또한 사용자가 `ja`·`zh`·`zh-tw` 번역을 요청해도 UI locale이 `en`이면 ready 결과가
      Action Inbox에서 사라져 글로벌 구독 가치가 실제 사용으로 이어지지 않았다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: 기존 `plus_translation_requests`·`list_translation_priority_queue`·`translation-worklist`·
      `PlusTranslationFulfillment`·`PlusGlobalActionInbox`·`localizedMemePath`
      완료 조건: 선택한 모든 SEO locale에서 Plus 요청 중 실제 누락(`translationStatus=null`)인 밈만
      missing worklist 앞에 deterministic하게 배치한다. reviewed/current ready 번역은 UI locale이 달라도
      exact item locale과 localized href/share text를 유지하고, 같은 밈에 여러 ready 번역이 있으면 UI locale을
      우선한다. machine/stale/source-incomplete는 ready로 만들지 않으며 기존 cap/completion/privacy/publication
      경계를 보존한다. 카드에는 번역 locale을 명시한다.
      검증 명령: `pnpm exec vitest run lib/translation-worklist.test.ts lib/plus-global-action-inbox.test.ts components/premium/plus-global-action-inbox.test.tsx lib/actions/admin-translations.test.ts components/admin/missing-translation-draft-preview.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route/auth smoke
      상태: code_complete (루프 131 — local cross-locale fulfillment; authenticated Plus/RLS·human translation publication·production deploy 미수행)
      결과: `missingTranslationPriorityMemeIds`로 네 locale의 Plus missing 요청을 worklist에 연결하고, locale-scoped operator RPC가 DB limit 전에 필터링하도록 migration을 추가했다. ready fulfillment를 UI locale-independent로 선택하되 exact UI locale을 우선했고 ActionCard에 실제 언어명을 표시했다. focused 6파일/89건, 전체 177파일/1,255건, tsc/lint/build 81/81·diff check·local route smoke와 fresh `gpt-5.6-sol` high review를 통과했으며 production migration 적용/write/deploy는 수행하지 않았다.

- [x] ID: GLO-007
      문제: 글로벌 locale route와 Plus fulfillment surface는 준비됐지만, 실제 reviewed/current 번역 공급을 늘릴 수 있는
      source-locked 4-locale 입력 pack이 없어 운영자 검수 큐로 넘길 단일 단위가 없었다. machine draft를 공개 공급량으로
      오인하면 원문 revision drift·언어 오류·검수 전 노출 위험이 생긴다.
      사용자 영향: 5
      데이터/법적 위험: 5
      트래픽 가중치: 5
      해결 확신: 4
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: live approved meme source snapshot · `translation:intake` worklist/source/fidelity gate · machine-only SQL checker · operator `gpt-5.6-sol` high review
      완료 조건: 공개 후보 하나에 대해 `en`·`ja`·`zh`·`zh-tw`가 동일 source revision으로 정확히 하나씩 존재하고, source fields/CAS·locale/fidelity·duplicate/worklist 검증을 통과한 machine-only SQL artifact를 생성한다. reviewed 승격·Supabase 적용·공개·배포는 하지 않는다.
      검증 명령: `pnpm translation:intake:test` · `node scripts/translate-memes-mlx-linked.test.mjs` · `node scripts/translation-batch-check.test.mjs` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route smoke · live read-only route check
      상태: code_complete (루프 132 — `fmbbud58` source-locked machine draft; operator review·human publication·production deploy 미수행)
      결과: report-only intake와 `--emit-artifact --require-complete`가 4/4 row·locale별 missing 1→0·duplicate/source mismatch/out-of-worklist 0을 통과했고, 네 SQL 파일을 생성했다. batch checker는 expected/actual 4·forbidden mutation 0·missing 0이다. local production `/en/explore`·`/en/pricing`·canonical meme·search 200, signed-out `/premium`·`/admin/translations` 307을 확인했지만 live `/en/explore`·`/en/pricing`·`/en/search`는 404라 deploy/publication gate로 남겼다.

- [x] ID: PLUS-049
      문제: One-Cut은 활용 완료 영수증을 남길 수 있었지만 실제 결과 URL 없이도 완료되어, Plus가 사용자의 실제 활용 결과를 기억·재열람하는 증거가 비어 있었다. `result_url`은 API와 DB에 이미 저장할 수 있었지만 compact One-Cut UI에서 숨겨졌고, Outcome History select/DTO/UI가 이를 버렸다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: 기존 `plus_meme_use_receipts.result_url`·`record_plus_meme_use_receipt`·One-Cut receipt form·owner-scoped Outcome History·external URL safety check
      완료 조건: One-Cut `mode=one_cut`은 유효한 `http/https` 결과 URL 없이는 RPC에 도달하지 않고, bulk receipt의 선택 URL 호환성은 유지한다. 최근 owner-scoped History는 URL을 private note와 분리해 안전하게 읽고, 저장된 결과만 외부 새 탭 링크로 노출하며 URL이 없는 legacy row는 링크 없음으로 표시한다. URL fetch·자동 게시·새 DB/API/RPC/schema/migration은 추가하지 않는다.
      검증 명령: `pnpm exec vitest run app/api/plus/action-inbox/complete/route.test.ts lib/plus-outcome-ledger.server.test.ts components/premium/plus-outcome-history.test.tsx components/premium/plus-global-action-inbox.test.tsx lib/plus-outcome-copy.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · scoped/full `pnpm exec eslint`/`pnpm lint` · `pnpm build` · `git diff --check` · local production route/auth smoke
      상태: code_complete (루프 133 local One-Cut result evidence; authenticated Plus/RLS·실제 외부 게시 결과·production deploy 미수행)
      결과: compact One-Cut form에 required result URL을 추가하고 `mode=one_cut` API validation을 통과시켰다. History query에 기존 `result_url`을 추가하고 http/https fail-closed parser·unsafe row 단위 drop·owner-safe DTO·새 탭 result link/legacy missing copy를 연결했다. focused 5파일/97건, 전체 177파일/1,260건, tsc/lint/build 81/81·diff check를 통과했다. 실제 authenticated Plus row와 외부 플랫폼 게시 성공은 증명하지 않는다.

- [x] ID: PLUS-050
      문제: Loop 133에서 One-Cut이 실제 결과 URL을 저장하고 Outcome History에서 다시 열 수 있게 되었지만, 구독자가 Plus 첫 화면에서 누적된 결과 증거의 크기를 바로 체감할 수 없었다. 결과 URL이 History까지 스크롤해야만 보이면 결과 중심 구독 가치가 약하게 느껴진다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 1
      우선순위 점수: 100.0
      의존성: 기존 owner-scoped `PlusOutcomeHistory` sanitized DTO · `PlusOutcomeSnapshot` · 5 locale copy · History anchor
      완료 조건: ready Outcome Snapshot에 기존 History item의 안전한 `resultUrl` 존재 수를 집계-only로 표시하고, 1건 이상일 때만 History anchor CTA를 제공한다. locked/empty/unavailable, zero-result, private field, receipt ID, URL value, new DB/API/RPC/schema/migration/write/analytics/OpenAI/publication 경계를 유지한다.
      검증 명령: `pnpm exec vitest run components/premium/plus-outcome-snapshot.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit --pretty false` · scoped/full `pnpm exec eslint`/`pnpm lint` · `pnpm build` · `git diff --check` · local production `/en/pricing`, `/zh-tw/pricing`, `/en/explore`, signed-out `/premium`
      상태: code_complete (루프 134 local result-proof snapshot; authenticated Plus/RLS·실제 result URL·외부 게시·production deploy 미수행)
      결과: Premium RSC가 기존 History의 상태와 ready 행의 `resultUrl` 개수만 계산해 Snapshot에 전달하고, Snapshot은 5개 locale의 `savedResults` metric과 양수일 때만 `#plus-outcome-history-title` CTA를 렌더한다. empty History만 Snapshot empty로 남기며, ready History는 결과 수가 0이어도 성공한 조회로서 0건을 표시한다. locked/unavailable History는 fail-closed unavailable로 닫고, 다른 Outcome 신호가 비어 있어도 ready History는 ready로 표시한다. focused 6건, 전체 177파일/1,263건, tsc/lint/build 81/81·diff check와 local HTTP smoke를 통과했다. URL 값·private note·receipt ID는 Snapshot으로 전달하지 않았다.

- [x] ID: PLUS-051
      문제: Loop 134에서 저장 결과의 존재 수는 첫 화면에 보였지만, Outcome History의 미평가 기록은 `Not rated` 상태로만 남아 사용·결과·평가·다음 추천 루프가 끊겼다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 4
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 50.0
      의존성: 기존 owner-scoped `PlusOutcomeHistory` · `record_plus_meme_use_rating` · `/api/plus/outcome-ledger/rating` · `PlusOutcomeSnapshot` · 5 locale copy
      완료 조건: ready History에서 `performanceRating=null`인 행에만 rating CTA를 표시하고, `hit`·`neutral`·`miss`를 기존 인증 API로 저장한다. 응답 계약이 맞을 때만 카드가 즉시 rated로 바뀌고 `router.refresh()`로 Snapshot의 평가 수를 재조회한다. 이미 평가된 행과 locked/empty/unavailable 상태에는 CTA가 없고, 결과 링크·replay·private field 경계를 유지한다. 새 schema/API/RPC/migration/write/publication은 추가하지 않는다.
      검증 명령: `pnpm exec vitest run components/premium/plus-outcome-history.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit --pretty false` · scoped/full `pnpm exec eslint`/`pnpm lint` · `pnpm build` · local production route smoke · Playwright pricing/signed-out Premium QA
      상태: code_complete (루프 135 local Outcome rating reopen; authenticated Plus/RLS·실제 rating POST·production deploy 미수행)
      결과: History DTO에 opaque `receiptId`만 추가하고 5개 locale CTA·rating 선택·응답 검증·로컬 상태 갱신·server refresh를 연결했다. focused 6건, 전체 177파일/1,264건, tsc/lint/build 81/81·local route/browser QA와 independent `gpt-5.6-sol` high review PASS를 통과했다. 기존 `awaitingPerformanceCount`는 performance note 대기 계약으로 변경하지 않았다.

- [x] ID: GLO-008
      문제: Plus 번역 수요 큐와 글로벌 coverage 표가 분리되어, 운영자가 공개 원문 품질·누락·stale·Plus 수요를 함께 보고 다음 검수 대상을 고르기 어려웠다. 수요 행이 실제 색인 가능한 원문인지도 큐에서 바로 확인할 수 없었다.
      사용자 영향: 5
      데이터/법적 위험: 5
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 locale-scoped `list_translation_priority_queue` · read-only `plus_translation_requests` operator policy · `getTranslationCoverage` · `isIndexableMeme()` · `TranslationPriorityQueue` · operator `gpt-5.6-sol` high review/publication gate
      완료 조건: Plus priority 행의 공개 원문이 `isIndexableMeme()`을 통과하고 translation row가 없을 때만 `routeUnlockCandidate`로 표시한다. 네 SEO locale을 로케일별 다음 행동 카드로 합치고, `plus_missing`·`plus_review`·`review`·`stale`·`missing`·`ready` 링크가 실제 기존 관리자 경로로 이동한다. priority/coverage 오류는 0건으로 위장하지 않으며 GPT 호출·machine 저장·reviewed 공개·production write/deploy는 자동화하지 않는다.
      검증 명령: `pnpm exec vitest run lib/translation-supply-control-tower.test.ts components/admin/translation-supply-control-tower.test.tsx components/admin/missing-translation-draft-preview.test.tsx lib/actions/admin-translations.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · changed-file `pnpm exec eslint` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route/auth smoke
      상태: code_complete (루프 136 local global supply control tower; operator session·human translation publication·production deploy 미수행)
      결과: 현재 작업 큐와 전역 공급 조회를 분리하고, active demand 1000행 pagination·200-ID translation batching·source-depth route-unlock 판정·deterministic priority/locale state helper와 관리자 Control Tower를 추가했다. focused 4파일/36건, 전체 179파일/1,270건, tsc·full lint 0 errors/8 existing warnings·build 81/81·local 4 route 200·signed-out admin 307·independent `gpt-5.6-sol` high review PASS를 통과했다. live global route 404와 translation baseline 448/1,520·missing 1,072는 변경하지 않았다.

- [x] ID: PLUS-052
      문제: Plus의 첫 actionable outcome은 이미 Action Inbox→Creator Pack→실제 사용 기록→결과/평가로 연결되어 있었지만, 요청 로케일에 exact-current reviewed translation이 없으면 Global Scout가 empty가 되어 구독 직후 첫 행동이 사라졌다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 100.0
      의존성: 기존 public/safe/content-depth/current source gate · `meme_translations.status=reviewed` · 영어 localized route · Plus Action Inbox/One-Cut
      완료 조건: `ko`·`en` 외 지원 로케일에서 요청 로케일의 eligible deck이 비어 있을 때만 같은 source revision의 영어 reviewed translation을 읽기 전용 fallback으로 사용하고, fallback item의 locale/URL을 `en`으로 유지한다. 요청 로케일에 card가 있으면 영어 query를 실행하지 않으며, 요청 read가 unavailable이면 empty로 위장하지 않는다. Scout와 첫 One-Cut card는 fallback 콘텐츠 언어를 표시하고, 새 DB/API/RPC/schema/migration/write/게시/AI 자동화를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-global-scout.test.ts lib/plus-global-scout.server.test.ts components/premium/plus-global-scout.test.tsx components/premium/plus-global-action-inbox.test.tsx lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route/auth smoke · live read-only route check
      상태: code_complete (루프 137 — local first-outcome reliability; first review HIGH 1건 수정 후 final independent `gpt-5.6-sol` high PASS/APPROVE·0 findings; human translation publication·authenticated Plus/RLS·production deploy 미수행)
      결과: 지원 로케일의 empty reviewed deck에 한해 exact-current 영어 fallback을 추가하고 `item.locale` 기반 영어 detail route와 Scout/Action Inbox 콘텐츠 언어 표시를 연결했다. focused 5파일/166건, 전체 179파일/1,275건, tsc/lint/build 81/81·diff check·local route/auth smoke를 통과했으며 live 글로벌 route 3개는 404로 확인했다.

- [x] ID: PLUS-053
      문제: Loop 137에서 번역 coverage 공백에서도 Global Scout 첫 카드를 유지했지만, 신규 Plus 구독자는 Premium 화면에서 다시 `/daily`로 이동해야 검수된 글로벌 콘텐츠를 실제로 소비할 수 있었다. 링크 카드만으로는 구독 직후 이해·활용 루프가 끊겼다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 75.0
      의존성: 기존 `loadGlobalDailyChallenge`·`GlobalDailyChallenge`·`/api/plus/global-daily/complete`·`#meme-use-kit-title`·active Plus entitlement
      완료 조건: active Plus Premium 첫 화면에서 기존 검수/current/safety-gated 3문제 challenge를 직접 시작·완료할 수 있고, 완료 후 첫 밈의 기존 Use Kit으로 이동한다. `ready`·`completed`·`unavailable` 상태를 숨기지 않고, standalone `/daily`, free/non-Premium dashboard, streak/completion API 계약을 변경하지 않는다. 새 DB/API/RPC/schema/migration/write/AI 자동화를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run components/premium/premium-dashboard-content.test.tsx components/premium/global-daily-challenge.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · changed-file `pnpm exec eslint` · `pnpm build` · `git diff --check` · local production `/premium` auth redirect/public route smoke
      상태: code_complete (루프 138 — local Premium first-session starter; independent `gpt-5.6-sol` high PASS/APPROVE·0 findings; authenticated Plus/RLS·실제 completion write·translation publication·production deploy 미수행)
      결과: Premium RSC가 active Plus일 때만 기존 Global Daily loader를 병렬 공급하고, Dashboard가 Action/Outcome 다음에 동일 challenge component를 렌더한다. embedded node가 있을 때만 중복 `/daily` entry를 제거하고 loader unavailable은 그대로 노출한다. page-level entitlement gate와 전체 placement 회귀를 추가해 focused 14건, 전체 180파일/1,278건, tsc/full lint/build 81/81·diff check·local `/premium` 307·글로벌 public routes 200 및 independent high review PASS를 통과했다.

- [x] ID: PLUS-054
      문제: Loop 138에서 Premium 안에서 Global Daily 3문제를 바로 풀 수 있게 했지만, 완료 후 첫 밈을 Use Kit으로 보내기 전에 그 밈의 원산지·활성 시장·현지 주의와 검수된 변형을 확인하는 글로벌 맥락이 없었다. 구독자는 콘텐츠를 소비해도 글로벌 서비스로서의 차이를 다시 상세 페이지에서 찾아야 했다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 `loadGlobalDailyChallenge`·`QuizQuestion.meme.id` 메타데이터·`getMemeMarketPassport`·`MemeMarketPassport`·active Plus entitlement·`#meme-use-kit-title`
      완료 조건: active Plus의 Global Daily가 `ready` 또는 `completed`이고 첫 문항 원본 ID가 있을 때만 기존 read-only Market Passport를 조회한다. Passport는 실제 reviewed profile/variant만 포함하고, 합성 origin은 노출하지 않으며, challenge 완료 상태에서만 Passport를 렌더한 뒤 기존 Use Kit handoff를 유지한다. signed-out/free/locked/unavailable·standalone `/daily`·completion API/streak을 변경하지 않는다. 새 DB/API/RPC/schema/migration/write/AI/publication/deploy는 추가하지 않는다.
      검증 명령: `pnpm exec vitest run components/premium/global-daily-challenge.test.tsx 'app/(default)/premium/page.test.tsx' lib/global-daily-challenge.test.ts lib/quiz.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production `/premium` auth redirect/public route smoke
      상태: code_complete (루프 139 — local Premium Global Market Passport handoff; independent `gpt-5.6-sol` high 검수 결과는 review artifact에 기록; authenticated Plus/RLS·실제 passport 공급·completion write·translation publication·production deploy 미수행)
      결과: Global Daily 질문에 optional `id`를 보존하고, Premium RSC가 active Plus ready/completed의 첫 문항만 기존 `getMemeMarketPassport`로 읽는다. loader는 reviewed/empty/unavailable을 구분하고 실제 reviewed profile/variant만 반환하며, 합성 origin은 제거했다. Premium은 reviewed일 때만 완료 Passport를 노출하고 ready 상태에서는 숨긴다. 같은 세션의 완료 전→후 전이와 fallback-only/read-error/partial-reviewed 회귀를 추가했다. focused 52건, 전체 181파일/1,283건, tsc/lint/build 81/81·diff check·local route/auth smoke를 통과했다.

- [x] ID: PLUS-055
      문제: Loop 139가 Premium Global Daily 완료 뒤 첫 문항의 Market Passport와 Use Kit만 연결해, 함께 검수한 두 번째·세 번째 문항은 완료·재방문 화면에서 소비되지 않았다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 `GlobalDailyChallenge.questions` 3문항·`localizedMemePath()`·Market Passport·`#meme-use-kit-title`·active Premium entitlement
      완료 조건: active Premium의 같은 세션 완료 또는 already-completed 재방문 화면에서 기존 3문항을 원래 순서로 모두 복습하고, 각 문항의 정답 의미·안전 신호·exact-locale 상세 link를 제공한다. 기존 Passport와 첫 Use Kit handoff, standalone `/daily`, completion/streak semantics를 유지한다. malformed answer contract는 fail-closed하며 새 DB/API/RPC/schema/migration/write/AI/analytics/publication/deploy를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run 'lib/global-daily-challenge.test.ts' 'lib/global-daily-challenge.server.test.ts' 'components/premium/global-daily-challenge.test.tsx' 'app/(default)/premium/page.test.tsx'` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route smoke
      상태: code_complete (루프 140 — local Premium 3-Meme Review Shelf; independent `gpt-5.6-sol` high PASS/APPROVE·0 findings; authenticated Plus/RLS·실제 completion write·passport/translation supply·production deploy 미수행)
      결과: Premium에만 opt-in review shelf를 연결해 3개 문항의 제목·뜻·안전 신호·locale 상세를 보존하고, builder와 UI에서 malformed `answerIndex`를 fail-closed했다. 고유 heading id/composite key와 44px target을 적용했으며, focused 25건·전체 181파일/1,291건·tsc/lint/build 81/81·diff check·local route smoke를 통과했다.

- [x] ID: PLUS-056
      문제: Loop 140의 Premium Review Shelf가 3개 문항을 모두 소비해도, Global Daily 후보 builder가 localized detail route의 기존 source-depth/indexable 계약을 재사용하지 않아 thin source가 전역 콘텐츠 후보가 될 수 있었다. 또한 각 복습 항목은 상세 진입까지만 표현해 Use Kit 목적지가 CTA 계약에 드러나지 않았다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 `isIndexableMeme()`·`content-depth`·`loadGlobalDailyChallenge`·`localizedMemePath()`·`#meme-use-kit-title`
      완료 조건: source depth가 localized detail과 동일한 후보만 Global Daily에 들어가고, Premium 완료/재방문 Review Shelf의 3개 CTA가 5개 locale에서 각각 Use Kit anchor로 이어진다. malformed shelf와 thin source는 fail-closed하고 standalone `/daily`·기존 completion/streak·Market Passport를 유지한다. 새 DB/API/RPC/schema/migration/write/publication/deploy를 추가하지 않는다.
      검증 명령: 집중 Global Daily 3파일 회귀 · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route smoke · independent `gpt-5.6-sol` high review
      상태: code_complete (루프 141 — route-safe Global Daily supply + 3-Meme Use Kit shelf; independent `gpt-5.6-sol` high PASS/APPROVE·0 findings; authenticated Plus/RLS·translation publication·production deploy 미수행)
      결과: `buildGlobalDailyCandidate()`가 기존 `isIndexableMeme()`를 재사용하고 server select가 필요한 depth 관계를 공급한다. Premium shelf의 세 CTA에 locale-safe `#meme-use-kit-title`을 붙였으며 opt-in이 있는 경우 first-only next-step을 숨기고 malformed 입력은 shelf/fallback 모두 닫는다. 집중 24건, 전체 181파일/1,292건, tsc/lint/build 81/81·diff check·local route smoke를 통과했다.

- [x] ID: PLUS-057
      문제: UI는 19개 로케일을 지원하지만 Premium Global Daily·Global Scout·standalone `/daily`가 UI 언어와 실제 검수 콘텐츠 언어를 같은 값으로 취급할 여지가 있었다. UI-only 로케일에서 영어 검수 콘텐츠를 제공해도 링크·`lang`·완료 기록·분석이 표시 언어처럼 보일 수 있어 글로벌 구독 가치와 provenance가 흐려졌다.
      사용자 영향: 5
      데이터/법적 위험: 2
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 `resolvePlusContentLocale()`·`loadGlobalDailyChallenge()`·`loadPlusGlobalScout()`·`GlobalDailyChallenge` completion API·`localizedMemePath()`
      완료 조건: UI-only 로케일은 기존 reviewed/current 영어 콘텐츠를 명시적으로 사용하고 콘텐츠 언어를 고지한다. 실제 content locale은 detail/Use Kit link·completion POST·primary analytics에 사용하고 display locale은 날짜/provenance에만 사용한다. Global Daily 5-locale reviewed/current/source-depth gate와 Scout unavailable/empty semantics, core 5개 로케일, standalone `/daily`를 유지한다. 새 DB/API/RPC/schema/migration/write/publication/deploy는 추가하지 않는다.
      검증 명령: focused Global Daily/Scout/Premium 회귀 · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route/SSR locale-cookie smoke · independent `gpt-5.6-sol` high review
      상태: code_complete (루프 142 — locale-honest Premium Global Session; authenticated Plus/RLS·실제 completion write·translation publication·live route 공급·production deploy 미수행)
      결과: `displayLocale`을 Global Daily/Scout에 추가하고 실제 콘텐츠 locale을 route·POST·analytics·`lang`의 source of truth로 유지했다. `/daily` UI-only locale은 영어 content locale로 정규화하고 언어 고지를 SSR에 노출한다. focused 36건, 전체 181파일/1,295건, tsc/lint/build 81/81·diff check·local HTTP/SSR smoke를 통과했다.

- [x] ID: PLUS-058
      문제: Premium에는 Outcome Snapshot·History·Follow-up·Rating·Next Move·Replay가 있었지만, 최근 사용자가 좋았다고 평가한 활용을 다시 시작하는 진입점이 History 안에만 있어 구독 가치가 다음 사용으로 짧게 이어지지 않았다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 7일 Outcome Summary·owner-scoped 30일 Outcome History·completion read·D-075 Replay routing
      완료 조건: 최근 7일 `hit` 자기 평가 중 현재 localized/current/safe replay path를 가진 최신 1건만 Snapshot promotion으로 제공한다. 오늘 completion이 있거나 completion read가 unavailable이면 fail-closed하고, active replay에서는 Snapshot/History의 중복 CTA를 제거한다. 결과 URL·성과 메모·receipt/private ID를 새 UI에 노출하지 않으며 새 DB/API/RPC/schema/migration/write/publication/deploy를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run 'app/(default)/premium/page.test.tsx' components/premium/plus-outcome-snapshot.test.tsx components/premium/plus-outcome-history.test.tsx` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route/auth smoke · independent `gpt-5.6-sol` high review
      상태: code_complete (루프 143 — local Seven-Day Winning Replay; independent `gpt-5.6-sol` high PASS/APPROVE·0 findings; authenticated Plus/RLS·실제 receipt/completion write·external performance·translation publication·production deploy 미수행)
      결과: 기존 replay path를 재사용해 Snapshot에 정직한 self-rated reuse CTA를 추가하고, completion/read unavailable·active replay·shortId+locale identity를 fail-closed로 고정했다. focused 20건, 전체 181파일/1,300건, tsc/lint/build 81/81·diff check·local `/premium` 307·replay 307·`/en|ja/explore` 200을 통과했다.

- [x] ID: GLO-009
      문제: Market Passport의 reviewed 변형 관계만으로 현재 UI locale 상세 경로를 조합해, 대상 번역이 missing/stale/incomplete/thin이어도 404 또는 비색인 문서 링크가 노출될 수 있었다. 조회 장애도 빈 변형 목록으로 오인될 수 있었다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 `getMemeMarketPassport()`·`getLocalizedSearchMemesResult()`·`isIndexableMeme()`·`localizedMemePath()`·Market Passport UI·Premium content locale
      완료 조건: 한국어 target은 approved/limited + `isIndexableMeme()`을 통과한 canonical href만 노출한다. `en`·`ja`·`zh`·`zh-tw` target은 exact reviewed/current/required/source-depth를 통과한 번역의 서버 확정 slug/title/href만 노출한다. localized read unavailable은 별도 unavailable 상태로, coverage-empty만 empty 상태로 표시하며 기존 Premium/상세/Global Daily 계약을 유지한다.
      검증 명령: `pnpm exec vitest run lib/meme-market-passport.test.ts lib/meme-market-passport.server.test.ts components/meme-market-passport.test.tsx 'app/(default)/premium/page.test.tsx'` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production route smoke · independent `gpt-5.6-sol` high review
      상태: code_complete (루프 144 — local route-safe Market Passport variants; fresh independent `gpt-5.6-sol` high PASS/APPROVE; authenticated Plus/RLS·live passport/translation supply·publication·production deploy 미수행)
      결과: Passport variant DTO에 서버 확정 `targetHref`를 추가하고 컴포넌트의 URL 재조합을 제거했다. 한국어 source-depth gate와 다국어 exact localized bulk gate를 적용했으며, unavailable/empty copy와 Premium content locale 전달 회귀를 추가했다. focused 16건, 전체 181파일/1,304건, tsc/lint/build 81/81·diff check·local `/premium`·Replay 307 및 `/en|ja/explore`·`/en|ja/daily` 200을 통과했다.

- [x] ID: ACT-001-NEGATIVE-INTEGRITY
      문제: 동일일 Plus receipt가 이미 존재하면 channel·locale·artifact·결과 URL·메모가 달라도 기존 receipt ID를 성공으로 반환할 수 있어, 유료 활용 기록의 의미가 바뀐 것을 성공으로 오인할 수 있었다.
      사용자 영향: 5
      데이터/법적 위험: 5
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 `record_plus_meme_use_receipt`·`/api/plus/action-inbox/complete`·One-Cut Creator Pack·owner-scoped RLS·local ACT-001 runner
      완료 조건: 여섯 의미 필드가 동일한 retry만 멱등 성공하고, 차이가 있으면 `receipt_conflict`/HTTP 409로 fail-closed한다. canonical trim 값과 race-safe insert branch를 동일하게 적용하고 receipt UPDATE/direct write를 열지 않는다. UI가 충돌 이유를 표시하며 free/canceled/cross-owner와 cleanup 경계를 유지한다. 결제·번역 publication·production activation은 이 항목의 완료로 주장하지 않는다.
      검증 명령: `pnpm exec vitest run 'app/api/plus/action-inbox/complete/route.test.ts' 'components/premium/plus-outcome-receipt-form.test.tsx' 'supabase/plus_meme_use_receipts.test.ts' 'supabase/plus_meme_use_receipt_integrity.test.ts'` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `node --check scripts/plus-activation-local.mjs` · `git diff --check` · local production route smoke · independent `gpt-5.6-sol` high review
      상태: code_complete (루프 145 — receipt semantic retry integrity; local Supabase RPC runtime은 CLI crash/환경변수 부재로 미실행)
      결과: 후속 migration에서 canonical trim 값으로 여섯 필드를 비교하고 conflict를 반환한다. API 409와 5개 locale UI copy, `creator_pack` local runner의 실제 p_channel conflict·owner read-back·cleanup contract를 추가했다. focused 4파일/20건, 전체 183파일/1,308건, tsc/lint/build/diff check·HTTP smoke·최종 independent `gpt-5.6-sol` high PASS/APPROVE를 통과했다.

- [x] ID: PLUS-059
      문제: 기존 Creator Pack은 채널 선택에 따라 `story`/`card` 이미지 규격만 바뀌고, Instagram·Threads·Blog 등 모든 채널에 같은 공유 문안을 제공해 구독자가 실제 게시 목적지에 맞춰 다시 편집해야 했다.
      사용자 영향: 5
      데이터/법적 위험: 3
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 62.5
      의존성: 기존 `PlusGlobalActionInbox`·`buildPlusCreatorPack()`·`buildPlusDailySharePack()`·`creatorPackFormatForChannel()`·reviewed/current `creatorPackFacts`·one-cut export/receipt flow
      완료 조건: 선택한 채널이 기존 이미지 export 규격과 검수된 초안 순서에 모두 반영되고, 채널별 결과가 서로 달라야 한다. 문안은 reviewed/current facts와 선택된 reviewed usage example만 사용하며 예문이 없을 때 새 문장을 생성하지 않는다. 기존 clipboard/share/download/receipt/analytics와 no-channel legacy builder 계약을 유지하고 새 DB/API/RPC/schema/migration/write/AI/publication/deploy를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-daily-share-pack.test.ts lib/plus-creator-pack.test.ts components/premium/plus-global-action-inbox.test.tsx lib/i18n-premium.test.ts` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP smoke · independent `gpt-5.6-sol` high review
      상태: code_complete (루프 146 — Global One-Cut Channel Draft; authenticated Plus/RLS·payment·translation publication·production deploy 미수행)
      결과: 5개 채널 family별 draft ordering을 기존 Creator Pack에 연결하고 one-cut clipboard/preview에서 선택 채널 결과를 확인했다. canonical detail path를 현재 reviewed href로 제자리 치환해 중복 링크도 제거했다. focused 4 test files/154 tests, 전체 183 files/1,311 tests, tsc/lint/build 81/81·diff check·HTTP smoke 및 independent `gpt-5.6-sol` high PASS/APPROVE를 통과했다.

- [x] ID: PLUS-060
      문제: Premium Global Daily를 완료해도 당일 학습 결과가 기존 One-Cut Action Inbox로 이어지지 않아, 구독자는 뜻·안전 신호를 다시 확인한 뒤 별도 실행 카드를 찾아야 했다.
      사용자 영향: 5
      데이터/법적 위험: 4
      트래픽 가중치: 5
      해결 확신: 5
      예상 노력: 2
      우선순위 점수: 75.0
      의존성: 기존 `loadGlobalDailyChallenge()` 후보·3문항·`GlobalDailyChallenge` review shelf·`buildPlusGlobalActionInbox()`·One-Cut Creator Pack·receipt/analytics
      완료 조건: active Plus의 완료 또는 완료 재방문에서 실제 당일 3문항 중 검수·current·source-depth·safe/active 후보만 One-Cut CTA를 제공한다. CTA와 Action Inbox는 실제 content locale을 유지하고, 잘못된 focus/source 배열/지원 locale/다른 날짜·문항/unsafe·cooling·archived·completion unavailable은 fail-closed한다. 기존 Use Kit·standalone `/daily`·Daily Signal·Scout·Creator Pack·receipt와 no-auto-posting을 유지하며 새 DB/API/RPC/schema/migration/write/AI/publication/deploy를 추가하지 않는다.
      검증 명령: `pnpm exec vitest run lib/plus-daily-signal-routing.test.ts lib/global-daily-challenge.test.ts lib/global-daily-challenge.server.test.ts lib/plus-global-action-inbox.test.ts components/premium/global-daily-challenge.test.tsx 'app/(default)/premium/page.test.tsx'` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm build` · `git diff --check` · local production HTTP smoke · independent `gpt-5.6-sol` high review
      상태: code_complete (루프 147 — Global Daily → One-Cut Activation; independent `gpt-5.6-sol` high final PASS/APPROVE·0 findings; authenticated Plus/RLS·payment·translation publication·production deploy 미수행)
      결과: Global Daily loader의 기존 후보 DTO를 보존하고 문항·content locale·safety/lifecycle·completion 상태를 서버에서 다시 대조해 기존 Action Inbox/Creator Pack으로 연결했다. `usage_examples`는 새 경로에 전달하지 않고, 중복 Scout/Signal/Fulfillment는 하나의 검수 action으로 합친다. proxy auth-return의 `global_daily` allowlist와 duplicate focus/locale 배열 거부를 고정했으며, 수동 query 승격은 completed + available completion + 정확히 3개의 유효 문항/후보 일치일 때만 열린다. focused 7파일/87건, 전체 183파일/1,321건, tsc/lint/build 81/81/diff check·local dev HTTP smoke를 통과했다. `next start`는 현재 Next 16/Serwist 산출물의 루트 `prerender-manifest.json` 부재로 기동하지 못했다.
