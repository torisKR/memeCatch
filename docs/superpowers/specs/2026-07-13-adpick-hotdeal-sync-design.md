# 애드픽 핫딜 자동 동기화 설계

## 1. 목적

밈캐치의 `/products`를 애드픽 쇼핑메이트 핫딜 상품을 소개하고 구매로 연결하는 제휴 커머스 페이지로 확장한다. 애드픽 공식 핫딜 API에서 현재 판매 가능한 상품을 하루 1회 가져와 Supabase에 저장하고, 사용자는 상품 가격과 광고 관계를 확인한 뒤 애드픽 구매 추적 링크로 이동할 수 있다.

이 기능의 핵심 목표는 다음과 같다.

- 로그인 브라우저 자동화나 화면 크롤링 없이 애드픽 공식 API만 사용한다.
- 하루 1회 자동 갱신하되 외부 장애가 공개 상품 페이지를 비우지 않도록 한다.
- 판매량 근거가 없는 상품을 베스트셀러나 판매 1위로 표현하지 않는다.
- 광고·제휴 관계와 가격 갱신 시점을 사용자가 명확히 알 수 있게 한다.
- 추후 링크프라이스, 텐핑 등 다른 제휴사를 같은 데이터 경계 안에 추가할 수 있게 한다.

## 2. 범위

### 포함

- 애드픽 쇼핑메이트 핫딜 JSON API 연동
- Vercel Cron을 이용한 하루 1회 동기화
- Supabase 상품, 동기화 이력, 일별 클릭 집계 스키마
- 기존 `/products` 페이지의 핫딜 섹션 확장
- 안전한 클릭 기록 및 애드픽 구매 링크 리다이렉트
- 광고 고지, 가격·할인율·갱신 시점 표시
- 한국어·영어·일본어·중국어 UI 문구 지원
- API 파싱, 동기화, 인증, 리다이렉트, 화면 회귀 테스트

### 제외

- 애드픽 로그인 쿠키, 비밀번호 또는 브라우저 세션 저장
- 상품 구매·결제·주문을 밈캐치 내부에서 처리하는 기능
- 애드픽 판매 실적이나 정산 금액 자동 수집
- 상품 후기 또는 판매량을 임의 생성하는 기능
- 2차 제휴사 연동
- 실제 구매 전환을 밈캐치 인기 점수로 추정하는 기능

## 3. 외부 데이터 원칙

동기화 원본은 애드픽의 공식 쇼핑메이트 핫딜 API다.

```text
https://adpick.co.kr/apis/sdk_shopping_hotdeal.php?affid=<ADPICK_AFFILIATE_ID>
```

애드픽 안내에 따라 API 결과는 DB에 저장해 사용하고, API 호출은 하루 한 번으로 제한한다. `ADPICK_AFFILIATE_ID`는 서버 환경변수에서만 읽으며 클라이언트 번들에 포함하지 않는다. 제휴 식별자는 인증 비밀번호는 아니지만 무단 링크 생성과 설정 오용을 막기 위해 서버 전용 값으로 취급한다.

사용 필드는 다음과 같다.

- 테마: `title`, `description`, `theme_code`
- 상품: `product_name`, `photo`, `mall`, `mall_name`, `mall_icon`
- 가격: `price_sale`, `price_org`
- 제휴: `commission`, `buyurl`

상품명과 판매처 표기는 API 원문을 유지한다. 밈캐치는 상품 성능, 판매량, 효능을 별도로 생성하거나 보강하지 않는다.

## 4. 시스템 구조

```text
Vercel Cron (하루 1회, 21:00 UTC / 06:00 KST 부근)
  -> GET /api/cron/adpick-hotdeals
  -> CRON_SECRET 검증
  -> 애드픽 핫딜 API 호출
  -> Zod 스키마 검증 및 정규화
  -> Supabase 원자적 동기화
  -> /products에서 마지막 정상 스냅샷 조회

사용자 구매 클릭
  -> GET /go/products/:id
  -> 활성 상품 ID 조회
  -> 일별 클릭 수 원자적 증가
  -> 저장된 애드픽 buyurl로 302 리다이렉트
```

