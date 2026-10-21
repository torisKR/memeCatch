# 운영 후속 조치 — 2026-10-21

## 범위와 현재 웹 배포

사용자는 운영 DB·기존 콘텐츠 교정·영상 업로드·광고·AdSense 재심사·공유 설정 변경 범위를
승인했다. 권리·특정 완성본 승인·결제 공급자/예산·Google 계정 제재 해제의 증거는 별도다.
이번 기록은 앞선 `seo-production-release-20261021.md` 이후의 후속 조치다.

- 웹 배포는 `dpl_4N7QybBodrEVeZJiRbPxsW2S3i36`, READY 상태를 재확인했다.
- 실행 중 앱 커밋은 `d56cb138f2bdb77c5fb9137c0e730dba5d8e4116`이다.
- 앱 코드 변경·새 웹 배포·main 병합은 하지 않았다. DB 조회 조건과 다음 배포용 설정만 변경했다.
- dirty 기본 작업 폴더의 다른 파일·키·미완료 결제/영상 기능은 포함하지 않는다.

## 운영 DB 적용 완료

프로젝트 `memeCatch` / `onjipuldngbdptldkpoe`의 migration ledger를 확인했다.
영상 제작·트렌드·수집 runtime·검수 integrity·source refresh·atomic review repair는 이미
적용돼 있어 다시 실행하지 않았다. 로컬 파일명과 실제 운영 ledger 버전이 다르므로
이 checkout에서 전체 `supabase db push`를 실행하면 안 된다.

공개 제작 영상 view의 미적용 교정 하나만 적용했다.

- 저장소 정본: `supabase/migrations/20261021114241_public_produced_video_visibility_20261021.sql`
- 검증에 사용한 기존 작업 파일: 기본 작업 폴더의
  `supabase/migrations/20261018095034_public_produced_video_visibility.sql`.
  원본 작업 파일은 다른 진행 작업을 보존하기 위해 이동/수정하지 않았다.
- 파일 SHA-256: `93d73be6a16b91daa0ea2f4a12680276e5ff71fdd0d1a6142d39282e16fa22b0`
- 운영 ledger: `20261021114241` / `public_produced_video_visibility_20261021`
- 변경: 기존 `privacy_status in ('public', 'unlisted')`를 `privacy_status = 'public'`으로 제한.
- 기존 artifact/승인 hash, 권리 validator, 승인된 production/content, embed smoke,
  최신 playback proof, security barrier와 읽기 권한을 유지한다.
- 테이블·콘텐츠·사용자·publication 원장 행은 수정/추가/삭제하지 않았다.
- 전후 view 행 수는 모두 0건. 현재 unlisted 노출 사례를 발견한 것은 아니며, 잠재적 공개 범위를 좁혔다.
- 적용 후 view 정의에서 unlisted 제외/public 조건, anon/authenticated SELECT 권한을 확인했다.
- 실제 `SET LOCAL ROLE anon` 읽기 트랜잭션도 0건을 반환했다.

신선한 로컬 검증은 기존 테스트 harness가 있는 `/Users/toris/projects/memecatch`에서
수행했다. 릴리스 worktree에 복사한 SQL과 실제 적용한 SQL의 SHA-256이 일치한다.
아래 harness/기존 영상 baseline 전체를 이번 소규모 릴리스에 새로 포함한 것은 아니다.
테스트 직전 기존 작업 파일과 운영 ledger 버전의 정본을 byte-for-byte 대조했다.

- `node --test scripts/public-produced-video-visibility.runtime.test.mjs`: 1 passed,
  격리 PostgreSQL에서 11개 visibility 검사·두 번 적용·실제 rights validator 검사.
- `pnpm vitest run supabase/video_production_pipeline_contract.test.ts`: 15 passed.
- public 정상 경로, unlisted/private, hash 불일치, 미승인, rights 실패,
  최신 embed 검증 실패, 읽기 권한 유지 사례를 검증했다.

적용 전 view 정의는 기본 작업 폴더의 무시되는 로컬 증거
`.local/seo-release-20261021/public-produced-view-before-20261021.json`에 기록했다.
Supabase security advisor에는 기존 security-definer view 경고가 남는다.
이 view는 private 제작 원장 위의 제한된 공개 projection이며 이번 교정에서는 실행 권한 모델을
바꾸지 않았다. 경고를 없애려고 private 원장에 anon 권한을 부여하거나 security_invoker를
무조건 켜면 안 된다. 별도 RLS 설계 감사가 필요하다.

## 운영 환경변수 고정 완료

기존 배포의 안전 override가 다음 배포에서도 사라지지 않도록 **memecatch 프로젝트의
production 대상에만** 아래 설정을 추가했다. 다른 프로젝트에 공유되는 team-wide 변수는
바꾸지 않았다. 개별 env 읽기로 저장된 값의 일치를 확인했고 비밀값은 보고하지 않았다.

| 이름 | 값 | 목적 |
| --- | --- | --- |
| MEME_LAYA_ROUTING_ENABLED | false | 삭제된 Gateway 경로 비활성 상태 유지 |
| MEME_CHAT_GENERATION_ENABLED | false | 유료 자유 생성 비활성 유지 |
| SOURCE_REFRESH_ENABLED | false | 기존 배포의 자동 갱신 중단 유지 |
| SOURCE_REVIEW_ATOMIC_ENABLED | true | 원자적 출처 검수 유지 |
| ADSENSE_AUTO_ADS_ENABLED | false | 계정 정지·사이트 심사 중 광고 스크립트 비활성 유지 |

