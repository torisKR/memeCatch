# 관리자 GA4 리포트

`/admin/analytics`는 운영자 권한을 확인한 뒤 Axum 서버에서 Google Analytics Data API를 조회한다. 개요, 유입, 행동, 이탈, 실시간 중 현재 탭의 보고서만 요청한다. SVG 차트는 서버에서 렌더링하며 접을 수 있는 데이터 표를 제공한다.

## 배포 설정

- `GA4_PROPERTY_ID`에 속성의 숫자 ID를 설정한다.
- `GA4_SERVICE_ACCOUNT_EMAIL`에 서비스 계정 JSON의 `client_email`을 설정한다.
- `GA4_SERVICE_ACCOUNT_PRIVATE_KEY`에 서비스 계정 JSON의 RSA PEM `private_key`를 설정한다. 실제 줄바꿈과 `\n` 이스케이프를 지원한다.

Google Cloud 프로젝트에서 Google Analytics Data API를 활성화하고 GA4 속성 액세스 관리에서 서비스 계정에 Viewer 권한을 부여한다. `NEXT_PUBLIC_GA_ID`는 브라우저 수집용 측정 ID다.

## 집계 해석

- 7일, 28일, 90일은 GA4 속성 시간대의 어제까지다. 비교 기간은 직전의 같은 길이다. 이전 기간에서 해당 항목을 찾을 수 없으면 표에 —로 표시한다. 상위 행 한도와 개인정보 보호 기준이 적용될 수 있다.
- 개요 KPI의 평균 참여 시간은 활성 사용자당이다. 유입과 착지 페이지의 평균 참여 시간은 세션당이다. 이탈 탭의 페이지별 평균 참여 시간은 해당 경로의 활성 사용자당이다.
- 첫 유입은 `firstUserSourceMedium`의 신규 사용자 집계다. 재방문 소스는 세션 이력이 있는 사용자의 `sessionSourceMedium`이다. 전체 세션 소스 표에는 신규·재방문이 모두 포함된다. 소스별 착지 페이지는 API가 반환한 상위 500개 (소스, 경로) 조합에서 집계한다.
- 행동 단계는 전체 세션과 `meme_view`, `copy`, `share_click` 이벤트 수를 나란히 표시한다. 같은 세션의 반복 이벤트가 포함되며 행동 순서는 알 수 없다. 별도의 GA4 주요 이벤트 추이는 속성에서 지정한 `keyEvents` 집계다. 검색과 스크롤은 향상된 측정의 수집 설정에 따라 데이터가 있을 때 표시된다.
- 이탈 세션은 세션 수에 이탈률을 곱해 반올림한다. 진단은 세션 30회 이상에서 사이트 평균보다 12%p 높은 항목, 또는 사이트 평균보다 이탈률이 높으면서 세션당 평균 참여가 10초 미만인 착지 페이지를 표시한다. 이탈 세션 기준 최대 6건이며 분류가 겹칠 수 있다. 이 수치로 10초 안에 떠난 방문자의 비율이나 이탈의 인과관계를 알 수 없다.
- 404 리포트는 Axum의 공통 404와 밈·로케일 404 문서 제목을 조회한다. 공통 404에는 GA4 태그가 없고, 자체 제목을 사용하는 404도 있으므로 이 리포트는 관측된 404만 포함한다. 리퍼러는 쿼리를 제거한 도메인과 경로로 표시한다. 외부 사이트 클릭은 향상된 측정의 외부 링크 클릭 횟수다.
- 실시간 활성 사용자는 최근 30분의 중복 제거된 사용자 집계다. 페이지는 그 시간에 활동이 관측된 제목이며, 한 사용자가 여러 제목에 잡힐 수 있다. 현재 분은 집계 중이다.

## 호출과 할당량

과거 탭은 탭·기간별 10분, 실시간은 기간과 관계없이 45초 동안 서버 프로세스에 캐시된다. 같은 키의 동시 요청은 한 번의 조회를 공유한다. 캐시에 없는 조회는 읽기 전용 OAuth 토큰 하나를 발급받으며, 보고서는 프로세스 전체에서 동시에 10개까지 조회하며 배치도 내부 보고서 수만큼 계산한다. Google 요청당 제한 시간은 10초다. 개별 응답을 검증해서 해당 패널에 빈 결과와 오류를 표시한다. Google이 배치 조건을 400으로 거부하면 개별 보고서로 다시 조회한다.

