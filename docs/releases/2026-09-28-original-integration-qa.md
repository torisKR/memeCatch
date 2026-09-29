# 원본 프로젝트 통합 및 QA — 2026-09-28

## 결과

별도 작업 공간의 개선사항 46개 파일을 `/Users/toris/projects/memecatch` 원본 `main` 작업 디렉터리에 통합했다. QA에서 발견한 결함을 추가 수정하고 테스트, 타입 검사, 앱 소스 린트, 운영용 빌드, 실제 로컬 브라우저 검사를 수행했다. 커밋·푸시·운영 배포·운영 DB/Storage 변경은 이번 작업에 포함하지 않았다.

원본과 별도 작업 공간의 기준 커밋은 `3d10dc0095001fc5595fe8b563ef2f78b0462de2`다. 이전 Vercel 배포 `dpl_72JqePA2Xd38RGofBz8abeWMwwVs`에는 이번 통합/QA 수정이 없으므로 최종 검증본으로 간주하거나 그대로 승격하면 안 된다.

## 원본 보존 및 병합

- 초기 통합: 변경 파일 14개와 신규 파일 32개, 총 46개.
- 원본에서 교체되는 파일 14개를 `.local/integration-backup-20260928/original/`에 원래 경로 + `.bak` 확장자로 백업했고 SHA256을 검증했다.
- 충돌 구간 3개는 공통 기준 버전과 양쪽 변경을 비교해 수동 병합했다.
  - `app/(default)/page.tsx`: 원본 canonical/hreflang metadata 보존 + 새 발견 동선.
  - `components/global-header.tsx`: 원본 제보 링크 `nofollow` 보존 + 최신/커뮤니티/상품 동선. 이후 태블릿 QA 수정 추가.
  - `components/bottom-nav.tsx`: 기존 제보/MY `nofollow`와 기존 기능 보존 + 최신/커뮤니티/상품 탭 및 가독성 개선.
- 통합 manifest에는 213개 항목이 있다. 이 중 1개는 작업 중 생성한 본 QA 문서다. 원래 작업 파일 212개 중 수동 병합 3개를 제외한 209개는 SHA256 대조 대상이며, 초기 통합 완료 시 모두 원본 바이트와 일치했다. 본 문서 갱신은 기존 사용자 파일 변경으로 계산하지 않는다.
- 추가 QA 수정의 별도 백업: `qa-stability/`, `qa-assets/`, `qa-creator-ui/`, `qa-upload-nav/`, `qa-header/`.
- Git index는 변경하지 않았고, 별도 작업 공간도 보존했다. 환경변수 파일, `.git`, `.vercel`, 캐시, 의존성 폴더를 복사하지 않았다.

## QA에서 수정한 항목

### 업로드와 상품 등록

1. 신규 상품 업로드에 기존 `hasTrustedOrigin` 검사를 적용했다. 외부/null/누락된 출처와 교차 사이트 요청을 자격증명·할당량·Storage 접근 전에 거부한다. 정상 동일 출처 요청과 로컬 QA 출처는 기존 로그인 검사를 거친다.
2. 등록 성공 후 `/products/mine`으로 이동한다. 이동이 완료되기 전 버튼/제출 핸들러에서 중복 등록을 막는다. 수정은 기존 update 액션을 유지한다.
3. 업로드·등록·검수 액션의 반환 오류와 전송 예외를 표시하고, 실패한 상태에서 다시 시도할 수 있게 했다. 검수 실패 후 승인/반려 버튼이 계속 비활성화되던 문제를 수정했다.
4. 사용자별 상품 이미지 폴더를 최대 21개까지 조회하고 20개가 이미 있으면 추가 업로드를 거부한다. 목록 조회 실패 시도 업로드를 허용하지 않는다. 기존 사용자별 분당 5회 DB 할당량은 유지했다.
5. PNG/JPEG/GIF/WebP의 컨테이너 구조와 크기 메타데이터를 검사한다. 헤더만 있는 PNG/잘린 컨테이너를 거부하고 한 변 8,192px, 전체 4천만 픽셀을 상한으로 둔다.

보관량 검사는 원자적 예약이 아니므로 동시 업로드가 일시적으로 20개를 초과할 수 있다. 실패/중단한 등록의 이미지 정리 기능은 없고 해당 파일도 한도에 포함된다. 이미지 검사는 전체 픽셀 디코딩이나 PNG CRC 검증을 보장하지 않는다. 이 한계를 숨기기 위해 검수/인증을 우회하거나 새 의존성을 추가하지 않았다.

### UI·접근성·에셋

