# Bedrock Meme Studio 운영

## 범위

- 리전: `ap-northeast-2`
- 모델: `global.anthropic.claude-sonnet-5`만 허용
- 생성 온도: 기존 품질 기준값 `0.4`로 고정하고, Sonnet 5는 운영 canary에서 별도 확인
- 호출: 관리자 Meme Studio에서 한 번에 초안 3개 생성
- 인증: IAM 사용자 `memecatch-bedrock`의 액세스 키를 OCI VM `/opt/memecatch/.env`에만 두고 AWS SDK 기본 자격증명 체인으로 읽는다.
- 권한: `bedrock:InvokeModel`만 허용한다.

## 비용 경계

앱 사용량 원장의 누적 예상 비용 `$100`이 동기식 하드 캡이다. 입력 4,096 토큰과 최대 출력 2,048 토큰 비용을 호출 전에 고정 예약한다. Claude Sonnet 5 단가 입력 `$3/M`, 출력 `$15/M` 기준 요청당 `$0.043008`을 예약하므로 빈 원장에서는 최대 약 2,325회 요청이 가능하다. 모델 전환 시에도 기존 원장 누적액과 요청 수를 그대로 승계하며, 한도 도달 시 Bedrock 요청을 보내지 않는다.

`memecatch-bedrock-monthly` AWS Budget은 `Amazon Bedrock`과 Sonnet 5가 청구될 수 있는 `AWS Marketplace` 서비스 비용을 함께 감시해 80%와 100%에서 이메일을 보내는 지연형 보조 경보다. Marketplace의 다른 상품 비용도 포함될 수 있다. 결제 데이터 반영과 알림에는 시간이 걸릴 수 있으므로 하드 캡이나 kill switch로 취급하지 않는다. 기존 `memecatch-monthly` `$50` 전체 계정 Budget은 변경하지 않는다.

## 최초 설정

1. `BEDROCK_MEME_STUDIO_ENABLED=false` 상태로 배포돼 있는지 확인한다.
2. Terraform 변경을 검토하고 적용한다(Vercel OIDC provider·역할을 IAM 사용자로 교체).

   ```bash
   cd terraform
   terraform init
   terraform plan -out=bedrock.tfplan
   terraform show bedrock.tfplan   # OIDC provider·memecatch-vercel-bedrock 역할 삭제, memecatch-bedrock 사용자·인라인 정책 생성만 있어야 한다
   terraform apply bedrock.tfplan
   ```

3. 액세스 키를 발급한다(키는 state·저장소에 남기지 않는다).

   ```bash
   aws iam create-access-key --user-name "$(terraform output -raw bedrock_iam_user)"
   ```

4. OCI VM `/opt/memecatch/.env`에 다음 값을 넣고 `bash scripts/deploy-oci.sh`로 재기동한다.

   ```text
   AWS_REGION=ap-northeast-2
   AWS_ACCESS_KEY_ID=<발급한 키>
   AWS_SECRET_ACCESS_KEY=<발급한 비밀값>
   BEDROCK_MEME_STUDIO_ENABLED=false
   BEDROCK_MEME_STUDIO_INPUT_NANO_USD_PER_TOKEN=3000
   BEDROCK_MEME_STUDIO_OUTPUT_NANO_USD_PER_TOKEN=15000
   ```

5. AI 호출 없는 일반 smoke test(로그인, 관리자 화면, 공개 카드)를 통과시킨 뒤 `BEDROCK_MEME_STUDIO_ENABLED=true`로 바꿔 재기동하고, 관리자 canary 1회로 초안 3개 생성과 원장 증가를 확인한다. canary 실패 시 즉시 `false`로 되돌린다.

## 확인 및 중단

- 관리자 권한으로 초안 3개를 생성하고, 요청당 원장 예약과 누적 비용 증가를 확인한다.
- 관리자 외 요청과 다른 Bedrock 모델 호출은 모두 거부되어야 한다.
- 즉시 중단은 앱의 생성 enable flag로 신규 호출을 막는다. AWS Budget 알림을 기다리지 않는다.
- 키 유출이 의심되면 `aws iam delete-access-key`로 즉시 폐기하고 새 키를 발급한다. 장애 조사 중에는 생성 경로만 비활성화한다.
