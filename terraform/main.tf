terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

# 서비스 리전 — 한국 사용자 대상이라 서울.
provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = "memecatch"
      ManagedBy = "terraform"
    }
  }
}

# CloudFront의 ACM 인증서와 일부 글로벌 리소스는 us-east-1에만 만들 수 있다.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project   = "memecatch"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
