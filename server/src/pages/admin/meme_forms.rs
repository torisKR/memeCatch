//! The two forms of the meme editor (`meme.rs`): `MemeTranslationReview`
//! (components/admin/meme-translation-review.tsx) and `MemeEditForm`
//! (components/admin/meme-edit-form.tsx), as they first render.

use maud::{Markup, html};
use serde_json::json;
use sqlx::Row;
use sqlx::postgres::PgRow;

use super::fields::{CATEGORIES, CONTEXTS, DIFFICULTIES, SENTIMENTS, safety_select};
use super::format;
use super::translations::language;
use crate::routes::admin::translations::same_instant;

/// A translation of the meme, as the editor reads it.
pub struct Translation {
    pub locale: String,
    pub status: String,
    source_updated_at: String,
    translated_at: String,
    updated_at: String,
    reviewed_at: Option<String>,
    reviewed_by: Option<String>,
    title: String,
    summary: String,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    aliases: Vec<String>,
}

impl Translation {
    pub fn from_row(row: &PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            locale: row.try_get(0)?,
            status: row.try_get(1)?,
            source_updated_at: row.try_get(2)?,
            translated_at: row.try_get(3)?,
            updated_at: row.try_get(4)?,
            reviewed_at: row.try_get(5)?,
            reviewed_by: row.try_get(6)?,
            title: row.try_get(7)?,
            summary: row.try_get(8)?,
            description: row.try_get(9)?,
            origin: row.try_get(10)?,
            usage_note: row.try_get(11)?,
            caution: row.try_get(12)?,
            aliases: row.try_get(13)?,
        })
    }
}

fn date(value: Option<&str>) -> String {
    match value {
        None => "—".to_owned(),
        Some(value) => format::parse_timestamp_or_date(value)
            .map_or_else(|| value.to_owned(), format::kst_medium_short),
    }
}

const INPUT: &str = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20";

/// `MemeTranslationReview`.
pub fn translation_review(
    meme_id: &str,
    meme_updated_at: &str,
    translations: &[Translation],
    configured: bool,
) -> Markup {
    html! {
        section class="space-y-4" aria-labelledby="meme-translation-review-title" {
            div {
                h2 id="meme-translation-review-title" class="text-xl font-bold" { "다국어 번역 검수" }
                p class="mt-1 text-sm leading-relaxed text-muted" { "원문과 같은 revision의 번역만 검수 발행할 수 있습니다. 편집 저장 후에는 반드시 다시 검수해야 합니다." }
            }
            @if translations.is_empty() {
                p class="rounded-xl border border-border bg-surface p-5 text-sm text-muted" { "생성된 번역 초안이 없습니다. 오프라인 번역 배치가 만든 초안이 여기에 표시됩니다." }
            } @else {
                @for translation in translations { (translation_editor(meme_id, meme_updated_at, translation, configured)) }
            }
        }
    }
}

