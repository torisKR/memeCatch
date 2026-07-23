# 밈캐치 아키텍처

> 어떤 서비스가 무엇을 맡고, **왜 그렇게 정했는지**를 남긴다.
> 특히 "AWS로 옮길까?"는 여러 번 다시 떠오르는 질문이라 실측 근거를 함께 기록한다.
> 최종 갱신: 2026-07-19

## 한 줄 요약

앱은 **Vercel**, 데이터·인증은 **Supabase**, 이미지는 **Cloudflare R2**, 결제는 **Latpeed**,
메일 발송만 **AWS SES**. AWS는 기존 스택을 대체하지 않고 비어 있던 자리 하나를 채운다.

## 서비스 분담

| 담당 | 서비스 | 비고 |
| --- | --- | --- |
| 앱 호스팅·배포·크론 | Vercel | GitHub `main` 푸시 시 자동 배포. ISR/SSG 비중 높음(SEO) |
| DB·인증·RLS·RPC | Supabase | 프로젝트 `onjipuldngbdptldkpoe` (ap-northeast-1) |
| 밈 이미지·업로드 | Cloudflare R2 | `/api/media` 프록시 경유. aws4fetch로 SigV4 서명 |
| 유료 멤버십 결제 | Latpeed | 웹훅 → `process_latpeed_membership_event` |
| **메일 발송** | **AWS SES** | 계정 `264144511402`, ap-northeast-2 |

광고는 Google AdSense + 쿠팡 파트너스(하단 고정 도크).

## AWS는 무엇을 하고, 무엇을 하지 않는가

Terraform으로 만든 리소스는 **9개뿐이고 전부 AWS 계정 안에서만** 존재한다
(`terraform/`, `terraform state list`로 확인 가능).

- **SES** — 도메인 인증 + DKIM + 설정세트(TLS 필수·반송/불만 CloudWatch 기록)
- **발송 전용 IAM 사용자** `memecatch-mailer` — `noreply@catchmeme.com`에서만 보낼 수 있게 조건 제한
- **보안 기준선** — 계정 레벨 S3 퍼블릭 차단, IAM 비밀번호 정책
- **예산 경보** — 월 $50 기준, 실사용 80%·예측 100%에서 알림

Terraform은 AWS 자격증명만 갖고 있어 **Vercel·Supabase·R2를 건드릴 수단이 없다.**
AWS를 통째로 지워도 사이트는 그대로 동작한다(메일 기능만 사라짐).

## 결정 기록

### 미디어를 S3+CloudFront로 옮기지 않는다

`enable_media_cdn = false`(기본값). 검토했으나 실측 결과 역효과라 보류했다.

측정치(2026-07-19, `meme_contents` 2,650건):

| 썸네일 출처 | 개수 | 비중 | 우리 비용 |
| --- | --- | --- | --- |
| YouTube 핫링크 | 2,110 | 80% | $0 (유튜브 CDN 부담) |
| 자체 호스팅(R2) | 509 | 19% | R2 이그레스 $0 |
| 썸네일 없음 | 31 | 1% | — |

- 자체 호스팅은 509개 × 약 25KB ≈ **13MB**. 스토리지 비용 월 $0.0003 수준이라
  **크레딧 소진 효과가 사실상 없다**(AWS 크레딧을 쓰려던 원래 목적이 달성되지 않음).
- R2는 이그레스가 영구 $0인데 CloudFront는 서울 기준 GB당 약 $0.12.
  **트래픽이 늘수록(= 성공할수록) 비용만 붙는** 구조다.
- 이관 작업(파일 이동 + 앱 코드 + DB URL 509건 갱신 + 롤백 계획)의 리스크만 실재한다.

**다시 볼 트리거**: 자체 호스팅 이미지가 수천 개로 늘거나 R2에서 실제 과금이 발생할 때.

### 크론을 Lambda+EventBridge로 옮기지 않는다

Vercel Cron이 이미 있고 무료다.
**다시 볼 트리거**: Vercel 함수 실행시간 제한에 실제로 막힐 때(예: 장시간 밈 수집 배치).

### 출처 수집 파이프라인 (2026-07-23 추가)

