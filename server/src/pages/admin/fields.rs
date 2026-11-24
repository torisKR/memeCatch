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
/// `SENTIMENT_OPTIONS` and `SENTIMENT_ADMIN_LABELS`.
pub const SENTIMENTS: [(&str, &str); 5] = [
    ("funny", "유머"),
    ("ironic", "풍자"),
    ("controversial", "논쟁"),
    ("negative", "부정"),
    ("wholesome", "훈훈"),
];
/// `SOURCE_ROLE_LABELS` and `RIGHTS_BASIS_LABELS` of lib/sources/review.ts.
pub const SOURCE_ROLES: [(&str, &str); 5] = [
    ("original", "원본"),
    ("official_reupload", "공식 재업로드"),
    ("earliest_known", "최초 확인 출처"),
    ("secondary_reference", "2차 참고 자료"),
    ("usage_example", "사용 예시"),
];
pub const RIGHTS_BASES: [(&str, &str); 7] = [
    ("official_embed", "공식 임베드"),
    ("creator_permission", "창작자 허가"),
    ("creative_commons", "크리에이티브 커먼즈"),
    ("public_data", "공공 데이터"),
    ("link_only", "링크만 허용"),
    ("unknown", "권리 미확인"),
    ("blocked", "저작권 위험 차단"),
];
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
