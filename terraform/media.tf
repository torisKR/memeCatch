# 밈 썸네일·업로드 저장소 (현재 Cloudflare R2 → S3 이전 대상).
# 앱은 이미 aws4fetch로 SigV4 서명을 하고 있어 엔드포인트·자격증명 교체 수준으로 붙는다.
resource "aws_s3_bucket" "media" {
  count  = var.enable_media_cdn ? 1 : 0
  bucket = var.media_bucket_name
}

# 공개 버킷을 만들지 않는다 — CloudFront(OAC)만 읽을 수 있게 한다.
resource "aws_s3_bucket_public_access_block" "media" {
  count                   = var.enable_media_cdn ? 1 : 0
  bucket                  = aws_s3_bucket.media[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  count  = var.enable_media_cdn ? 1 : 0
  bucket = aws_s3_bucket.media[0].id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  count  = var.enable_media_cdn ? 1 : 0
  bucket = aws_s3_bucket.media[0].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# IA 전환은 일부러 넣지 않는다 — 이 서비스의 이미지는 객체당 약 25KB인데
# STANDARD_IA는 객체당 최소 128KB로 과금되고 조회 요금·30일 최소 보관이 붙어
# Standard보다 비싸진다(작은 객체에서 흔한 역효과). 총 용량도 13MB 수준이라
# 계층화 이득이 없다. 미완성 멀티파트 정리만 남긴다.
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  count  = var.enable_media_cdn ? 1 : 0
  bucket = aws_s3_bucket.media[0].id
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Origin Access Control — CloudFront만 S3를 읽게 하는 현행 권장 방식(OAI 아님).
resource "aws_cloudfront_origin_access_control" "media" {
  count                             = var.enable_media_cdn ? 1 : 0
  name                              = "memecatch-media-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "media" {
  count       = var.enable_media_cdn ? 1 : 0
  enabled     = true
  comment     = "memecatch media (thumbnails, uploads)"
  price_class = "PriceClass_200" # 아시아 포함, 남미·아프리카 제외로 비용 절감

  origin {
    domain_name              = aws_s3_bucket.media[0].bucket_regional_domain_name
    origin_id                = "media-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.media[0].id
  }

  default_cache_behavior {
    target_origin_id       = "media-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS 관리형 정책: CachingOptimized — 이미지 정적 자산에 적합
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# CloudFront 배포만 이 버킷을 읽을 수 있게 하는 버킷 정책
data "aws_iam_policy_document" "media_read" {
  count = var.enable_media_cdn ? 1 : 0
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media[0].arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.media[0].arn]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  count  = var.enable_media_cdn ? 1 : 0
  bucket = aws_s3_bucket.media[0].id
  policy = data.aws_iam_policy_document.media_read[0].json
}
