# Loop 146 Acceptance — PLUS-059 Global One-Cut Channel Draft

## 사용자 결과

Plus Creator Pack에서 게시 채널을 고르면 기존 이미지 규격뿐 아니라 해당 채널에 맞는 검수 문안 순서가
준비된다. `threads`/`x` 같은 짧은 소셜은 캡션과 상세 링크를 먼저, `blog`는 설명과 캡션을 먼저 두며,
모든 결과는 기존 reviewed/current facts에서만 만든다.

## 수용 기준

- 선택 채널이 기존 `story`/`card` export와 channel-family draft ordering에 함께 반영된다.
- `instagram`/`tiktok`/`youtube`, `threads`/`x`, `community`/`messaging`, `blog`, `other`의 family mapping이 결정론적이다.
- 선택된 reviewed usage example만 포함하며, 예문이 없으면 새 문장을 생성하지 않는다.
- one-cut preview와 clipboard 결과가 실제 선택 채널의 draft를 표시한다.
- 기존 no-channel builder 출력, detail path, share/download/receipt/analytics 경계를 깨지 않는다.
- 새 DB/API/RPC/schema/migration/write/payment/AI/publication/deploy가 없다.

## 범위 밖

실제 로그인된 Plus entitlement/RLS, 결제 activation, 외부 플랫폼 게시 성공, translation publication,
production content supply와 deploy는 이번 루프의 수용 증거가 아니다.