외부 미디어는 `yt-dlp` 대량 다운로드가 아니라 **공식 API·oEmbed 후보 발견 → 운영자 검수(`/admin/sources`) → 링크·공식 임베드만 게시** 구조다.
`media_sources`/`meme_media`/`meme_claims` 원장은 RLS로 운영자만 열고, 승인된 행만 기존 `meme_contents`/`meme_sources`로 복사해 공개한다.
YouTube 메타데이터는 30일 갱신·삭제 대응이 필요해 Vercel Cron(`/api/cron/source-refresh`, 17:00 UTC)이 7일 주기로 공개·임베드 상태를 재확인한다.
YouTube 조회수 등 API 지표는 파생 점수에 쓰지 않는다(트렌드 점수는 자체 view_events만).

### 저장 계층(S3 IA) 전환을 넣지 않는다

이미지가 객체당 약 25KB인데 `STANDARD_IA`는 **객체당 최소 128KB로 과금**되고
조회 요금·30일 최소 보관이 붙어 Standard보다 비싸진다(작은 객체에서 흔한 역효과).

### 전체 스택을 AWS로 이전하지 않는다

인프라를 만지는 사람이 1명이라 완전관리형만 감당 가능하다.
Vercel+Supabase는 현재 비용이 거의 없고 운영 부담도 낮다.
특별한 이유(대량 크레딧 소진 압박, 규제, 락인 회피)가 생기기 전에는 옮기지 않는다.

> 참고: 이 스택에서 AWS 크레딧을 의미 있게 소진할 수 있는 건 사실상 **Bedrock 추론**
> (밈 설명·사용예문 자동 생성, 자동 검수, 의미 검색)뿐이다. SES·미디어·크론은 모두 월 $1 미만이다.

## SES 설정 현황

DNS는 **Cafe24**에서 관리한다(`ns1.cafe24.com` 외). API 자동화가 안 되므로 수동 입력.

필요한 레코드 — Cafe24는 호스트명에 **도메인을 뺀 앞부분만** 입력한다:

| 호스트 | 타입 | 용도 |
| --- | --- | --- |
| `_amazonses` | TXT | 도메인 소유 확인 (필수) |
| `<token>._domainkey` × 3 | CNAME | DKIM 서명 (필수) |
| `@` | TXT | SPF `v=spf1 include:amazonses.com ~all` (권장) |
| `_dmarc` | TXT | DMARC (권장) |

실제 토큰 값은 `cd terraform && terraform output`으로 확인한다(문서에 하드코딩하지 않음).

주의사항:
- apex TXT에 기존 `google-site-verification` 레코드가 있다. SPF 추가 시
  **덮어쓰지 말고 공존**시켜야 Search Console 인증이 유지된다.
- 일부 국내 호스팅은 언더스코어(`_`) 레코드를 막는다. 막히면 DNS를 Cloudflare로
  옮기는 편이 낫다(무료, API 자동화 가능).

**샌드박스**: 기본 상태는 24시간 200통·초당 1통이며 인증된 주소로만 발송된다.
실사용 전 콘솔에서 **Request production access** 필요(승인 약 1일).

상태 확인:

```bash
aws ses get-identity-verification-attributes --identities catchmeme.com --region ap-northeast-2
aws ses get-send-quota --region ap-northeast-2   # 200/1 이면 아직 샌드박스
```

## 운영 메모

```bash
# 인프라 변경
cd terraform
terraform plan -out=tfplan     # 항상 plan으로 먼저 검토
terraform apply tfplan

# 미디어 CDN을 나중에 켤 경우
terraform apply -var enable_media_cdn=true
```

`terraform/.gitignore`가 state·tfvars를 제외한다. state는 현재 로컬 파일이므로
**여러 기기에서 작업하게 되면 S3 백엔드로 옮길 것**.

## 남은 작업

- [ ] Cafe24에 SES DNS 레코드 6개 입력 → 인증 완료 확인
- [ ] SES 프로덕션 액세스 신청(샌드박스 해제)
- [ ] 발송 IAM 액세스 키 발급 → Vercel env 등록
- [ ] 메일 발송 코드 + 주간 브리핑 크론 + 원클릭 수신거부 구현
