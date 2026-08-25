# MemeCatch MPE worker AWS deployment

This directory defines two production stacks for the MPE media worker in
`ap-northeast-2`:

- `template.yaml`: credential-free foundation;
- `runtime.yaml`: credential-referencing ECS task definition and service.

The foundation contains:

- immutable, scan-on-push ECR repository retaining the latest 10 images;
- ECS cluster with Container Insights disabled;
- CloudWatch log group with 14-day retention;
- no-ingress security group with HTTPS-only IPv4 egress;
- ECS task execution role that can read exactly the two expected SSM parameters.

The foundation deliberately does **not** create SSM parameters, an ECS task
definition, an ECS service, or any running compute. The runtime stack creates a
task definition and ECS service, but defaults `DesiredCount` to `0`, creates no
parameters, and does not start compute unless explicitly updated.

## Validate

Validation does not deploy resources:

```sh
aws cloudformation validate-template \
  --region ap-northeast-2 \
  --template-body file://infra/mpe-worker/template.yaml

aws cloudformation validate-template \
  --region ap-northeast-2 \
  --template-body file://infra/mpe-worker/runtime.yaml
```

## Deploy the foundation

Choose the existing production VPC explicitly. Deployment creates an IAM role,
so `CAPABILITY_NAMED_IAM` is required.

```sh
aws cloudformation deploy \
  --region ap-northeast-2 \
  --stack-name memecatch-mpe-worker-foundation \
  --template-file infra/mpe-worker/template.yaml \
  --parameter-overrides VpcId=vpc-REPLACE_ME \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset
```

## Read outputs

```sh
aws cloudformation describe-stacks \
  --region ap-northeast-2 \
  --stack-name memecatch-mpe-worker-foundation \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
  --output table
```

## Runtime preflight gate

Do not deploy the runtime stack until all checks below pass:

1. Apply and verify
   `supabase/migrations/20260825090000_mpe_job_lease_heartbeat.sql` in production.
2. Deploy the foundation and record its cluster name, execution role ARN, log
   group name, security group ID, and expected SSM parameter ARNs.
3. Provision both expected values as existing SSM `SecureString` parameters.
   Rotate the previously exposed OpenRouter key before storing it. Never pass
   secret values through CloudFormation parameters or command lines.
4. Confirm the execution role can read exactly those two parameter ARNs and, if
   a customer-managed KMS key is used, decrypt them through SSM.
5. Build an ARM64 worker image, scan it, push it to the foundation ECR
   repository, and resolve its immutable `repo@sha256:...` URI. Tags are not
   accepted by the runtime template.
6. Select at least two public subnets in different Availability Zones. Each must
   route `0.0.0.0/0` through an internet gateway because the service enables a
   public IP and has no NAT or VPC endpoint dependency.
7. Confirm the OpenRouter account has sufficient balance for the configured STT
   model and that Ox Alpha capacity is acceptable for production traffic.

## Deploy the non-running runtime

Use the foundation outputs and the exact digest URI. Keeping `DesiredCount=0`
registers the task definition and service without starting a task:

```sh
aws cloudformation deploy \
  --region ap-northeast-2 \
  --stack-name memecatch-mpe-worker-runtime \
  --template-file infra/mpe-worker/runtime.yaml \
  --parameter-overrides \
    ClusterName=memecatch-prod \
    ExecutionRoleArn=arn:aws:iam::ACCOUNT_ID:role/memecatch-prod-mpe-worker-execution \
    LogGroupName=/ecs/memecatch/mpe-worker \
    SecurityGroupId=sg-REPLACE_ME \
    PublicSubnet1Id=subnet-REPLACE_ME_A \
    PublicSubnet2Id=subnet-REPLACE_ME_B \
    ImageUri=ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/memecatch/mpe-worker@sha256:REPLACE_WITH_64_HEX_DIGEST \
    SupabaseUrl=https://PROJECT_REF.supabase.co \
    SupabaseServiceRoleKeyParameterArn=arn:aws:ssm:ap-northeast-2:ACCOUNT_ID:parameter/memecatch/prod/mpe-worker/supabase-service-role-key \
    OpenRouterApiKeyParameterArn=arn:aws:ssm:ap-northeast-2:ACCOUNT_ID:parameter/memecatch/prod/mpe-worker/openrouter-api-key \
    DesiredCount=0 \
  --no-fail-on-empty-changeset
```

