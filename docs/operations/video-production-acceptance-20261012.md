# 자체 영상 파이프라인 검증·활성화 기록

2026-10-12~13, Asia/Seoul. 사용자는 OAuth 클라이언트 생성 후 **로컬 구현·검증까지만 유지**하도록 범위를 확정했다. 운영 DB·운영 비밀 설정·관리자 OAuth 채널 연결·영상 업로드·공개·배포는 진행하지 않는다. 기존 구조화 데이터 운영 배포와 이 기능의 배포를 구분한다.

## 로컬 결론

요청 범위의 기능 구현과 아래 검증을 마쳤다. 실제 운영 발행 수용성은 확인하지 않았으며, 이 기록은 배포 승인이나 공개 콘텐츠 승인으로 사용하지 않는다.

- 최종 수정 후 Vitest: 20개 파일, 192/192 통과.
- `pnpm video:protocol:test`: 89/89 통과.
- 위 검사에 포함된 핵심 회귀를 별도로 재실행: MPE 32/32, renderer·worker 39/39 통과.
- 수정 범위 ESLint 및 `git diff --check`: 통과. 최종 고정 파일·타임아웃 처리의 독립 코드 재검토에서도 중요한 잔여 결함을 발견하지 않았다.
- 전체 `pnpm exec tsc --noEmit`: 기존 `.next/types/app/api/admin/harvest-memes/route.ts`의 허용되지 않는 `HARVEST_CANDIDATE_POOL` export와 `POST`의 `Request | undefined` 오류 2건 때문에 exit 1이다. 영상 기능 수정 범위의 타입 오류는 없다.
- 로컬 렌더는 실제 TTS·폰트·FFmpeg로 생성했다. 공개 권리나 실존 밈 내용의 검수를 통과한 제작물은 아니다.

주요 변경 위치는 `lib/video-production/`의 계약·OAuth·API·서버 DTO, `lib/actions/admin-video-productions.ts`와 `app/api/admin/video-productions/`의 승인·동기화 경로, 관리자 페이지·`components/admin/video-production-console.tsx`, 제작 스크립트와 기존 `scripts/mpe-media-worker.mjs`의 선택적 폰트 경로, 새 영상 DB 마이그레이션과 회귀 테스트다. 폰트는 이중 복사 경로를 단일 선택 환경으로 줄였으며 기존 무폰트 MPE 호출의 동작을 보존했다.

## Google Cloud 설정

- 승인한 계정: `ironjustlikethat@gmail.com`.
- 기존 프로젝트: `catchmeme`, 프로젝트 번호 `633617605564`. 새 프로젝트·결제 연결은 하지 않았다.
- 별도 Web OAuth 클라이언트: `MemeCatch Video Admin`.
- 비밀이 아닌 client ID: `633617605564-vtdc4i7c8pv3cj0sl7ggcmnqk6omhacl.apps.googleusercontent.com`.
- 승인한 콜백: `https://catchmeme.com/api/admin/video-productions/youtube/callback`, `http://localhost:3000/api/admin/video-productions/youtube/callback`.
- JavaScript 원본: `https://catchmeme.com`, `http://localhost:3000`.
- YouTube Data API v3는 기존 활성 상태였다. 기존 로그인 클라이언트는 수정하지 않았다.
- External / Testing을 유지했다. 테스트 사용자 `ironjustlikethat@gmail.com`과 `https://www.googleapis.com/auth/youtube.force-ssl` 범위를 저장 후 재확인했다. 앱 심사·Production 전환은 하지 않았다.
- Google 다운로드 JSON은 저장소 밖 `/Users/toris/.aside/u/0/secrets/catchmeme-video-admin-oauth.json`에 있다. 파일 권한 `0600`, 부모 디렉터리 `0700`. 비밀키는 소스·테스트 출력·채팅에 기록하지 않았다.
- 실제 채널 OAuth 승인, refresh token 발급·저장, 업로드는 아직 실행하지 않았다.

대상 채널은 `UCBxN8lUb-5dDuOPv-szpF4g`이다. 실제 OAuth 완료 후 `channels.list(mine=true)`로 이 채널 소유권이 확인되어야 연결된다. 공개 채널 페이지를 보는 것은 소유권 검증이 아니다.

## 로컬 OpenCodex와 Toris Studio

