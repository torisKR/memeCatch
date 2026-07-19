# 크레딧이 있어도 예산 경보는 먼저 건다 — 크레딧 소진 후 과금 급등을 조기에 잡기 위함.
# 실제 사용량(ACTUAL) 80%와 예측(FORECASTED) 100%에서 각각 알린다.
resource "aws_budgets_budget" "monthly" {
  name         = "memecatch-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

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
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