| 조회 | API 분류 | 보고서 수 | 정상 HTTP 호출 수 |
| --- | --- | ---: | ---: |
| 대시보드 | Core | 3 | 1 |
| 개요 | Core | 7 | 2 |
| 유입 | Core | 18 | 4 |
| 행동 | Core | 12 | 3 |
| 이탈 | Core | 22 | 5 |
| 실시간 | Realtime | 5 | 5 |

위 표는 캐시가 비었을 때의 Data API 호출이며 OAuth 호출은 별도다. Google은 기간, 행 수, 열 수, 필터 복잡도에 따라 토큰을 차감하며 배치 내 각 보고서가 비용에 기여한다. 배치 요청은 최대 5개 보고서를 담는다. Google 문서에 따르면 대부분의 보고서는 10토큰 이하를 쓰지만, 기간이 길고 조회 경로의 종류가 많으면 더 쓸 수 있다. 정확한 토큰 사용량은 실제 속성 응답의 `propertyQuota`로 확인한다. [Google Data API 할당량](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas), [Google 할당량 운영 가이드](https://developers.google.com/analytics/blog/2023/data-api-quota-management)

## 운영자 연결 검증

```sh
node scripts/ga4-check-requests.mjs --key /안전한/경로/service-account.json --property 123456789
```

스크립트는 Rust 요청 빌더에서 7일·28일·90일과 대시보드·실시간 요청을 로컬에서 추출한다. 실제 API에는 서로 다른 요청을 한 번씩 순차적으로 보내고 상태, 행 수, 오류 요약을 표시한다. 배치가 400이면 해당 보고서를 개별 재검증하고 429에 도달하면 중지한다. 서비스 계정 키, 토큰과 리포트 행은 출력하지 않는다. 작업 중 실제 속성에서는 실행하지 않았다. [GA4 Core 스키마](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [GA4 Realtime 스키마](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-api-schema)

## 후속 수집 점검

- 저장소의 `[data-copy]` 처리기는 클립보드에 쓰지만 GA4 `copy` 호출이 확인되지 않았다. 행동 탭은 속성에 이미 수집된 `copy` 집계를 표시한다. 실제 속성에서 복사 단계가 비어 있다면 해당 버튼의 수집을 확인한다.

- `share_click`의 공유 수단은 내장 `method`를 먼저 확인한다. 이 이벤트에서 내장 항목을 사용할 수 없으면 공유 수단 전용 이벤트 측정기준을 검토한다.
- 이벤트 범위 `mode`, `challenge`로 퀴즈 모드와 도전 유형을 비교할 수 있다.
- 이벤트 범위 `ctx`, `dir`로 관련 밈 탐색의 맥락과 방향을 비교할 수 있다.
- 이벤트 범위 `kind`로 제보 유형을 비교할 수 있다.
- `traffic_source`의 이벤트 범위 `in_app_browser`, `resolved_by`, 사용자 범위 `first_in_app_browser`로 앱 내 브라우저와 사이트 자체 귀속 판단을 분석할 수 있다.

## 로컬 시각 검증

`node scripts/ga4-playwright-previews.mjs`는 스텁 GA4 응답을 Axum과 같은 Maud 화면과 번들 CSS로 렌더링한다. Playwright가 탭 이동, SVG 이름과 제목, 펼침 표, 가로 넘침을 검증하고 아래 화면을 저장한다.

| 탭 | 1440×900 | 390×844 |
| --- | --- | --- |
| 개요 | [데스크톱](../artifacts/ga4-advanced/analytics-overview-1440x900.png) | [모바일](../artifacts/ga4-advanced/analytics-overview-390x844.png) |
| 유입 | [데스크톱](../artifacts/ga4-advanced/analytics-acquisition-1440x900.png) | [모바일](../artifacts/ga4-advanced/analytics-acquisition-390x844.png) |
| 행동 | [데스크톱](../artifacts/ga4-advanced/analytics-behaviour-1440x900.png) | [모바일](../artifacts/ga4-advanced/analytics-behaviour-390x844.png) |
| 이탈 | [데스크톱](../artifacts/ga4-advanced/analytics-dropoff-1440x900.png) | [모바일](../artifacts/ga4-advanced/analytics-dropoff-390x844.png) |
| 실시간 | [데스크톱](../artifacts/ga4-advanced/analytics-realtime-1440x900.png) | [모바일](../artifacts/ga4-advanced/analytics-realtime-390x844.png) |
