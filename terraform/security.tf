# Tier 1 (필수) — 계정 레벨 S3 퍼블릭 차단.
# 버킷 단위 차단만으로는 앞으로 만들 버킷이 실수로 공개될 수 있어, 계정 전체에 안전망을 건다.
# 점검 시점에 이 계정은 미설정 상태였다(NoSuchPublicAccessBlockConfiguration).
resource "aws_s3_account_public_access_block" "account" {
  account_id              = data.aws_caller_identity.current.account_id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Tier 1 — 액세스 키 유출 시 피해를 줄이기 위한 비밀번호 정책.
# (MFA 강제는 콘솔에서 사용자별로 등록해야 하므로 outputs의 안내로 대신한다.)
resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 14
  require_uppercase_characters   = true
  require_lowercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  allow_users_to_change_password = true
  max_password_age               = 180
}
