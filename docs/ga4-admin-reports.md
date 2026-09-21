# 관리자 GA4 리포트

`/admin/analytics`는 내부 DB 통계와 별도로 Google Analytics Data API의 실제 응답을 표시한다. 운영자 인증을 DAL에서 먼저 확인하며, Node 서버에서만 OAuth 토큰과 보고서를 조회한다. 추가 패키지는 없다. 기존 `server-only`, `zod`, Node crypto와 REST를 사용한다.

## 배포 설정

배포 환경의 비밀 환경변수 저장소에 다음 이름으로 등록한다. 값을 저장소·로그·채팅에 넣지 않는다.

- `GA4_PROPERTY_ID`: GA4의 숫자 속성 ID. `G-...` 측정 ID 또는 `properties/...` 경로가 아니다.
- `GA4_SERVICE_ACCOUNT_EMAIL`: 서비스 계정 JSON의 `client_email`.
- `GA4_SERVICE_ACCOUNT_PRIVATE_KEY`: 서비스 계정 JSON의 `private_key` PEM. 실제 줄바꿈과 `\n` 이스케이프를 지원한다. RSA 2048비트 이상을 사용한다.

Google Cloud 프로젝트에서 **Google Analytics Data API**를 활성화하고, GA4 관리 → 속성 액세스 관리에서 해당 서비스 계정 이메일에 **Viewer** 권한을 부여한다. Workspace 도메인 전체 위임은 필요하지 않다. 서비스 계정 키는 최소 권한으로 보관·주기적으로 교체한다. 환경변수 등록 후 재배포한다.

`NEXT_PUBLIC_GA_ID`는 브라우저 수집용이며 보고서 인증을 대체하지 않는다. 위 세 변수에는 `NEXT_PUBLIC_` 접두사를 붙이지 않는다. 별도의 임의 JSON URL이나 token URI를 받지 않으며 Google 고정 엔드포인트만 호출한다.

## 데이터 해석과 장애

- 어제까지 최근 28일, GA4 속성 시간대 기준. 실시간 보고서가 아니며 데이터 처리 지연이 있을 수 있다.
- 활성 사용자, 세션, 페이지·화면 조회, 이벤트 수를 전체 기간/일별로 조회한다. 기간 활성 사용자는 일별 값을 합산하지 않고 차원 없는 별도 보고서에서 가져온다.
- Google이 반환한 날짜만 표시한다. 없는 날짜·빈 응답·장애를 0으로 채우지 않는다. 실제 응답에 포함된 0은 그대로 표시한다.
- 설정 누락, 설정 오류, 인증 오류, 권한 오류, 할당량, 연결 장애, 응답 검증 오류, 정상 빈 결과를 구분한다. Google 원문 오류·키·토큰은 UI 또는 로그로 내보내지 않는다.
- 개인정보 보호 임계값 적용 가능성은 별도 안내한다. 쿠키 동의·차단·수집 정의로 DB의 `view_events`와 수치가 다를 수 있다.
- 토큰/보고서는 공유 캐시나 Next Data Cache에 보관하지 않는다. 요청마다 권한을 확인하고 조회하며 각 Google 요청에 10초 제한을 적용한다.

## 검증 범위

네트워크 모킹 테스트는 JWT 서명/읽기 전용 scope, 인증 선행, 요청 형식, 응답 파싱, 빈 결과, 장애 및 비밀정보 비노출을 검증한다. 모킹 값은 운영 결과가 아니다. 실제 연결 확인은 위 설정을 제공한 배포에서 운영자로 페이지를 열어 수행해야 한다. 설정이 없는 배포는 'GA4 연결 설정 필요'가 정상이며, 실제 리포트 연결 완료로 간주하지 않는다.

## 공식 문서

- https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
- https://developers.google.com/identity/protocols/oauth2/service-account
