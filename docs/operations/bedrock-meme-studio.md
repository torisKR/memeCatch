# Bedrock Meme Studio 운영

## 범위

- 리전: `ap-northeast-2`
- 모델: `apac.amazon.nova-micro-v1:0`만 허용
- 호출: 관리자 Meme Studio에서 한 번에 초안 3개 생성
- 인증: Vercel Team OIDC 임시 자격증명만 사용하며 정적 AWS 키는 만들지 않는다.
- 권한: `bedrock:CountTokens`, `bedrock:InvokeModel`만 허용한다.

## 비용 경계

앱 사용량 원장의 누적 예상 비용 `$100`이 동기식 하드 캡이다. 호출 전에 토큰과 비용을 예약하고 한도 도달 시 Bedrock 요청을 보내지 않아야 한다.

`memecatch-bedrock-monthly` AWS Budget은 Bedrock 월 비용 80%와 100%에서 이메일을 보내는 지연형 보조 경보다. 결제 데이터 반영과 알림에는 시간이 걸릴 수 있으므로 하드 캡이나 kill switch로 취급하지 않는다. 기존 `memecatch-monthly` `$50` 전체 계정 Budget은 변경하지 않는다.

## 최초 설정

1. Vercel 프로젝트의 OIDC issuer mode를 **Team**으로 설정한다.
2. Terraform 변경을 검토하고 적용한다.

   ```bash
   cd terraform
   terraform init
   terraform plan \
     -target=aws_iam_role_policy.bedrock_inference \
     -target=aws_budgets_budget.bedrock \
     -out=bedrock.tfplan
   terraform show bedrock.tfplan
   terraform apply bedrock.tfplan
   ```

   기존 Terraform state가 복구되지 않은 환경에서는 전체 plan이 Bedrock 외 기존 리소스를 신규 생성 대상으로 표시할 수 있다. 위 Bedrock 전용 plan에 OIDC provider, 역할, 인라인 정책, Bedrock Budget과 그 의존성만 포함됐는지 확인하고 적용한다.

3. 출력값을 확인한다.

   ```bash
   terraform output -raw bedrock_vercel_role_arn
   terraform output -raw bedrock_model_id
   ```

4. Vercel 프로젝트 `memecatch`의 Preview와 Production 서버 환경변수에 다음 값을 등록한다.

   ```text
   AWS_ROLE_ARN=<bedrock_vercel_role_arn 출력값>
   AWS_REGION=ap-northeast-2
   BEDROCK_MEME_STUDIO_ENABLED=true
   BEDROCK_NOVA_MICRO_INPUT_NANO_USD_PER_TOKEN=50
   BEDROCK_NOVA_MICRO_OUTPUT_NANO_USD_PER_TOKEN=200
   ```

환경변수에는 액세스 키나 secret access key를 등록하지 않는다. 역할의 trust policy는 팀 `ironjustlikethatgmailcoms-projects`, 프로젝트 `memecatch`, 환경 `preview|production` subject와 Vercel 팀 audience만 허용한다.

## 확인 및 중단

- Preview에서 관리자 권한으로 초안 3개를 생성하고, 요청당 원장 예약과 누적 비용 증가를 확인한다.
- 관리자 외 요청, development OIDC subject, 다른 Vercel 프로젝트, 다른 Bedrock 모델 호출은 모두 거부되어야 한다.
- 즉시 중단은 앱의 생성 enable flag로 신규 호출을 막는다. AWS Budget 알림을 기다리지 않는다.
- IAM 역할은 삭제하지 않아도 되며, 장애 조사 중에는 생성 경로만 비활성화한다.