Vercel Cron 설정은 `vercel.json`에 한 개만 등록한다.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/adpick-hotdeals",
      "schedule": "0 21 * * *"
    }
  ]
}
```

Vercel Hobby 플랜에서는 지정한 시간의 한 시간 범위 안에서 실행될 수 있으므로 UI에는 정확한 실행 시각을 약속하지 않고 `매일 갱신`으로 표현한다.

## 5. 데이터 모델

### `affiliate_products`

정규화된 최신 상품 스냅샷을 저장한다.

- `id uuid primary key`
- `provider text not null` — 이번 범위에서는 `adpick`
- `source_type text not null` — 이번 범위에서는 `hotdeal`
- `external_key text not null` — 제휴 식별자를 제거한 목적지·offer 조합의 안정적 해시
- `theme_code text`
- `theme_title text`
- `theme_description text`
- `source_rank integer not null`
- `product_name text not null`
- `image_url text`
- `mall_domain text`
- `mall_name text`
- `mall_icon_url text`
- `sale_price integer`
- `original_price integer`
- `commission_label text`
- `affiliate_url text not null`
- `is_active boolean not null default true`
- `first_seen_at timestamptz not null`
- `last_seen_at timestamptz not null`
- `synced_at timestamptz not null`
- unique: `(provider, source_type, external_key)`

가격이 `0`이거나 숫자로 안전하게 변환되지 않으면 `null`로 저장하고 가격 문구를 숨긴다. 할인율은 `original_price > sale_price > 0`일 때만 계산한다. 커미션은 운영 정보이며 소비자 혜택으로 오해될 수 있으므로 공개 카드에는 표시하지 않는다.

### `affiliate_sync_runs`

예약 작업의 성공과 실패를 운영자가 확인할 수 있게 한다.

- `id uuid primary key`
- `provider text not null`
- `source_type text not null`
- `scheduled_date date not null`
- `status text not null` — `running`, `succeeded`, `failed`
- `fetched_count integer not null default 0`
- `upserted_count integer not null default 0`
- `deactivated_count integer not null default 0`
- `error_code text`
- `started_at timestamptz not null`
- `finished_at timestamptz`
- unique: `(provider, source_type, scheduled_date)`

일자별 unique 제약과 트랜잭션 잠금으로 중복 Cron 호출을 멱등하게 처리한다. 성공한 작업을 같은 날 다시 호출하면 기존 성공 행은 변경하지 않고 HTTP 응답에만 `skipped` 결과를 반환한다.

### `affiliate_product_daily_metrics`

개인정보 없이 상품별 날짜 단위 클릭 수만 저장한다.

- `product_id uuid references affiliate_products(id)`
- `metric_date date not null`
- `clicks integer not null default 0`
- primary key: `(product_id, metric_date)`

클릭 증가는 SQL 함수에서 원자적으로 처리한다. IP, 사용자 ID, 브라우저 지문, 원본 요청 헤더는 저장하지 않는다.

## 6. 동기화 규칙

1. `Authorization: Bearer <CRON_SECRET>`이 정확히 일치하지 않으면 `401`을 반환한다.
2. 이미 같은 서울 기준 날짜에 성공한 동기화가 있으면 외부 API를 호출하지 않고 `skipped`를 반환한다.
3. 애드픽 API는 고정된 공식 HTTPS 호스트로만 요청한다.
4. 응답 본문 크기, HTTP 상태, JSON 구조, 필수 필드와 URL 프로토콜을 검증한다.
5. 상품 키는 `buyurl`에서 개인 `affid` 값을 제거한 뒤 목적지·offer 정보를 기반으로 생성한다.
6. 같은 응답 안의 중복 상품은 안정적 키로 제거하고 첫 번째 `source_rank`를 유지한다.
7. 모든 상품의 검증과 정규화가 성공한 뒤 한 트랜잭션에서 upsert한다.
8. 이번 정상 응답에서 사라진 기존 핫딜만 비활성화한다.
9. HTTP 오류, JSON 오류, 빈 목록, DB 오류가 발생하면 기존 활성 상품을 변경하지 않는다.
10. 오류 로그에는 제휴 식별자나 전체 구매 링크를 포함하지 않고 분류 가능한 `error_code`만 저장한다.

Vercel이 실패한 Cron을 자동 재시도하지 않으므로 마지막 정상 스냅샷을 유지하는 것이 기본 복구 전략이다. 운영자는 보호된 동일 엔드포인트를 수동 호출해 재시도할 수 있다.

## 7. 상품 페이지

기존 `/products`를 유지해 URL과 검색 노출을 분산하지 않는다. 페이지 구조는 다음과 같다.

1. 제목과 명확한 제휴 광고 고지
2. 마지막 성공 갱신 시각
3. `밈캐치 인기` — 최근 7일 클릭 수가 있는 활성 상품 중 상위 상품
4. `지금 뜨는 핫딜` — 애드픽 API의 테마·순서 기반 전체 활성 상품
5. 기존 앱·서비스 CPA 카드 — 현재처럼 만료 여부를 검사한 별도 섹션

상품 카드에는 다음을 표시한다.

- 상품 이미지와 판매처
- 상품명
- 정상가, 할인가, 계산 가능한 경우 할인율
- `광고·제휴` 배지
- `상품 보러 가기` 버튼

`지금 뜨는 핫딜`은 애드픽이 제공한 핫딜 목록이라는 뜻이다. `밈캐치 인기`는 최근 7일 밈캐치 내부 클릭 수라는 설명을 함께 표시한다. 실제 판매량을 알 수 없으므로 `판매 1위`, `베스트셀러`, `구매 폭주` 표현은 사용하지 않는다.

API 상품 데이터가 한국어 중심이므로 네 언어에서 페이지 제목, 고지, 버튼, 상태 문구와 가격 형식은 번역하되 판매처 상품명은 원문을 유지한다.

## 8. 클릭과 리다이렉트

공개 링크는 저장된 외부 URL을 쿼리 파라미터로 받지 않고 내부 상품 ID만 사용한다.

```text
/go/products/<uuid>
```

리다이렉트 핸들러는 다음 순서로 처리한다.

1. UUID 형식과 상품 존재 여부 확인
2. `provider=adpick`, `source_type=hotdeal`, `is_active=true` 확인
3. 저장된 `affiliate_url`이 HTTPS 애드픽 구매 링크인지 재검증
4. 일별 클릭 수 증가
5. `302 Found`와 `Cache-Control: no-store`로 이동

클릭 집계가 일시적으로 실패해도 유효한 구매 링크 이동은 허용하되 서버 로그에 식별 가능한 오류만 남긴다. 존재하지 않거나 비활성인 상품은 `/products`로 리다이렉트한다. 외부 URL을 요청에서 직접 받지 않으므로 오픈 리다이렉트가 발생하지 않는다.

## 9. 이미지와 외부 콘텐츠

애드픽 API의 이미지 URL은 여러 쇼핑몰을 프록시하는 호스트를 사용할 수 있다. 임의 원격 이미지를 서버에서 다시 가져오는 범용 이미지 프록시는 SSRF 위험 때문에 만들지 않는다. 카드에서는 크기, 비율, lazy loading, referrer 정책을 명시한 브라우저 직접 로드 이미지를 사용하고, 로드 실패 시 브랜드 색상의 상품 자리표시자를 보여준다.

JSON-LD는 판매량이나 리뷰를 만들지 않는 `ItemList` 수준으로 제공한다. 가격이 유효한 상품만 `Offer` 가격 정보를 포함하며, 갱신 지연 상태에서는 가격 기반 구조화 데이터를 생략한다.

## 10. 보안과 권한

- `ADPICK_AFFILIATE_ID`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`는 Vercel 서버 환경변수로만 설정한다.
- 기본 상품·동기화·클릭 테이블에는 `anon`과 `authenticated`의 직접 `select` 권한을 부여하지 않는다.
- `/products` 서버 컴포넌트는 서버 전용 쿼리에서 소비자 표시 필드만 선택한다. `affiliate_url`, `commission_label`, 동기화 오류는 공개 Supabase API에서 직접 읽을 수 없고 리다이렉트와 운영 쿼리에서만 사용한다.
- 동기화 쓰기와 클릭 집계 쓰기는 service role 또는 제한된 SECURITY DEFINER 함수만 수행한다.
- 원격 API URL은 코드 상수로 고정하며 요청 파라미터로 호스트를 받지 않는다.
- 외부 텍스트는 React 텍스트 노드로만 출력하고 HTML로 삽입하지 않는다.

