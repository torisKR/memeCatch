# Loop 071 acceptance

## User outcome

활성 Plus 사용자가 외부 이메일 relay가 아직 설정되지 않은 상태에서도 `/premium`을 열어
저장 밈을 우선으로 한 오늘의 글로벌 급상승 신호를 바로 확인할 수 있다.

## Acceptance contract

- active Plus 서버 페이지에만 Daily Signal query와 `PlusDailySignal` component가 전달된다.
- 최근 36시간 `rising`·`saved_rising` 중 `approved`·`limited`, lifecycle `rising`, safety `green`·`yellow`만 포함한다.
- `saved_rising` 후보가 먼저 오고 최대 3개로 제한한다.
- non-Korean locale은 current `reviewed` translation만 사용하고 locale-safe detail URL을 만든다.
- 후보가 없으면 empty 상태를 정직하게 보여주며 machine/stale 번역으로 채우지 않는다.
- 기존 email opt-in/relay 흐름과 새 in-app card는 별도 채널로 동작한다.

## Safety boundary

- `trend_alerts`와 public meme/translation rows는 기존 authenticated RLS read scope를 사용한다.
- 새 DB write, migration, service-role path, public SEO feed, 자동 번역·게시를 추가하지 않는다.
- free branch에는 signal query 결과와 Plus card를 렌더링하지 않는다.

## External gates

- 로컬 Supabase Docker daemon이 실행되지 않아 실제 RLS/RPC와 authenticated Plus 세션을 관찰하지 못했다.
- relay credential, 실제 이메일 발송·수신, production migration/deploy는 승인 게이트로 수행하지 않았다.
