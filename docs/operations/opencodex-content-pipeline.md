# OpenCodex 밈 콘텐츠 제작·검증 파이프라인

이 파이프라인은 로컬 OpenCodex `http://localhost:10100/v1/chat/completions`를 사용한다. 기존 밈의 **근거 기반 설명 초안**과 **밈캐치 자체 제작 문구·설명 카드 초안**을 구분하며, 운영 DB 수정·게시·collectible 배정 변경은 자동으로 하지 않는다. 모델의 `pass`는 사람의 사실·권리 검토나 게시 승인이 아니다.

## 실행

기존 Node/pnpm 의존성을 사용한다. OpenCodex는 같은 컴퓨터에서 실행되어야 한다. 배포된 Next.js 서버에서 `localhost:10100`을 호출하지 않는다.

- `MEME_CONTENT_BASE_URL`: 기본 `http://localhost:10100/v1`, loopback 주소의 `/v1`만 허용
- `MEME_CONTENT_MODEL`: 기본 `gpt-6.1-sol`
- `MEME_CONTENT_API_KEY`: 로컬 프록시에서 요구할 경우만 사용; 로그·생성물에 출력하지 않음
- Supabase 공개 감사·기존 설명 생성은 anon GET만 사용한다. `original`의 중복 검사는 비공개 pending/rejected 제목·별칭도 포함하므로 유효한 `SUPABASE_SERVICE_ROLE_KEY`의 읽기 권한이 필요하다. 실패하면 공개 데이터만으로 검사 범위를 줄이지 않고 중단한다.
- 환경 후보는 process → `.env.local` → `.env.production` → `.env.development` 순서로 모두 읽는다. 첫 URL의 대상 프로젝트를 고정하고 그 프로젝트의 role·issuer·ref·expiry가 유효한 키만 선택한다. 명시한 process 키가 잘못되면 조용히 다른 키로 바꾸지 않는다. 원격 URL과 로컬 demo 키를 혼합하지 않으며, 프로젝트 검증이 불가능한 opaque 서비스 키는 거부한다. 자격 정보는 로그·초안에 기록하지 않는다.

```sh
pnpm content:audit --out artifacts/content-pipeline/new-audit

pnpm content:review \
  --snapshot artifacts/content-pipeline/new-audit/snapshot.json \
  --short-id 89b37mrx \
  --out artifacts/content-pipeline/new-semantic-review

pnpm content:generate \
  --short-id 89b37mrx \
  --evidence data/editorial/2026-10-08-zico-evidence.json \
  --out artifacts/content-pipeline/new-zico-draft

pnpm content:verify \
  --artifact artifacts/content-pipeline/new-zico-draft/catalog-89b37mrx.json \
  --out artifacts/content-pipeline/new-zico-verification

pnpm content:original --topic '회의가 5분 일찍 끝난 날' --limit 2 \
  --out artifacts/content-pipeline/new-originals

node --test scripts/meme-content-pipeline.test.mjs scripts/meme-semantic-review.test.mjs
```

출력 디렉터리는 매 실행 새 이름을 사용한다. 파일은 `wx`로 저장해 기존 증거를 덮어쓰지 않는다. 생성 배치는 최대 5개, 의미 검토 배치는 최대 20개이며 `--offset`/응답 `nextOffset`으로 이어서 검토한다.

## 근거·검토 계약

`generate`는 특정 밈의 UUID에 연결된 checked-source JSON이 필수다. 출처를 실제로 읽은 운영자가 직접 URL, 읽은 시각, 요약 메모와 짧은 인용을 기록한다. 검색 URL이나 기존 DB 설명만으로 오류가 있는 사전을 다시 인증하지 않는다. 공급된 문장에 없는 인용, 무관한 필드 인용, ID·제목 변경, 새 기원 연도·권리 허가 주장을 거부한다. 생성과 독립적인 두 번째 모델 요청으로 본문·예문·카드 방향을 검토한다.

JSON/Markdown/SVG가 함께 생성된다. SVG는 자체 도형과 타이포그래피를 사용하고, 검토된 symbol과 composition을 실제 그림에 반영한다. 외부 이미지·영상·가사를 복사하지 않는다. 카드 아트의 정확성은 원작 장면 재현을 의미하지 않으며 사람의 검토가 필요하다.

`verify`는 현재 DB의 원자료 fingerprint를 다시 읽어 초안 생성 이후 변경 여부와 필드 근거를 검사한다. 오래된 초안은 재생성해야 한다. 이 검증도 게시·권리 승인을 대신하지 않는다.

`content:review`는 UUID뿐 아니라 카드 문구·핵심 기호·구도와 밈 의미를 비교한다. YouTube 대표 영상은 공식 oEmbed로 조회한 제목·작성자만 검토 근거로 삼는다. DB 캡션은 미디어 자체를 검증한 증거가 아니며 `unknown`으로 유지한다. 메타데이터 일치는 영상 프레임 전체의 의미 인증이 아니고, 비YouTube 이미지·영상의 실제 장면 검토는 아직 지원하지 않는다. 따라서 구조 감사와 의미 검토 결과를 구분한다.