/// `TranslationEditor`.
fn translation_editor(
    meme_id: &str,
    meme_updated_at: &str,
    translation: &Translation,
    configured: bool,
) -> Markup {
    let fresh = same_instant(&translation.source_updated_at, meme_updated_at);
    let (label, badge) = match translation.status.as_str() {
        "reviewed" => ("검수 완료·발행", "bg-safety-green-bg text-safety-green"),
        "stale" => (
            "원문 변경·갱신 필요",
            "bg-safety-yellow-bg text-safety-yellow",
        ),
        _ => ("검수 전", "bg-surface-2 text-muted"),
    };
    let prefix = format!("[{}]", translation.locale);
    let body = json!({ "memeId": meme_id, "locale": translation.locale, "expectedTranslationUpdatedAt": translation.updated_at }).to_string();
    let reviewed = format!(
        "{}{}",
        date(translation.reviewed_at.as_deref()),
        translation
            .reviewed_by
            .as_deref()
            .map(|by| format!(" · {by}"))
            .unwrap_or_default()
    );
    let meta = |term: &str, value: String| html! { div { dt class="inline font-semibold" { (term) } " " dd class="inline" { (value) } } };
    let area = |label: &str, key: &str, value: &str, rows: &str| {
        html! {
            label class="block text-sm font-medium" {
                (label)
                textarea aria-label=(format!("{prefix} {label}")) rows=(rows) class=(INPUT) data-admin-field=(key) { (format::textarea(value)) }
            }
        }
    };
    html! {
        article class="space-y-4 rounded-xl border border-border bg-surface p-5" data-admin-controls="meme-translation"
            data-admin-key=(format!("meme-translation:{}", translation.locale)) data-admin-body=(body) data-admin-fresh=(fresh) {
            div class="flex flex-wrap items-start justify-between gap-3" {
                div {
                    div class="flex flex-wrap items-center gap-2" {
                        h3 class="text-lg font-semibold" { (language(&translation.locale)) " (" (translation.locale) ")" }
                        span class=(format!("rounded-full px-2.5 py-1 text-xs font-semibold {badge}")) { (label) }
                        span class=(format!("rounded-full px-2.5 py-1 text-xs font-semibold {}", if fresh { "bg-safety-green-bg text-safety-green" } else { "bg-safety-red-bg text-safety-red" })) {
                            (if fresh { "원문과 동일 revision" } else { "stale — 원문 revision 불일치" })
                        }
                    }
                    dl class="mt-2 grid gap-x-5 gap-y-1 text-xs text-muted sm:grid-cols-2" {
                        (meta("원문 수정", date(Some(meme_updated_at))))
                        (meta("번역 기준 원문", date(Some(&translation.source_updated_at))))
                        (meta("번역 생성", date(Some(&translation.translated_at))))
                        (meta("마지막 검수", reviewed))
                    }
                }
            }
            div class="grid gap-4 lg:grid-cols-2" {
                label class="block text-sm font-medium" { "제목" input aria-label=(format!("{prefix} 제목")) required class=(INPUT) value=(translation.title) data-admin-field="title"; }
                label class="block text-sm font-medium" { "별칭 (쉼표로 구분)" input aria-label=(format!("{prefix} 별칭")) class=(INPUT) value=(translation.aliases.join(", ")) data-admin-field="aliases"; }
            }
            label class="block text-sm font-medium" {
                "한 줄 요약"
                textarea aria-label=(format!("{prefix} 한 줄 요약")) required rows="2" class=(INPUT) data-admin-field="summary" { (format::textarea(&translation.summary)) }
            }
            (area("설명", "description", &translation.description, "6"))
            (area("유래", "origin", &translation.origin, "5"))
            (area("사용법", "usageNote", translation.usage_note.as_deref().unwrap_or_default(), "4"))
            (area("주의사항", "caution", translation.caution.as_deref().unwrap_or_default(), "4"))
            @if !fresh {
                p class="rounded-lg bg-safety-yellow-bg px-3 py-2.5 text-sm text-safety-yellow" { "한국어 원문이 번역 이후 변경됐습니다. 새 원문 기준 번역을 생성하기 전에는 검수 발행할 수 없습니다." }
            }
            div class="flex flex-wrap gap-2 border-t border-border pt-4" {
                span title=[(!configured).then_some("OPENAI_API_KEY 설정 필요")] {
                    button type="button" disabled[!configured] class="min-h-11 rounded-lg border border-accent bg-accent/10 px-4 text-sm font-semibold text-accent-text disabled:cursor-not-allowed disabled:opacity-40" data-admin-action="gpt" { "GPT-5.6 Sol high 검수" }
                }
                button type="button" class="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold disabled:opacity-50" data-admin-action="save" { (prefix) " 초안 저장" }
                button type="button" disabled[!fresh] class="min-h-11 rounded-lg bg-safety-green px-4 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40" data-admin-action="review" { (prefix) " 검수 완료·발행" }
                button type="button" disabled[translation.status == "stale"] class="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 text-sm font-semibold text-safety-yellow disabled:opacity-40" data-admin-action="stale" { (prefix) " stale로 되돌리기" }
            }
        }
    }
}

/// `MemeEditForm`'s `initial`.
pub struct EditInitial {
    pub title: String,
    pub summary: String,
    pub description: String,
    pub origin: String,
    pub usage_note: String,
    pub caution: String,
    pub aliases: Vec<String>,
    pub safety: String,
    pub lifecycle: String,
    pub category: String,
    pub difficulty: String,
    pub sentiment: String,
    pub year: Option<f64>,
    pub usage: [String; 4],
}

const EDIT_INPUT: &str =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none";
const LIFECYCLES: [(&str, &str); 4] = [
    ("rising", "급상승"),
    ("active", "유행 중"),
    ("cooling", "식는 중"),
    ("archived", "추억 밈"),
];