Review the task definition, service events, network configuration, secret ARN
references, and log configuration while it is still at zero tasks.

## Start or update the worker

Only after preflight and zero-count review, update the same stack. Use a newly
resolved digest for each release; never replace it with a mutable tag.

```sh
aws cloudformation deploy \
  --region ap-northeast-2 \
  --stack-name memecatch-mpe-worker-runtime \
  --template-file infra/mpe-worker/runtime.yaml \
  --parameter-overrides \
    ClusterName=memecatch-prod \
    ExecutionRoleArn=arn:aws:iam::ACCOUNT_ID:role/memecatch-prod-mpe-worker-execution \
    LogGroupName=/ecs/memecatch/mpe-worker \
    SecurityGroupId=sg-REPLACE_ME \
    PublicSubnet1Id=subnet-REPLACE_ME_A \
    PublicSubnet2Id=subnet-REPLACE_ME_B \
    ImageUri=ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/memecatch/mpe-worker@sha256:REPLACE_WITH_64_HEX_DIGEST \
    SupabaseUrl=https://PROJECT_REF.supabase.co \
    SupabaseServiceRoleKeyParameterArn=arn:aws:ssm:ap-northeast-2:ACCOUNT_ID:parameter/memecatch/prod/mpe-worker/supabase-service-role-key \
    OpenRouterApiKeyParameterArn=arn:aws:ssm:ap-northeast-2:ACCOUNT_ID:parameter/memecatch/prod/mpe-worker/openrouter-api-key \
    DesiredCount=1 \
  --no-fail-on-empty-changeset

aws ecs wait services-stable \
  --region ap-northeast-2 \
  --cluster memecatch-prod \
  --services memecatch-mpe-worker
```

The service uses the ECS deployment circuit breaker with rollback enabled. A
failed deployment returns to the last healthy task definition when one exists.

## Runtime rollback

The safest immediate stop is a stack update with the current parameters and
`DesiredCount=0`. To roll back code, redeploy a previously verified image digest
with the intended desired count. Do not use a tag as a rollback pointer.

After scaling to zero, the runtime stack can be removed without affecting the
foundation, ECR images, logs, or externally managed SSM parameters:

```sh
aws cloudformation delete-stack \
  --region ap-northeast-2 \
  --stack-name memecatch-mpe-worker-runtime

aws cloudformation wait stack-delete-complete \
  --region ap-northeast-2 \
  --stack-name memecatch-mpe-worker-runtime
```

## Roll back/remove

```sh
aws cloudformation delete-stack \
  --region ap-northeast-2 \
  --stack-name memecatch-mpe-worker-foundation

aws cloudformation wait stack-delete-complete \
  --region ap-northeast-2 \
  --stack-name memecatch-mpe-worker-foundation
```

The ECR repository has `DeletionPolicy: Retain`, so stack deletion intentionally
preserves published images. Remove that retained repository separately only
after confirming it is no longer needed.

## Production gate and order

Do not create or start the worker until all of these gates are satisfied:

1. Apply and verify `supabase/migrations/20260825090000_mpe_job_lease_heartbeat.sql`
   in production.
2. Deploy this foundation stack and inspect its outputs.
3. Provision the following values as `SecureString` parameters through the
   approved secret-management process; never put real values in this template,
   source control, shell history, image layers, or build logs:
   - `/memecatch/prod/mpe-worker/supabase-service-role-key`
   - `/memecatch/prod/mpe-worker/openrouter-api-key`
4. Rotate the OpenRouter key that was exposed outside the secret-management
   boundary before production use.
5. Build, scan, and push a uniquely tagged image to the output ECR repository.
6. Deploy `runtime.yaml` with the exact image digest, foundation outputs, exact
   SSM parameter ARNs, and `DesiredCount=0`.
7. Review the non-running service, then update it to `DesiredCount=1` only after
   every production gate passes.

Real-secret creation, database migration execution, and image push are external
production gates. The runtime stack creates task/service definitions but starts
no compute by default.
