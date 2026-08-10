# Loop 142 Acceptance — PLUS-057 Locale-Honest Premium Global Session

검수 기준일: 2026-08-10 (Asia/Seoul)

## 사용자 계약

- Premium과 standalone `/daily`는 UI-only 로케일(`th`, `vi`, `mn` 등)에서도 기존 검수된 영어
  콘텐츠를 명시적으로 사용한다. 콘텐츠가 없는 것처럼 숨기거나, 번역되지 않은 행을 합성하지 않는다.
- `uiLocale`과 `contentLocale`을 분리한다. UI-only 로케일의 화면은 `displayLocale=th`와
  `contentLocale=en`을 함께 보유하고, 콘텐츠 언어가 영어임을 화면에 고지한다.
- 실제 콘텐츠 로케일은 밈 상세·Use Kit 링크, Global Daily completion POST body, primary analytics
  `locale`에 사용한다. 표시 로케일은 날짜 표시와 provenance용 `display_locale`에만 사용한다.
- 콘텐츠 블록의 `lang`은 실제 콘텐츠 로케일을 가리키며, UI-only 화면은 `lang="en-US"`와
  `Content language: English`를 노출한다. 핵심 5개 콘텐츠 로케일(`ko`, `en`, `ja`, `zh`, `zh-tw`)의
  기존 copy·경로·완료 동작은 유지한다.
- Global Daily는 여전히 5개 locale의 reviewed/current translation과 기존 source-depth/indexable
  게이트를 모두 요구한다. row-level 영어 fallback이나 schedule 완화는 하지 않는다.

## 데이터·안전 계약

- 변경은 기존 read-only loader와 컴포넌트 경계에 한정한다. 새 DB/API/RPC/schema/migration/write,
  번역 생성·발행, OpenAI 호출, 결제, 외부 게시, production deploy는 추가하거나 실행하지 않는다.
- Global Scout의 기존 requested-locale read error는 `unavailable`로 유지하고, 기존 empty-only 영어
  fallback 의미를 바꾸지 않는다.
- standalone `/daily`는 Premium 전용 Review Shelf를 받지 않으며 기존 completion/streak API 계약을
  유지한다. 완료 API는 실제 `contentLocale`만 받는다.
