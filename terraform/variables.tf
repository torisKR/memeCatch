variable "region" {
  description = "주 서비스 리전 (한국 사용자 대상 → 서울)"
  type        = string
  default     = "ap-northeast-2"
}

variable "domain" {
  description = "서비스 도메인 — SES 발신 도메인 인증에 사용"
  type        = string
  default     = "catchmeme.com"
}

variable "media_bucket_name" {
  description = "밈 썸네일·업로드 저장 버킷 (전역 고유해야 함)"
  type        = string
  default     = "memecatch-media"
}

variable "monthly_budget_usd" {
  description = "월 예산 — 크레딧이 있어도 초과 소진을 감지하기 위한 경보 기준"
  type        = number
  default     = 50
}

variable "budget_alert_email" {
  description = "예산 경보 수신 이메일"
  type        = string
}

variable "enable_media_cdn" {
  description = "미디어를 S3+CloudFront로 옮길지. 기본 false — 현재 자체호스팅 이미지가 509개(13MB)뿐이라 크레딧 소진 효과는 없고 R2($0 이그레스) 대비 만료 후 비용만 늘어난다."
  type        = bool
  default     = false
}
