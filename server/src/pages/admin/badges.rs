//! components/admin/badges.tsx: the moderation, safety and origin badges of
//! the operator screens (labels of lib/labels.ts).

use maud::{Markup, html};

/// `MODERATION_STATUS[status].admin` and `MOD_STYLE[status]`.
pub fn moderation(status: &str) -> (&'static str, &'static str) {
    match status {
        "pending" => ("대기", "text-muted bg-surface-2"),
        "fact_checking" => ("사실 확인 중", "text-safety-yellow bg-safety-yellow-bg"),
        "rights_checking" => ("저작권 확인 중", "text-safety-yellow bg-safety-yellow-bg"),
        "approved" => ("게시됨", "text-safety-green bg-safety-green-bg"),
        "limited" => ("제한 공개", "text-safety-gray bg-safety-gray-bg"),
        "rejected" => ("반려", "text-safety-red bg-safety-red-bg"),
        _ => ("", ""),
    }
}

/// The moderation statuses in their order (`Object.keys(MODERATION_STATUS)`).
pub const MODERATION_STATUSES: [&str; 6] = [
    "pending",
    "fact_checking",
    "rights_checking",
    "approved",
    "limited",
    "rejected",
];

/// `ModerationBadge`.
pub fn moderation_badge(status: &str) -> Markup {
    let (label, style) = moderation(status);
    html! {
        span class=(format!("inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium {style}")) { (label) }
    }
}

/// `SAFETY_LEVELS[level]`: icon and admin label.
pub fn safety(level: &str) -> (&'static str, &'static str) {
    match level {
        "green" => ("●", "안전"),
        "yellow" => ("▲", "주의"),
        "gray" => ("◌", "사어"),
        "red" => ("✕", "위험"),
        _ => ("", ""),
    }
}

/// `SafetyBadge`.
pub fn safety_badge(level: &str) -> Markup {
    let (icon, label) = safety(level);
    html! {
        span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium"
            style=(format!("color:var(--safety-{level});background:var(--safety-{level}-bg)")) {
            span aria-hidden="true" { (icon) } (label)
        }
    }
}

/// `OriginKindBadge`: only for the house originals.
pub fn origin_kind_badge(origin_kind: Option<&str>) -> Markup {
    html! {
        @if origin_kind == Some("house_original") {
            span class="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-medium text-foreground" { "자체 제작" }
        }
    }
}

/// `LIFECYCLE_STATUS[status].user`.
pub fn lifecycle(status: &str) -> &'static str {
    match status {
        "rising" => "급상승",
        "active" => "유행 중",
        "cooling" => "식는 중",
        "archived" => "추억 밈",
        _ => "",
    }
}
