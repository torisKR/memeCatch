locals {
  bedrock_inference_profile_id  = "apac.amazon.nova-micro-v1:0"
  bedrock_inference_profile_arn = "arn:aws:bedrock:${var.region}:${data.aws_caller_identity.current.account_id}:inference-profile/${local.bedrock_inference_profile_id}"
  bedrock_foundation_model_arns = [
    for region in [
      "ap-northeast-1",
      "ap-northeast-2",
      "ap-northeast-3",
      "ap-south-1",
      "ap-southeast-1",
      "ap-southeast-2",
    ] : "arn:aws:bedrock:${region}::foundation-model/amazon.nova-micro-v1:0"
  ]
  vercel_oidc_host = "oidc.vercel.com/${var.vercel_team_slug}"
  vercel_audience  = "https://vercel.com/${var.vercel_team_slug}"
}

resource "aws_iam_openid_connect_provider" "vercel" {
  url            = "https://${local.vercel_oidc_host}"
  client_id_list = [local.vercel_audience]
}

data "aws_iam_policy_document" "vercel_bedrock_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.vercel.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.vercel_oidc_host}:aud"
      values   = [local.vercel_audience]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.vercel_oidc_host}:sub"
      values = [
        "owner:${var.vercel_team_slug}:project:${var.vercel_project_name}:environment:preview",
        "owner:${var.vercel_team_slug}:project:${var.vercel_project_name}:environment:production",
      ]
    }
  }
}

resource "aws_iam_role" "vercel_bedrock" {
  name               = "memecatch-vercel-bedrock"
  assume_role_policy = data.aws_iam_policy_document.vercel_bedrock_trust.json
}

data "aws_iam_policy_document" "bedrock_inference" {
  statement {
    sid       = "UseNovaMicroInferenceProfile"
    actions   = ["bedrock:InvokeModel"]
    resources = [local.bedrock_inference_profile_arn]
  }

  statement {
    sid       = "RouteNovaMicroProfileToFoundationModels"
    actions   = ["bedrock:InvokeModel"]
    resources = local.bedrock_foundation_model_arns

    condition {
      test     = "StringEquals"
      variable = "bedrock:InferenceProfileArn"
      values   = [local.bedrock_inference_profile_arn]
    }
  }
}

resource "aws_iam_role_policy" "bedrock_inference" {
  name   = "nova-micro-inference-only"
  role   = aws_iam_role.vercel_bedrock.id
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
    values = ["Amazon Bedrock"]
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
