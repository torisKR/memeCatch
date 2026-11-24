//! `GET /admin/memes/catalog/new` (`app/(default)/admin/memes/catalog/new/page.tsx`):
//! `CatalogRegistrationForm` as it first renders; `ui/admin-memes.js` runs
//! the duplicate check and the registration (`routes/admin/catalog.rs`).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::fields::{
    CATEGORIES, CONTEXTS, DIFFICULTIES, RIGHTS_BASES, SENTIMENTS, SOURCE_ROLES, safety_select,
};
use super::shell::Root;
use crate::AppState;

const TITLE: &str = "외부 밈 카탈로그 등록";
const INPUT: &str = "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base";
const TEXTAREA: &str =
    "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base py-2.5";
const PLATFORMS: [(&str, &str); 7] = [
    ("youtube", "YouTube"),
    ("youtube_shorts", "YouTube Shorts"),
    ("tiktok", "TikTok"),
    ("instagram", "Instagram"),
    ("broadcast_archive", "방송 아카이브"),
    ("public_archive", "공공 아카이브"),
    ("web", "웹"),
];
const PRECISIONS: [(&str, &str); 5] = [
    ("exact", "정확한 날짜 근거"),
    ("year", "연도 근거"),
    ("approximate", "대략"),
    ("decade", "10년 단위"),
    ("unknown", "미확인"),
];

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    if let Err(redirect) = super::require_operator(
        &state,
        request.headers(),
        request.uri().path(),
        request.uri().query(),
    )
    .await
    {
        return redirect;
    }
    let main = html! {
        div class="space-y-6" {
            div {
                a href="/admin/memes" class="text-base text-muted hover:text-foreground" { "← 밈 관리로" }
                h1 class="mt-2 text-2xl font-bold" { (TITLE) }
            }
            (form())
        }
    };
    super::screen(&state, Root::Site, TITLE, "/admin/memes/catalog/new", main)
}

fn select(options: &[(&str, &str)], selected: &str, field: &str) -> Markup {
    html! {
        select class=(INPUT) data-admin-field=(field) {
            @for (value, label) in options { option value=(value) selected[*value == selected] { (label) } }
        }
    }
}

/// One source of the form; `ui/admin-memes.js` adds the others.
pub fn source(index: usize, role: &str, rights: &str) -> Markup {
    let (legend, roles, kind): (String, &[(&str, &str)], &str) = match index {
        0 => (
            "원문 또는 최초 확인 출처".to_owned(),
            &SOURCE_ROLES[..],
            "원문",
        ),
        1 => ("독립 검증 출처".to_owned(), &SOURCE_ROLES[..], "검증"),
        _ => (
            format!("추가 출처 {}", index - 1),
            &SOURCE_ROLES[..],
            "검증",
        ),
    };
    let allowed: Vec<(&str, &str)> = roles
        .iter()
        .copied()
        .filter(|(value, _)| match index {
            0 => matches!(*value, "original" | "earliest_known"),
            1 => matches!(*value, "secondary_reference" | "official_reupload"),
            _ => true,
        })
        .collect();
    // `["original", "earliest_known"]` and `["secondary_reference", "official_reupload"]` in that order.
    let allowed = match index {
        0 => vec![allowed[0], allowed[1]],
        1 => vec![allowed[1], allowed[0]],
        _ => allowed,
    };
    html! {
        fieldset class="space-y-3 rounded-lg border border-border p-4" data-admin-source {
            legend class="px-1 font-semibold" { (legend) }
            div class="grid gap-3 md:grid-cols-2" {
                label class="md:col-span-2" { "출처 URL" input aria-label=(format!("{kind} 출처 URL")) type="url" required class=(INPUT) value="" data-admin-field="url"; }
                label { "플랫폼" (select(&PLATFORMS, "web", "platform")) }
                label { "출처 역할" (select(&allowed, role, "sourceRole")) }
                label { "권리 상태" (select(&RIGHTS_BASES, rights, "rightsBasis")) }
                label { "출처 제목" input class=(INPUT) value="" data-admin-field="title"; }
                label { "제작자·채널" input class=(INPUT) value="" data-admin-field="creatorName"; }
                label { "검수 메모" input aria-label=(format!("{kind} 검수 메모")) maxlength="500" class=(INPUT) value="" data-admin-field="reviewNote"; }
            }
            @if index >= 2 {
                button type="button" class="min-h-11 rounded-lg border border-border px-3 text-sm text-muted" data-admin-remove { "이 출처 제거" }
            }
        }
    }
}