## 관리자 가져오기

새 `house_original` JSON을 관리자 자체 제작 폼의 파일 가져오기로 연다. `generatedAt`, provider, topic, 엄격한 스키마, `pass`와 빈 issues, 원본/관리자 필드 일치, UTC 제작 연도와 고정 분류를 검사한다. 100KB를 초과하거나 게시·권리 설정을 끼워 넣은 파일은 거부한다.

가져오기는 폼과 카드 문구·아트 방향 미리보기만 채우며 자동 저장하지 않는다. 운영자가 저장하면 기존 관리 흐름의 **pending** 초안으로 처리된다. 전체 카드 recipe(`motif`, `symbols`, `composition`)는 canonical 설명에 보존하고 JSON/SVG 파일에도 남긴다. 별도의 구조화된 collectible 레코드 생성·ID 부여·기존 수령 내역 변경은 하지 않는다. 카드 카탈로그 반영은 기존 수동 검토 절차를 따른다.

기존 harvest 경로도 수집 후보를 `catalog/pending`으로 저장하며, 검색 결과를 원작권 근거나 자체 제작 사실로 기록하지 않는다.

## 2026-10-08 실제 점검 결과

공개 스냅샷의 밈 4,394개·활성 카드 1,000개를 전수 구조 점검했다. 카드 UUID·번호·시드·제목 연결은 일치했지만, 이것은 의미가 모두 적절하다는 증거가 아니다.

| 검토 후보 | 수 |
| --- | ---: |
| 기존 contentDepth 기준 미달 | 4,225 |
| 승인·재생 가능한 대표 콘텐츠 없음 | 2,192 |
| 직접 출처 없음 | 1,787 |
| 동일 미디어를 여러 밈이 공유 | 270 |
| 대표 콘텐츠가 여러 개 | 32 |
| 검색·안전하지 않은 출처 URL | 3 |

수치는 서로 중복되며, 공유 미디어만으로 오연결을 단정하지 않는다. 의미 전수 검토 완료를 주장하지 않는다.