## 11. 상태와 오류 UX

- 마지막 성공 동기화가 48시간 이내면 일반 상태로 표시한다.
- 48시간을 초과하면 `상품 정보 갱신이 지연되고 있어 가격이 달라질 수 있습니다` 안내를 표시한다.
- 활성 핫딜이 없으면 기존 CPA 섹션은 유지하고 핫딜 영역에는 일시적인 준비 상태를 표시한다.
- 가격이 없는 상품은 `판매처에서 가격 확인`으로 표시한다.
- 구매 버튼에는 최종 가격과 재고가 판매처에서 달라질 수 있다는 보조 문구를 둔다.

## 12. 분석과 수익 판단

초기 수익 모델의 운영 지표는 다음과 같다.

- 상품 카드 노출 수: 기존 웹 분석 이벤트
- 상품 클릭 수: Supabase 일별 집계
- 상품 클릭률: 노출 대비 클릭
- 실제 구매·수익: 애드픽 쇼핑 리포트에서 확인

밈캐치 데이터만으로 구매 전환을 추정하지 않는다. 2차 단계에서 애드픽이 공식 리포트 API를 제공하고 사용 권한이 확인될 때만 수익 대시보드 연동을 별도 설계한다.

## 13. 테스트 전략

현재 프로젝트에는 테스트 러너가 없으므로 Vitest를 추가하고 새 동기화 로직은 테스트 우선으로 작성한다.

