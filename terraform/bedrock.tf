locals {
  bedrock_inference_profile_id  = "global.anthropic.claude-sonnet-5"
  bedrock_inference_profile_arn = "arn:aws:bedrock:${var.region}:${data.aws_caller_identity.current.account_id}:inference-profile/${local.bedrock_inference_profile_id}"
  bedrock_foundation_model_arn  = "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-5"
}

# OCI VM의 앱 컨테이너가 Bedrock을 호출할 때 쓸 최소 권한 사용자.
# 액세스 키는 콘솔/CLI로 별도 발급해 VM의 AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY에만 둔다.
resource "aws_iam_user" "bedrock" {
  name = "memecatch-bedrock"
}

data "aws_iam_policy_document" "bedrock_inference" {
  statement {
    sid       = "UseClaudeSonnet5GlobalInferenceProfile"
    actions   = ["bedrock:InvokeModel"]
    resources = [local.bedrock_inference_profile_arn]
  }

  statement {
    sid       = "RouteGlobalProfileToClaudeSonnet5FoundationModel"
    actions   = ["bedrock:InvokeModel"]
    resources = [local.bedrock_foundation_model_arn]

    condition {
      test     = "StringEquals"
      variable = "bedrock:InferenceProfileArn"
      values   = [local.bedrock_inference_profile_arn]
    }
  }
}

resource "aws_iam_user_policy" "bedrock_inference" {
  name   = "claude-haiku-4-5-global-inference-only"
  user   = aws_iam_user.bedrock.name
  policy = data.aws_iam_policy_document.bedrock_inference.json
}

resource "aws_budgets_budget" "bedrock" {
  name         = "memecatch-bedrock-monthly"
  budget_type  = "COST"
  limit_amount = var.bedrock_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Bedrock", "AWS Marketplace"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