- 모바일에 상품 탭을 상시 제공하고 기존 홈/최신/커뮤니티/제보/Plus/MY를 유지했다. 320px 실제 화면에서 7개 탭은 각각 약 45.7×56px이며 가로 넘침이 없었다.
- 작은 활성 탭/제보 글자에 텍스트용 `accent-text` 토큰을 사용했다.
- 썸네일 대체 설명의 `opacity-80`을 제거했다. 실제 최신 목록 axe 검사에서 확인한 설명 21개 대비 위반이 해소됐다.
- 정확히 소유한 HTTPS `catchmeme.com`/`www.catchmeme.com`의 `/api/media/` URL만 동일 출처 상대 경로로 정규화한다. 외부 호스트, userinfo, 위장 호스트, 다른 포트·경로는 정규화하지 않는다. CSP를 느슨하게 만들지 않았다.
- hydration 전에 실패한 이미지를 callback ref에서도 감지해 기존 타이포그래피 대체 화면으로 전환한다. 정상 이미지와 src 변경 시 복구는 유지한다.
- 768px 헤더에서 링크 줄바꿈/버튼 축소를 해결했다. 태블릿 간격을 줄이고 글자를 한 줄로 유지하며, 중복된 상단 제보 CTA는 lg부터 표시한다.

### 테스트 환경 안정화

- 병합 전 Node 26에서는 jsdom `localStorage`가 undefined가 되는 6건의 실패가 있었다. 지원되는 경우에만 Vitest worker의 Node 내장 Web Storage를 비활성화해 jsdom 저장소를 사용한다. Node 24에는 불필요한 플래그를 주지 않는다.
- 무작위 P-256 VAPID 테스트 키의 선행 0이 생략돼 가끔 32바이트 미만이 되는 문제를 테스트 fixture에서 보정했다. scalar=1로 실패를 결정적으로 재현했다. 운영 VAPID 검증은 변경하지 않았다.
- 백업/로컬 QA 생성물을 테스트 발견 범위에서 제외했다.

## 최종 자동 검증

| 검사 | 결과 |
|---|---|
| Node 24.16.0 전체 Vitest | 328개 파일, 2,273개 테스트 통과 |
| Node 26.8.2 전체 Vitest | 328개 파일, 2,273개 테스트 통과 |
| 상품 등록/검수 UI 테스트 | 14개 일반 테스트 통과, 예상 실패 표시 없음 |
| 콘텐츠 배치 스크립트 테스트 | 11개 통과 |
| 콘텐츠 dry run | 5개 밈, 출처 연결 10개 유효; DB 연결/SQL 실행 없음 |
| TypeScript | `tsc --noEmit --incremental false` 통과 |
| 앱 소스 ESLint | 오류 0개, 기존 이미지 최적화 권고 경고 6개 |
| 운영용 빌드 | 성공, 정적 페이지 96개 생성 |
| Git 차이 검사 | `git diff --check` 통과 |

최종 전체 테스트는 다음 조건으로 실행했다. 공유 Mac에서 기본 5초 제한으로 root-document 동적 import와 실제 FFmpeg 렌더 테스트가 각각 한 차례 시간 초과했다. 검증 assertion이나 테스트를 제거하지 않고 최종 실행에 worker 4개, 사례당 30초 제한을 지정했다. 따라서 기본 5초 설정이 어떠한 시스템 부하에서도 안정적이라는 주장은 하지 않는다.

```sh
env PATH="/Users/toris/.nvm/versions/node/v24.16.0/bin:$PATH" pnpm exec vitest run --maxWorkers 4 --testTimeout 30000
pnpm exec vitest run --maxWorkers 4 --testTimeout 30000
node --test scripts/reviewed-meme-batch.test.mjs
node scripts/reviewed-meme-batch.mjs data/editorial/2026-09-28-latest-memes.json
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint app components lib supabase next.config.ts proxy.ts vitest.config.mts
pnpm build
```

빌드에는 `metadataBase` fallback 경고 3건이 출력됐다. 공유 루트의 metadataBase와 원본 canonical/hreflang은 보존했으며, 앞선 생성 HTML 검사에서는 `http://localhost:3000` 문자열을 찾지 못했다. 이 경고를 해결됐다고 기록하지 않는다.

린트 경고 위치는 기존 `error.tsx`, `login/page.tsx`, `not-found.tsx`, `explore-grid.tsx`, `premium/plus-global-action-inbox.tsx`, `status-panel.tsx`의 `<img>`다.

## 실제 브라우저 QA

