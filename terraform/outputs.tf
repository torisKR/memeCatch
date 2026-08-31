output "media_bucket" {
  description = "미디어 S3 버킷 이름 — 앱 env S3_BUCKET"
  value       = var.enable_media_cdn ? aws_s3_bucket.media[0].id : null
}

output "media_cdn_domain" {
  description = "CloudFront 도메인 — 앱 env MEDIA_CDN_URL (https:// 붙여 사용)"
  value       = var.enable_media_cdn ? aws_cloudfront_distribution.media[0].domain_name : null
}

output "media_s3_endpoint" {
  description = "S3 리전 엔드포인트 — aws4fetch 서명 대상"
  value       = "https://s3.${var.region}.amazonaws.com"
}

output "ses_verification_dns" {
  description = "SES 도메인 소유 확인용 TXT 레코드 — DNS에 추가할 것"
  value = {
    name  = "_amazonses.${var.domain}"
    type  = "TXT"
    value = aws_ses_domain_identity.main.verification_token
  }
}

output "ses_dkim_dns" {
  description = "DKIM CNAME 3개 — DNS에 모두 추가해야 서명 발송이 된다"
  value = [
    for token in aws_ses_domain_dkim.main.dkim_tokens : {
      name  = "${token}._domainkey.${var.domain}"
      type  = "CNAME"
      value = "${token}.dkim.amazonses.com"
    }
  ]
}

output "ses_recommended_dns" {
  description = "발신 평판을 위한 권장 레코드 (SPF/DMARC)"
  value = {
    spf   = { name = var.domain, type = "TXT", value = "v=spf1 include:amazonses.com ~all" }
    dmarc = { name = "_dmarc.${var.domain}", type = "TXT", value = "v=DMARC1; p=none; rua=mailto:${var.budget_alert_email}" }
  }
}

output "mailer_iam_user" {
  description = "SES 발송용 IAM 사용자 — 액세스 키는 콘솔/CLI로 별도 발급(코드에 남기지 않음)"
  value       = aws_iam_user.mailer.name
}

output "aws_account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "bedrock_vercel_role_arn" {
  description = "Vercel의 서버 전용 AWS_ROLE_ARN 환경변수에 등록할 Bedrock OIDC 역할"
  value       = aws_iam_role.vercel_bedrock.arn
}

output "bedrock_model_id" {
  description = "앱이 InvokeModel에 사용할 고정 Bedrock inference profile ID"
  value       = local.bedrock_inference_profile_id
}