요청된 `89b37mrx`는 현재 제목이 “새삥 챌린지 (지코)”이고, 기존 본문에 `새삥(Freak-y)` 혼동이 있으며 직접 출처·승인 콘텐츠가 없다. [CJ의 공식 기사](https://cjnews.cj.net/?p=32515)를 읽어 근거 패킷을 구성한 후 OpenCodex에서 설명·카드 초안을 실제 생성했고, 현재 원자료 fingerprint 검증도 성공했다. 독립 의미 검토는 `mc-0012`의 범용 발자국·음표·물결 아트가 핵심 팔 동작을 직접 표현하지 않는다는 `mismatch`, 미디어는 `absent`를 반환했다. 이는 검토 후보 판정이며 운영 데이터는 바꾸지 않았다.

- 감사: `artifacts/content-pipeline/2026-10-08-audit/`
- 확인된 출처 기반 초안: `artifacts/content-pipeline/2026-10-08-zico-verified/`
- fingerprint 재확인: `artifacts/content-pipeline/2026-10-08-zico-verification/`
- 실제 의미 검토: `artifacts/content-pipeline/2026-10-08-zico-semantic-live/`
- 초기 자체 제작 모델 호출은 2개 초안을 생성했지만, 당시의 형식은 현재 강화된 importer 계약 이전이다. 최신 `original` 재실행은 비공개 제목 검사 GET의 HTTP 401로 중단했다. 유효한 운영 읽기 자격 증명 없이는 새 제작 배치의 실행 완료를 주장하지 않는다.

## 초기 Aside UI 검증 환경

```sh
node scripts/meme-content-preview.mjs 3012
```

`.env.production`의 공개 URL/anon 키만 임시 preview 프로세스에 전달하고 service 키는 비운다. 개발 DB로 잘못 연결되어 카드 미표시·404가 나던 첫 검증 결과는 운영 공개 데이터를 읽는 이 서버에서 재검증했다. 기존 사용자 탭·로그인·계정 설정은 변경하지 않았다.

Aside 실제 브라우저에서 카드 1,000종/첫 페이지 24장/캔버스 표시, 마우스 드래그 진행률 `0 → 29 → 54% → 공개`, PPAP 카드의 그림·제목·설명·공개 상태와 `revealed=1` URL 전환을 확인했다. 요청의 “새삥” 주소와 과거 “새싹” 주소 모두 현재 “새삥” 상세를 HTTP 200·리다이렉션 없이 렌더했다. 이는 **수정된 로컬 서버** 검증이다. 운영 catchmeme.com에 이 수정이 배포되었다는 뜻이 아니다.

화면 진행률은 실제 긁힌 면적을 35% 공개 임계치로 나눈 0–100% 표시다. 따라서 화면 54%의 미공개는 실제 면적 약 18.9%로 정상이며, 추가 드래그 후 공개 완료가 확인됐다.

모바일 viewport·reduced-motion·콘솔 오류 수집은 해당 Aside 도구가 지원하지 않아 UI 검증하지 못했다. 수령·로그인·구매·저장·게시 동작은 실행하지 않았다. 수정 후 전체 Vitest 400개 파일/3,429개 테스트 통과, 이후 importer 최종 보강 포함 관련 12개 파일/163개 테스트와 Node 21개 테스트를 재검증했다. TypeScript·변경 파일 ESLint·diff-check도 통과했다. [Aside 증거 및 스크린샷](../../artifacts/content-pipeline/2026-10-08-ui-verification.md)을 별도 보존했다.

## 운영 빌드 모바일·모션 감소 검증 (2026-10-08)

Aside의 viewport/media API가 없는 제약은 기존 Chrome을 별도의 임시 프로필로 실행하는 `scripts/qa-meme-cards.mjs`로 보완했다. 사용자 브라우저의 프로필·쿠키·탭은 사용하지 않는다. 모든 GET/HEAD/OPTIONS 외 요청은 전송 전에 차단하며, 차단한 분석 전송의 로그는 정상 앱 오류와 구분해 그대로 보존한다.

운영 HEAD와 이 작업의 변경만 복사한 격리 소스에서 Vitest 398개 파일/3,416개 테스트, Node 파이프라인 21개 테스트, QA 회귀 5개 테스트, TypeScript, 변경 파일 ESLint와 webpack 운영 빌드를 통과했다. 다른 작업의 MPE·harvest 변경은 이 배포에 포함하지 않는다.

운영 빌드의 320×568/375×812 터치, 390×844 모션 감소 터치, 1440×900 마우스 매트릭스를 통과했다. 첫 방문 공지를 실제 입력으로 닫은 후 카드를 선택·긁어 중간 진행률과 최종 공개를 확인했다. 모션 감소에서는 먼지·공개 애니메이션·기울기·transition이 꺼지고 공개 동작은 유지된다. 갤러리 가로 넘침은 없었으며 새삭/새싹/새삥 상세 주소 모두 HTTP 200·리다이렉션 0회였다.

앱 콘솔 오류·실행 예외·첫 번째 및 외부 출처 네트워크 오류는 0건이다. 기존 Permissions-Policy `tools` origin-trial 경고는 7건 수집했다. 실제 기기 검증과 로그인·수령·구매·게시 검증을 의미하지 않는다. 로컬 검증 보고서는 `artifacts/release/20261008-meme-cards/local-production-qa/meme-card-qa-ssSMpj/report.json`이며 운영 배포 및 운영 URL 검증 결과는 같은 release 디렉터리의 별도 보고서에 기록한다.

## 후속 교정·401 해소 (2026-10-08)

위 초기 점검의 미완료 사항 중 새삥 한 건과 자체 제작 중복 검사 인증만 후속 수정했다. 전수 의미 교정·자동 게시를 켜지 않았다.

- 401 원인: 운영 URL과 로컬 demo 서비스 키의 환경 파일 교차 배치. 전체 환경 후보에서 같은 프로젝트의 유효한 자격만 선택하도록 수정했다. `.env`와 운영 권한은 변경하지 않았다.
- 수정 후 전체 상태 5,030행의 제목·별칭 조회가 성공했다. OpenCodex에서 자체 제작 초안 `5분 생겼는데 휴가부터 검색함` 1개를 실제 생성하고 독립 검토 `pass`, 관리자 strict importer 통과를 확인했다. 저장물은 로컬 JSON/Markdown/SVG이며 DB 저장·게시 0건이다.
- 새삥 `89b37mrx`의 `Freak-y` 혼동 및 검증되지 않은 특정 팔 동작 설명을 제거했다. 공식 The CHOOM 안무 비디오·바타 튜토리얼 oEmbed의 현재 제목과 채널, CJ 기사에 근거해 설명·유래·별칭을 교정했다. 정확한 동작 순서나 영상 프레임 전체의 사실성을 인증한 것은 아니다.
- 검토된 단일 원자 SQL로 기존 공개 문서 1개를 교정하고 출처 3개·대표 안무 영상 링크 1개를 연결했다. 감사 로그 `3525`에 변경 전 본문·별칭·시간 및 추가 레코드 ID가 남는다. 이후 재실행은 이전 `updated_at` 및 기존 관계 없음 조건이 맞지 않아 0건만 변경한다.
- 카드 `mc-0012`는 두 댄서·따라 하기 화살표·반복 기호로 교체했다. 카드 번호 12, 밈 UUID, 에디션 1, 시드 1381021653과 기존 수령 내역은 변경하지 않았다. 운영 배포·실제 UI 상태는 `artifacts/release/20261008-zico-auth/`의 별도 보고서로 확인한다.