원본 checkout의 로컬 Next 서버 `http://127.0.0.1:3105`에서 수행했다. 테스트 프로세스 안에서만 운영 조회 설정을 읽고, 외부 쓰기 요청과 허용하지 않은 RPC를 차단했다. 분석/조회수 기록도 테스트에서 차단했다. 환경변수 파일을 수정하지 않았다.

- 핵심 4개 화면 `/`, `/explore?sort=recent`, `/community`, `/products` × 375/768/1440px: 12개 조합에서 가로 넘침/깨진 이미지 없음, axe WCAG2A/2AA 자동 위반 0건.
- 최종 헤더 수정 후 768px 4개 화면 재검사: 동일하게 위반 0건.
- 320px 상품 화면: 가로 넘침 없음, 하단 탭 약 46×56px, axe 위반 0건.
- 다크 + 모션 감소 설정에서 375px 홈/상품: 깨진 이미지/가로 넘침 없음, axe 위반 0건.
- 실제 클릭으로 홈 → 최신, 최신 → 커뮤니티, 커뮤니티 → 상품, 상품 → 등록 → 로그인 흐름 확인.
- 비로그인 등록/내 상품/수정/관리자 경로 4개가 로그인으로 이동하고 전체 `next` 경로와 수정 query를 보존함.
- 신규 밈 상세 `gjq95suv`, `wg65waqu`, `vpcfycm4`, `huuwcwma`, `bv8mem48`: 375px에서 제목/본문 렌더, 가로 넘침/깨진 이미지 없음, 자동 접근성 위반 0건.
- 키보드 Tab으로 헤더 링크 이동 및 solid 2px focus outline 확인.
- 주요 스크린샷 6장을 별도 시각 검토했다. 이후 발견된 태블릿 글자 줄바꿈을 수정했다.

axe에는 gradient/겹침 등으로 판정하지 못한 incomplete 항목이 남는다. 자동 위반 0건은 전체 WCAG 적합성 인증이나 모든 상태/언어/보조기술 검증을 뜻하지 않는다.

관련 기록: `.local/original-qa-20260928/qa-report.md`, `visual-review.md`, `tablet-header-fix.md`, `logs/route-matrix.txt`, `logs/console-summary.txt`.
재실행용 읽기 전용 브라우저 스크립트: `.local/browser-check-20260928.mjs`.

최종 대표 스크린샷:

| 화면 | 파일명 (`.local/original-qa-20260928/` 기준) |
|---|---|
| 모바일 홈 | `screenshot-1790539559821.png` |
| 모바일 최신 목록 | `screenshot-1790539564253.png` |
| 모바일 커뮤니티 | `screenshot-1790539564970.png` |
| 모바일 상품 | `screenshot-1790539565669.png` |
| 320px 상품 | `screenshot-1790539566270.png` |
| 최종 768px 홈 | `screenshot-1790539920043.png` |
| 데스크톱 홈 | `screenshot-1790539047954.png` |
| 다크 모바일 상품 | `screenshot-1790539928361.png` |

## 운영 반영 전 남은 조건

1. **실제 로그인 계정으로 업로드 → 상품 등록 → 운영자 승인 전체 흐름은 실행하지 않았다.** UI/action/route 테스트는 mock으로 검사했고, 실 브라우저는 공개/비로그인 흐름으로 제한했다. Docker 기반 로컬 Supabase가 실행되지 않아 별도 DB 통합 환경도 사용하지 못했다.
2. 운영 DB 읽기 검사에서 신규 creator_products 테이블/RLS/private bucket/전용 quota RPC 및 익명 submit/moderate 실행 금지는 확인됐다. 기존 원본 업로드/MPE 코드가 요구하는 `reserve_api_request(text)`는 운영 DB에 없었다. **병합 전부터 있던 원본 security 변경의 배포 선행조건**으로, 보안 검사를 우회하는 fallback을 추가하지 않았다.
3. 이전 상품 migration은 운영 이력의 `20260927190555` (`creator_products_reviewed_market_20260928`)로 이미 적용됐다. 원본에 가져온 migration 파일은 `20260927184114_creator_products.sql`이므로 운영 이력을 대조하지 않고 전체 `db push`를 실행하거나 동일 DDL을 다시 적용하면 안 된다. 이번 작업에서는 운영 migration 이력을 변경하지 않았다.
4. 운영에 이미 등록된 밈 5건을 읽기로 재확인했다. 재수집/재등록하지 않았다. 콘텐츠 migration도 이미 운영 이력 `20260927190806`에 존재한다.
5. 위 DB 선행조건과 실제 계정 검증을 확인한 뒤, 현재 원본 변경사항을 검토/커밋하고 새 배포를 생성해야 한다. 이전 격리 빌드 승격은 이번 QA 수정이 포함되지 않는다.
