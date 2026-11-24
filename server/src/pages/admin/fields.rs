//! Form pieces the operator editors share: `SafetySelect`
//! (components/admin/safety-select.tsx) and the option lists of
//! components/admin/constants and lib/labels.ts.

use maud::{Markup, html};

pub const SAFETY: [(&str, &str, &str, &str); 4] = [
    ("green", "●", "안전", "써도 됨"),
    ("yellow", "▲", "주의", "맥락 주의"),
    ("gray", "◌", "사어", "이미 늦음"),
    ("red", "✕", "위험", "쓰면 위험"),
];
pub const CATEGORIES: [(&str, &str); 6] = [
    ("phrase", "밈 용어(유행어)"),
    ("dance", "챌린지 댄스"),
    ("song", "노래"),
    ("image", "밈 영상"),
    ("comment", "드라마 장면"),
    ("challenge", "챌린지 댄스"),
];
pub const DIFFICULTIES: [(&str, &str); 3] =
    [("beginner", "입문"), ("normal", "보통"), ("deep", "고인물")];
pub const CONTEXTS: [(&str, &str, &str); 4] = [
    ("work", "직장에서", "yellow"),
    ("friends", "친구끼리", "green"),
    ("family", "자녀·가족과", "yellow"),
    ("sns", "공개 SNS에서", "yellow"),
];
/// `SafetySelect`: the icon follows the chosen level (`ui/admin.js`).
pub fn safety_select(label: &str, name: &str, value: &str) -> Markup {
    let icon = SAFETY
        .iter()
        .find(|(level, ..)| *level == value)
        .map_or("", |(_, icon, ..)| *icon);
    html! {
        label class="block" {
            span class="mb-1 block text-base font-medium" { (label) }
            div class="flex items-center gap-2" {
                span aria-hidden="true" class="shrink-0 text-lg" style=(format!("color:var(--safety-{value})")) data-admin-safety-icon { (icon) }
                select class="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base" data-admin-field=(name) {
                    @for (level, icon, admin, user) in SAFETY {
                        option value=(level) selected[level == value] { (icon) " " (admin) " (" (user) ")" }
                    }
                }
            }
        }
    }
}