fn form() -> Markup {
    let roles = serde_json::to_string(&SOURCE_ROLES).unwrap_or_default();
    let year = |label: &str, field: &str| {
        html! { label { (label) input aria-label=(label) inputmode="numeric" class=(INPUT) value="" data-admin-field=(field); } }
    };
    html! {
        form class="space-y-6" data-admin-controls="catalog" data-admin-roles=(roles) {
            section class="rounded-xl border border-border bg-surface p-5" {
                h2 class="text-lg font-semibold" { (TITLE) }
                p class="mt-2 rounded-lg bg-safety-yellow-bg p-3 text-sm leading-relaxed text-safety-yellow" {
                    "자체 제작으로 표시하지 않습니다. 저장은 비공개 " strong { "대기" } " 상태만 만들며, 출처는 별도 검수 큐에서 사실·권리를 확인한 뒤 기존 수동 게시 절차를 따릅니다."
                }
            }
            section class="space-y-4 rounded-xl border border-border bg-surface p-5" data-admin-body {
                h2 class="text-lg font-semibold" { "사전 본문" }
                div class="grid gap-4 md:grid-cols-2" {
                    label { "제목" input aria-label="제목" required class=(INPUT) value="" data-admin-field="title"; }
                    label { "별칭 (쉼표로 구분)" input class=(INPUT) value="" data-admin-field="aliases"; }
                }
                label class="block" { "한 줄 요약" input aria-label="한 줄 요약" required class=(INPUT) value="" data-admin-field="summary"; }
                label class="block" { "설명" textarea aria-label="설명" required rows="5" class=(TEXTAREA) data-admin-field="description" {} }
                label class="block" { "기원·확산 설명" textarea aria-label="기원·확산 설명" required rows="4" class=(TEXTAREA) data-admin-field="origin" {} }
            }
            section class="space-y-4 rounded-xl border border-border bg-surface p-5" {
                h2 class="text-lg font-semibold" { "연도·분류·태그" }
                div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                    (year("원작 연도", "sourceWorkYear"))
                    (year("최초 밈 사용 연도", "memeFirstSeenYear"))
                    (year("한국 유행 연도", "koreaViralYear"))
                    label { "연도 정확도" (select(&PRECISIONS, "year", "yearPrecision")) }
                }
                label class="block" { "태그 (쉼표로 구분)" input aria-label="태그 (쉼표로 구분)" required class=(INPUT) value="" data-admin-field="tags"; }
                div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                    label { "카테고리" (select(&CATEGORIES, "image", "category")) }
                    label { "난이도" (select(&DIFFICULTIES, "normal", "difficulty")) }
                    label { "감정 결" (select(&SENTIMENTS, "funny", "sentiment")) }
                    (safety_select("사용 안전 신호등", "safetyLevel", "yellow"))
                }
            }
            section class="space-y-4 rounded-xl border border-border bg-surface p-5" data-admin-sources {
                div {
                    h2 class="text-lg font-semibold" { "원문·검증 출처" }
                    p class="text-sm text-muted" { "최종 HTTPS 공개 URL만 저장하며, 링크와 검수 메모는 HTML로 렌더하지 않습니다." }
                }
                (source(0, "earliest_known", "unknown"))
                (source(1, "secondary_reference", "link_only"))
                button type="button" class="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold disabled:opacity-50" data-admin-add { "출처 추가 (2/8)" }
            }
            fieldset class="rounded-xl border border-border bg-surface p-5" {
                legend class="px-1 text-lg font-semibold" { "사용 맥락별 신호등" }
                div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                    @for (key, label, level) in CONTEXTS { (safety_select(label, key, level)) }
                }
            }
            div class="flex flex-wrap gap-3" {
                button type="button" class="min-h-11 rounded-lg border border-border bg-surface px-5 font-semibold disabled:opacity-50" data-admin-check { "중복 검사" }
                button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-5 font-semibold text-white disabled:opacity-50" { "대기 상태로 등록" }
                a href="/admin/memes" class="inline-flex min-h-11 items-center rounded-lg px-4 text-muted underline" { "취소" }
            }
        }
    }
}