/// `MemeEditForm`.
pub fn edit_form(
    meme_id: &str,
    origin_kind: Option<&str>,
    configured: bool,
    initial: &EditInitial,
) -> Markup {
    let house = origin_kind == Some("house_original");
    let select = |label: &str, key: &str, options: &[(&str, &str)], value: &str| {
        html! {
            label class="block" {
                span class="mb-1 block text-base font-medium" { (label) }
                select class=(format!("{EDIT_INPUT} min-h-11")) data-admin-field=(key) {
                    @for (option, text) in options { option value=(option) selected[*option == value] { (text) } }
                }
            }
        }
    };
    let area = |label: &str, key: &str, value: &str, rows: &str| {
        html! {
            label class="block" {
                span class="mb-1 block text-base font-medium" { (label) }
                textarea rows=(rows) class=(EDIT_INPUT) data-admin-field=(key) { (format::textarea(value)) }
            }
        }
    };
    let hint = if configured {
        "GPT-5.6 Sol high가 영문·혼합 언어 내용을 한국어 검수 초안으로 정리해요."
    } else {
        "OPENAI_API_KEY를 설정하면 GPT-5.6 Sol high 검수 초안을 사용할 수 있어요."
    };
    html! {
        form class="space-y-4 rounded-xl border border-border bg-surface p-5" data-admin-controls="meme-edit" data-admin-meme=(meme_id) {
            div class="flex flex-wrap items-start justify-between gap-3" {
                div {
                    h2 class="text-lg font-semibold" { "밈 정보 편집" }
                    p class="mt-1 text-sm leading-relaxed text-muted" { "영문·혼합 언어 항목은 한국어 초안을 만든 뒤 검토해서 저장할 수 있어요." }
                }
                span title=(hint) {
                    button type="button" disabled[!configured] class="min-h-11 rounded-lg border border-accent bg-accent/10 px-4 text-sm font-semibold text-accent-text transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50" data-admin-draft { "GPT-5.6 Sol high로 검수 초안" }
                }
            }
            div class="grid gap-4 lg:grid-cols-2" {
                label class="block" { span class="mb-1 block text-base font-medium" { "제목" } input required class=(EDIT_INPUT) value=(initial.title) data-admin-field="title"; }
                label class="block" { span class="mb-1 block text-base font-medium" { "별칭 (쉼표로 구분)" } input class=(EDIT_INPUT) value=(initial.aliases.join(", ")) data-admin-field="aliases"; }
            }
            label class="block" { span class="mb-1 block text-base font-medium" { "한 줄 요약" } input class=(EDIT_INPUT) value=(initial.summary) data-admin-field="summary"; }
            (area("설명", "description", &initial.description, "6"))
            label class="block" {
                span class="mb-1 block text-base font-medium" { (if house { "어떻게 만들었나요?" } else { "유래" }) }
                textarea rows="4" aria-describedby=[house.then_some("house-origin-hint")] class=(EDIT_INPUT) data-admin-field="origin" { (format::textarea(&initial.origin)) }
            }
            @if house {
                p id="house-origin-hint" class="-mt-2 text-sm text-muted" { "밈캐치가 이 형식을 만든 경위. 검수 메모나 게시 여부를 쓰지 말고, 인터넷 원출처나 연도를 지어내지 마세요." }
            }
            div class="grid gap-4 lg:grid-cols-2" {
                (area("사용 팁 (usage_note)", "usageNote", &initial.usage_note, "2"))
                (area("주의 문구 (caution)", "caution", &initial.caution, "2"))
            }
            div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" {
                (safety_select("사용 안전 신호등", "safetyLevel", &initial.safety))
                (select("생명주기", "lifecycleStatus", &LIFECYCLES, &initial.lifecycle))
                (select("카테고리", "category", &CATEGORIES, &initial.category))
                (select("난이도", "difficulty", &DIFFICULTIES, &initial.difficulty))
                (select("감정 결", "sentiment", &SENTIMENTS, &initial.sentiment))
                label class="block" {
                    span class="mb-1 block text-base font-medium" { (if house { "제작 연도" } else { "유행 시작 연도" }) }
                    input inputmode="numeric" placeholder="예: 2025" class=(EDIT_INPUT) value=(initial.year.map(crate::routes::js_json::number).unwrap_or_default()) data-admin-field="originYear";
                }
            }
            fieldset {
                legend class="mb-2 text-base font-medium" { "사용 맥락별 신호등 (4컨텍스트)" }
                div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                    @for ((key, label, _), level) in CONTEXTS.iter().zip(&initial.usage) { (safety_select(label, key, level)) }
                }
            }
            button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50" { "저장" }
        }
    }
}