- 로컬 `http://localhost:10100/v1`, `gpt-6.1-sol`로 구조화된 대본 2개를 실제 생성했다. 입력은 실존 밈이 아닌 명시적 LOCAL TEST 가상 표현이었다.
- 클라우드 Next 런타임의 localhost를 로컬 OpenCodex로 오인하지 않도록, 관리자에서 검수 사실 DTO를 내려받아 로컬 CLI로 생성하고 편집기로 가져오는 경로를 제공한다. 가져오기는 DB 저장·승인·업로드를 실행하지 않는다.
- 기존 Toris Studio Qwen MLX 런타임을 오프라인으로 실행해 실제 Sohee/Korean 음성을 합성했다. 새 모델·패키지를 설치하거나 유료 Fish API를 호출하지 않았다.
- 앞선 297자/222자 대본의 실제 음성은 49.680초/51.360초였다. 계획한 35초와 맞지 않아 렌더 길이 검사를 통과시키지 않았다.
- 짧은 167자 LOCAL TEST 음성은 실제 32.160초, 24kHz mono PCM WAV였다. SHA-256: `aad8029327373d9f41f74e523644a4d091dc0cf112c0902d8438f1ab0bba800c`.
- 글자 수는 초안 작성 힌트일 뿐이다. 실제 음성 길이와 검수 타임라인은 ±2초 이내여야 하며 장면별 의미 동기화는 별도 사람 검수다.
- Qwen 모델의 Apache-2.0 표기와 Sohee 음색의 상업 공개 권리 검수는 구분한다. 이 테스트의 fixture 권리 플래그는 실제 권리 승인으로 사용하지 않는다.

폰트는 공식 Noto CJK Sans 2.004 배포의 `NotoSansCJKkr-Regular.otf`와 동봉 OFL-1.1을 확인했다. 폰트 SHA-256은 `6bcb2a0703aa137e874fc2dffa85f6c21ba9a67fa329e81b8c801663af7e992a`이다. SVG의 `@font-face` 선언이나 Sharp `fontfile` 전달만으로 실제 선택을 통과 처리하지 않는다. 해당 호스트에서 폰트 비교·투명 배경 검사가 실패한 경로를 제거하고, 장면·PNG 자막은 승인 파일만 든 격리 Fontconfig와 `fc-match`의 정확한 파일/family 확인 뒤 별도 Pango FT2 프로세스의 glyph mask를 RGBA로 변환한다. libass 경로도 격리된 폰트 디렉터리와 실제 선택 로그를 요구한다.

원본 경로의 초기 해시만 믿지 않는다. 음성·폰트는 작업 전용 임시 경로에 복사한 뒤 복사본의 SHA-256을 승인 값과 비교하고, 음성 메타데이터·길이·음량 검사와 실제 렌더에 그 복사본만 전달한다. 장면·Pango·libass는 각각 검증한 고정 폰트를 사용하고, 자막 단계가 반환하는 선택 폰트 해시도 승인 값과 같아야 기술 검사를 통과한다. `fc-match`에는 30초 제한·`SIGKILL`·1MiB 출력 제한을 적용하며, 복사·설정·실행 실패 때 생성한 임시 루트를 정리한다. 파일 교체·원본 음성 경로 미사용·자막 해시 불일치·모의 timeout/실행 오류의 정리를 회귀 테스트로 잠근다.

- 실제 최종 소스로 생성한 렌더: `/private/tmp/memecatch-qwen-final.akCbfy/render-v5/production.mp4`, 32.160초, 1080×1920, H.264 + AAC, 1,015,530 bytes.
- MP4 SHA-256: `e1623fbdd53c391a42241b16fc9d1997e553dd10dcd6cbae0ca3b773d6fc3192`.
- 전 스트림 FFmpeg decode 검사, 실제 한글 poster·투명 텍스트 합성을 확인했다. Noto/Geist 픽셀 차이와 기존 기본 폰트 호출 뒤 승인 폰트 호출 순서도 검사한다.
- 로컬 `pango-view` 1.58.2 / `fc-match`는 기존 설치 도구를 사용했다. 해당 바이너리는 승인 폰트 경로의 추가 실행 요건이며 운영 호스트에서 자동 설치하지 않는다.
- 현 FFmpeg에는 libass/ASS 필터가 없어 실제 ASS font-select 로그는 확인하지 못했다. 실제 검증한 경로는 Pango PNG 합성이다.
- 영상은 실존 밈이 아닌 LOCAL TEST 가상 예시이다. 음성 권리 승인·장면별 의미 동기화 승인·영구 저장소 보관·YouTube 업로드를 통과한 공개 제작물이 아니다.

## 검증 근거와 경계