### 단위 테스트

- 정상 API 응답 파싱
- 쉼표 가격, `0`, 잘못된 가격 변환
- 할인율 계산 조건
- 개인 `affid`를 제외한 안정적 상품 키
- 중복 상품 제거와 원본 순서 유지
- 비HTTPS 이미지·구매 URL 거부
- 빈 응답을 실패로 처리
- 48시간 갱신 지연 판정

### 서비스 테스트

- 잘못된 Cron 인증은 외부 호출 없이 `401`
- 같은 서울 날짜의 중복 실행은 `skipped`
- 성공 시 upsert 후 사라진 상품 비활성화
- API 실패 또는 일부 데이터 오류 시 기존 활성 목록 유지
- 오류 저장 시 제휴 식별자와 구매 URL이 노출되지 않음

### 라우트 테스트

- 활성 상품 ID만 저장된 애드픽 링크로 이동
- 요청 파라미터로 외부 URL을 주입할 수 없음
- 비활성·없는 상품은 `/products`로 이동
- 클릭 집계 실패가 유효한 구매 이동을 막지 않음

### 통합 검증

- `pnpm test`
- `pnpm lint`
- `pnpm build`
- 로컬 Cron 엔드포인트 인증 성공·실패 확인
- 한국어·영어·일본어·중국어 상품 페이지 확인
- 375px, 768px, 1280px 반응형 및 가로 넘침 확인
- 외부 구매 버튼의 `sponsored`, `noopener`, `noreferrer` 의미 확인

## 14. 배포와 운영

필요한 환경변수:

```text
ADPICK_AFFILIATE_ID
CRON_SECRET
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL
```

배포 순서:

1. Supabase migration 적용
2. Vercel 환경변수 설정
3. 애플리케이션 배포 및 Cron 등록 확인
4. 보호된 동기화 엔드포인트를 한 번 수동 실행
5. Supabase 상품 수와 동기화 이력 확인
6. `/products`에서 상품·가격·구매 링크 확인
7. 다음 날 Vercel Cron 로그와 `affiliate_sync_runs` 성공 기록 확인

운영 중 애드픽 API 스키마가 바뀌면 동기화는 실패하고 마지막 정상 데이터가 유지된다. 오류 코드를 기준으로 파서를 업데이트한 뒤 수동 재실행한다.

## 15. 완료 기준

- 애드픽 핫딜 API가 하루 1회 자동 호출된다.
- 로그인 브라우저 세션 없이 개인 구매 추적 링크가 저장된다.
- 정상 핫딜 상품이 `/products`에 이미지·가격·판매처와 함께 표시된다.
- 구매 버튼이 클릭 집계 후 정확한 애드픽 추적 링크로 이동한다.
- API 또는 DB 실패가 기존 공개 상품을 삭제하지 않는다.
- 중복 실행, 빈 응답, 잘못된 URL과 가격이 테스트로 방어된다.
- 광고 고지와 가격 변동 안내가 화면에 표시된다.
- 모바일과 네 언어에서 주요 흐름이 정상 동작한다.
- lint, test, production build가 모두 통과한다.
