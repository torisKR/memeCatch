# 발신 도메인 인증 — 주간 브리핑·비밀번호 재설정 메일 발송용.
# 검증에 필요한 DNS 레코드는 outputs.tf로 뽑아 catchmeme.com DNS에 직접 추가한다.
resource "aws_ses_domain_identity" "main" {
  domain = var.domain
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# 반송·수신거부를 추적해 발신 평판을 지킨다(하드바운스 누적 시 계정 정지 위험).
resource "aws_ses_configuration_set" "main" {
  name = "memecatch-default"

  reputation_metrics_enabled = true

  delivery_options {
    tls_policy = "Require"
  }
}

resource "aws_ses_event_destination" "cloudwatch" {
  name                   = "memecatch-events"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["send", "bounce", "complaint", "delivery", "reject"]

  cloudwatch_destination {
    default_value  = "default"
    dimension_name = "ses:configuration-set"
    value_source   = "messageTag"
  }
}

# 앱(Vercel)에서 SES로 발송할 때 쓸 최소 권한 사용자.
# 발송 외 권한은 주지 않으며, 지정한 도메인에서만 보낼 수 있게 제한한다.
resource "aws_iam_user" "mailer" {
  name = "memecatch-mailer"
}

data "aws_iam_policy_document" "mailer" {
  statement {
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "ses:FromAddress"
      values   = ["noreply@${var.domain}"]
    }
  }
}

resource "aws_iam_user_policy" "mailer" {
  name   = "memecatch-mailer-send"
  user   = aws_iam_user.mailer.name
  policy = data.aws_iam_policy_document.mailer.json
}
