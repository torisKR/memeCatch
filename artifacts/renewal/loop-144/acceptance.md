# Loop 144 acceptance — GLO-009 Route-Safe Market Passport Variants

## Target

Global Daily 완료 후 보이는 Market Passport의 변형 링크가 단순히 `reviewed` 관계만으로
현재 UI locale 경로를 조합하지 않고, 실제 공개 상세가 열리는 exact locale·현재성·source-depth
계약을 통과한 경우에만 노출되게 한다.

## Acceptance

- 한국어 변형은 approved/limited canonical meme과 `isIndexableMeme()` source-depth를 모두 통과한
  대상만 `/memes/{short_id}-{slug}` 경로로 확정한다.
- `en`·`ja`·`zh`·`zh-tw` 변형은 기존 `getLocalizedSearchMemesResult()`의 exact reviewed/current,
  필수 번역 필드, 공개 상태, source-depth 결과가 있는 대상만 노출한다.
- localized target은 서버가 확정한 번역 slug·title·href를 DTO에 넣고, 컴포넌트는 locale과 canonical
  slug를 다시 조합하지 않는다.
- 번역 target read가 unavailable이면 Passport도 `unavailable` 상태로 표시하며, 성공적인 coverage-empty
  조회만 검수된 변형 없음으로 표시한다. 확인되지 않은 링크를 생성하지 않는다.
- Premium Global Daily는 UI display locale이 아니라 실제 `contentLocale`을 Passport loader에 전달한다.
- 기본 상세·localized 상세·Premium 호출부와 regression tests가 locale 전달 계약을 고정한다.
- Outcome/Action Inbox/Weekly Brief/Global Daily completion·streak, 결제·RLS·번역 발행 계약은 변경하지 않는다.

## Scope boundary

이번 루프는 기존 read-only Market Passport handoff와 공개 route gate만 강화했다. 새 DB/API/RPC/schema/
migration/write, 결제, 외부 게시, AI 호출, 번역 생성·발행, production deploy는 수행하지 않았다.