- 관리자 UI: 앞선 18조건과 최종 4모드 × 320/390px × 모션 감소 8조건을 검사했다. 최종 8/8 통과, 가로 넘침·콘솔 오류·외부 요청·실행 액션 0건. 모바일 에뮬레이션이며 실기기 검증은 아니다.
- 최종 UI 근거: `/Users/toris/.aside/u/0/sessions/2026-10-12_nHL8vt7o2Xyz6ZWX/tmp/high-final/result.json`.
- 최초 업로드 동의와 Studio/공개 전환 동의는 독립 게이트다. 기존 원장이 있는 제작물은 반복 업로드하지 않는다.
- 격리 PostgreSQL의 실제 RPC·동시성·반복 monitor·처리 실패/종료/기한·불명확한 게시 상태 복구를 검사했다. 자세한 경계는 `video-production-db-verification.md`를 따른다.
- 권리 만료 실패 RPC는 원장 무효화·사이트 연결 제거·해시가 일치하는 YouTube 비공개 전환 작업 한 개를 같은 트랜잭션에서 등록한다. monitor/sync 실패의 반복과 해시 불일치를 실제 격리 DB에서 확인했다.
- SQL pgTAP 60개를 작성했지만 로컬 확장이 없어 실행하지 않았다. 전체 선행 마이그레이션 체인과 최종 파일의 새 DB 전량 replay는 아직 검증하지 않았다.
- 별도 운영 소스 기반 격리 Next 빌드의 컴파일과 타입 검사는 통과했다. 전체 prerender는 실제 Supabase 없이 `/sitemap.xml` 데이터 조회에서 실패했으므로 전체 빌드 성공이라고 기록하지 않는다.
- 실제 비공개 업로드, YouTube 처리 완료, Studio 제한 확인, 공개 승인, 일반 방문자 임베드, 운영 상세 연결은 미검증이다.
- 작업용 TTS·UI fixture·격리 PostgreSQL 서버는 검증 후 종료했다. DB 데이터와 로컬 음성·영상 산출물은 보존했으며 기존 사용자 서비스는 종료하지 않았다.

## 보류된 운영 활성화 순서

아래 단계는 후속 운영 권한을 받기 전까지 실행하지 않는다.

1. 운영 DB의 선행 스키마와 마이그레이션 상태를 읽기 전용으로 확인하고 백업·복구 경계를 정한다. 전체 체인·pgTAP를 지원하는 격리 환경에서 최종 SQL을 먼저 검증한다.
2. 운영 변경 권한과 선택 릴리스 파일 목록을 확정한 뒤 DB·웹을 적용한다. 기존 dirty 변경을 통째로 배포하지 않는다.
3. Web 서버와 로컬 워커에 OAuth ID/secret, 별도 32-byte 암호화 키, 별도 callback HMAC secret을 안전하게 주입한다. 기존 Google 로그인 변수와 `CRON_SECRET`을 덮어쓰지 않는다.
4. 관리자 OAuth로 고정 채널을 연결한다. 실제 granted scope와 소유 채널을 확인하고 Testing 만료/재인증 경로를 점검한다.
5. 실존 밈의 검수 근거·독창적인 대본·음성/폰트/그래픽 권리·실제 타임라인을 승인하고 완성본 해시를 확정한다. LOCAL TEST 영상은 업로드하지 않는다.
6. 제작물별 명시 동의로 비공개 업로드와 이어 올리기·처리 검사를 수행한다. Studio 검수 후 별도 공개 승인을 받는다.
7. 실제 익명 player 재생을 확인한 뒤 사이트에 연결한다. owner API의 `embeddable=true`나 oEmbed 응답만으로 통과시키지 않는다.
8. 지속 실행하는 worker/watch와 지연 재검사 실행 환경을 확인한다. DB 큐가 있다는 것만으로 주기 작업이 실행 중인 것은 아니다.

YouTube의 비공개 선행 업로드는 밈캐치 자체 안전 정책이다. 오래된 “미검증 API 프로젝트는 항상 비공개로 제한된다”는 가정을 코드에서 확정 사실로 사용하지 않는다. 실제 API 결과와 해당 프로젝트 설정을 확인한다.

공식 계약 확인: [YouTube videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [OAuth 2.0](https://developers.google.com/identity/protocols/oauth2), [Sharp text fontfile](https://sharp.pixelplumbing.com/api-constructor/), [librsvg text layout](https://gnome.pages.gitlab.gnome.org/librsvg/devel-docs/text_layout.html).
