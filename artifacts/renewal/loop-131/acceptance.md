# Loop 131 Acceptance — LOC-024

## 목표

Plus 사용자가 요청한 locale의 reviewed/current 밈 번역이 실제 글로벌 콘텐츠 공급과 One-Cut Action Inbox에
연결되도록 한다. UI locale이 달라도 준비된 요청 결과를 버리지 않고, 운영자 검수 전에는 공개·완료로
오인하지 않는다.

## 구현 범위

- `lib/translation-worklist.ts`: locale-scoped Plus missing priority ID 추출
- `app/(default)/admin/translations/page.tsx`: 선택한 모든 SEO locale을 priority RPC에 전달
- `lib/actions/admin-translations.ts`: `(p_limit, p_locale)` RPC 호출과 기존 무필터 호출 보존
- `supabase/migrations/20260810090000_plus_translation_priority_locale_filter.sql`: DB demand CTE 안에서
  locale을 먼저 제한한 operator-only RPC
- `lib/plus-global-action-inbox.ts`: ready fulfillment의 UI locale 독립 선택과 same-meme exact-locale 우선
- `components/premium/plus-global-action-inbox.tsx`: 실제 번역 언어 표시

## 판정 계약

- 누락 priority는 선택 locale과 `translationStatus=null`에 한정한다.
- locale filter는 전역 50행 cap 이후가 아니라 DB query 전에 적용한다.
- `state=ready`만 Action Inbox에 들어가며 machine/stale/source-incomplete는 제외한다.
- 같은 밈의 여러 ready 번역은 현재 UI locale을 우선하고 나머지는 deterministic하게 선택한다.
- exact localized href/share text, 기존 five-item cap, completion/privacy/publication 경계를 유지한다.
- 기존 one-argument unfiltered RPC와 operator-only 권한을 보존한다.
- 새 translation content, AI 공개, production write/migration apply/deploy는 범위 밖이다. source migration
  artifact는 추가했지만 production에는 적용하지 않는다.

## 종료 기준

집중 회귀·전체 테스트·타입·lint·build·diff check와 local production route/auth smoke를 통과하고, fresh
`gpt-5.6-sol high` review가 승인해야 code_complete로 기록한다. 실제 operator/Plus session, reviewed
publication, production migration 적용은 별도 human gate로 남긴다.