환경변수 추가는 기존 배포를 재빌드하지 않는다. 현재 앱은 이미 앞의 네 설정을 배포 override로
사용하고 있고, 마지막 광고 설정은 미설정 시 false가 기본값이다. 현재 런타임과 같은 동작이다.
API 키·웹훅 서명 비밀·인증·가격·구독·자동 충전·카드/은행·결제 공급자는 변경하지 않았다.

## 콘텐츠 전수 점검, 일괄 교정은 미실행

승인 4,384건 + 제한 10건, 총 4,394건의 조회 가능한 레코드를 검사했다.
이는 사이트맵/색인/실제 화면의 공개 자격을 모두 통과한 문서 수가 아니다.
실제 검수 상태나 날짜를 자동으로 채우지 않았다.

| 검사 신호 | 건수 | 해석 |
| --- | ---: | --- |
| 빈 summary / description / origin | 각각 0 | 필드가 있다고 사실 검증된 것은 아님 |
| summary 앞뒤 공백 | 0 | 결정적인 일괄 공백 교정 대상 없음 |
| published_at 누락 | 462 | 발견일/생성일을 발행일로 대입하지 않음 |
| safety_reviewed_at 누락 | 4,392 | 실제 안전 검수를 했다는 기록을 만들지 않음 |
| 유효한 공개 HTTP(S) 출처 없음 | 1,785 | 자체 기획·텍스트 문서 등 포함 가능 |
| 연결 meme_contents 없음 | 1,924 | 텍스트 문서에 미디어를 강제하지 않음 |
| 현 contentDepth 기준 얇은 문서 | 3,940 | 내부 보완 신호이며 Google의 공식 임계값이 아님 |
| 알려진 Wikimedia origin 상투구 | 1 | limited 문서 Boxxy / kecg9kfp; 검수 대기 맥락을 유지 |

반복 origin은 7개 그룹이지만 같은 작품·문화적 기원을 공유하는 밈일 수 있다.
중복 원인이나 사실 오류가 확정되지 않았으므로 삭제/병합/재작성하지 않았다.
기존 `/admin/publisher-readiness`와 fingerprint 기반 사람 검수 흐름을 재사용한다.
모든 문서를 완전 교정했다거나 AdSense 기준을 통과했다고 주장하지 않는다.

## AdSense 최신 계정 확인

2026-10-21 Aside에서 기존 승인 계정을 읽기 전용으로 확인했다.

- 계정: **2026-10-31까지 일시 정지**, 사유 **무효 클릭: 직접 클릭**.
- catchmeme.com: **준비 중 / 사이트의 광고 게재 가능 여부 검토 중**.
- 기존 검토 요청: **2026-09-29 11:59**(화면 표시 시각; 별도 timezone 단정하지 않음).
- 별도 재심사 버튼은 표시되지 않았고 **리뷰가 요청됨** 상태다.
- Auto ads는 계정에서 이미 **사용/켜짐**. 정지로 실제 게재는 중단된다.
- 광고 계정 설정·광고 클릭·재심사 재제출은 실행하지 않았다.

Google 공식 안내에 따르면 계정 정지 중에는 사이트 검토도 중단된다.
정지 종료 전 Auto ads나 재심사로 이를 우회하지 않는다. 종료일 도래만으로 해제를
완료라고 보지 않고 Policy center 및 사이트 상태를 다시 확인해야 한다.

- https://support.google.com/adsense/answer/2659114?hl=en
- https://support.google.com/adsense/answer/12176698?hl=en
- https://support.google.com/adsense/answer/7299563?hl=en

## 영상·결제의 남은 입력

유일한 새삥 후보 `3157ff6233c0…`는 사용자가 완성본 승인을 보류했으며,
rights/production/artifact/upload/publication 승인도 false다. 이를 이번 포괄 요청으로
승인된 완성본이라고 바꾸지 않았다. 새 권리 승인 완성본의 파일·hash·비공개 업로드 범위,
원본 편집/재업로드 권리, 채널 OAuth 연결이 필요하다. 업로드·공개는 하지 않았다.

현재 결제 런타임은 Unifi Pay이며 테스트 완료 Paddle 통합은 확인되지 않았다.
공급자 변경·가격·유료 플랜·키 교체 대상을 추측하지 않고 구체적 설정/예산을 요청했다.

## 운영 smoke 및 복구

DB 적용 후 Aside로 홈과 새삥 상세를 확인했다. 두 URL 모두 HTTP 200,
표시 제목과 canonical 유지, JSON-LD 파싱 오류 0, VideoObject 0, 광고 스크립트 없음.
실제 공개 제작 영상이 없으므로 양성 공개/임베드 재생 검증은 아직 미완료다.

복구는 다른 계정/콘텐츠/키를 건드리지 않는 범위로 한다.

- DB: 삭제/테이블 복구는 필요하지 않다. 정의 백업은 보관하되 unlisted 허용으로의 단순
  역행은 권장하지 않는다. 필요하면 production view 공개 읽기를 차단하는 fail-closed
  핫픽스를 검토하고 익명 읽기 및 앱 fallback을 다시 검증한다.
- 설정: 이번에 추가한 다섯 production 항목만 대상으로 이전 미설정 상태를 복원할 수 있다.
  팀/다른 환경/기존 secret을 일괄 제거하지 않는다. 광고·유료 생성은 계속 off를 유지한다.
- 웹: 이번 작업에서는 새 배포가 없으므로 기존 READY 배포가 그대로다.
