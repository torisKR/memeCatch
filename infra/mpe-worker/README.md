# MemeCatch MPE worker AWS foundation

This directory defines only the credential-free production foundation for the
MPE media worker in `ap-northeast-2`:

- immutable, scan-on-push ECR repository retaining the latest 10 images;
- ECS cluster with Container Insights disabled;
- CloudWatch log group with 14-day retention;
- no-ingress security group with HTTPS-only IPv4 egress;
- ECS task execution role that can read exactly the two expected SSM parameters.

The stack deliberately does **not** create SSM parameters, an ECS task
definition, an ECS service, or any running compute.

## Validate

Validation does not deploy resources:

```sh
aws cloudformation validate-template \
  --region ap-northeast-2 \
  --template-body file://infra/mpe-worker/template.yaml
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
6. Only then create a separately reviewed task definition/service referencing
   the exact image digest, stack outputs, and SSM parameter ARNs.

Real-secret creation, database migration execution, image push, task/service
creation, and compute startup are intentional external-production gates and are
not performed by this stack.
