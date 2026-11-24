//! `GET /admin/memes/{id}` (`app/(default)/admin/memes/[id]/page.tsx`): the
//! meme editor. The status moves, the provenance of a catalog meme, the
//! origin country, the translations (`meme_forms.rs`), the linked contents
//! (`embed.rs`), the dictionary card of a house original and the edit form.
//! `ui/admin-memes.js` runs them against `routes/admin/meme_editor.rs` and
//! `translations.rs`.

use axum::extract::{Path, Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use serde_json::Value;
use sqlx::Row;
use sqlx::postgres::PgRow;

use super::badges::{moderation, moderation_badge, origin_kind_badge};
use super::embed::{Content, meme_embed};
use super::meme_forms::{EditInitial, Translation, edit_form, translation_review};
use super::meme_new::{PATH_NOTE, operator_path};
use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::pages::studio::{DictionaryDefaults, dictionary_studio};
use crate::routes::admin::translations::is_locale;
use crate::routes::public::labels;
use crate::routes::studio::COUNTRIES;

const TITLE: &str = "밈 편집";
const LIMITED_WARNING: &str = "제한 공개로 전환하면 사용자에게는 '출처 확인 중'으로 표시되고 추천·큐레이션에서 제외돼요. 출처나 저작권 문제가 해결되면 다시 게시로 되돌릴 수 있어요.";

async fn rows(
    state: &AppState,
    user: &SessionUser,
    sql: &'static str,
    id: &str,
) -> Result<Vec<PgRow>, sqlx::Error> {
    let id = id.to_owned();
    state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query(sql).bind(id).fetch_all(tx).await })
        })
        .await
}

const MEME: &str = "select id::text, short_id, slug, title, summary, description, origin, usage_note, caution, aliases, safety_level::text,
    lifecycle_status::text, category::text, difficulty::text, sentiment::text, origin_year::float8, usage_context::text, moderation_status::text,
    origin_kind, to_json(updated_at) #>> '{}', source_work_year::float8, meme_first_seen_year::float8, korea_viral_year::float8, year_precision::text
    from public.memes where id = $1::uuid";

pub struct Meme {
    pub id: String,
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub status: String,
    pub origin_kind: Option<String>,
    pub updated_at: String,
    pub edit: EditInitial,
    years: [Option<f64>; 3],
    precision: Option<String>,
}

fn meme_from(row: &PgRow) -> Result<Meme, sqlx::Error> {
    let usage: Option<String> = row.try_get(16)?;
    let usage: Value = usage
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null);
    let level = |key: &str| {
        usage
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or("yellow")
            .to_owned()
    };
    let text = |index: usize| -> Result<String, sqlx::Error> {
        Ok(row.try_get::<Option<String>, _>(index)?.unwrap_or_default())
    };
    Ok(Meme {
        id: row.try_get(0)?,
        short_id: row.try_get(1)?,
        slug: row.try_get(2)?,
        title: text(3)?,
        summary: text(4)?,
        status: text(17)?,
        origin_kind: row.try_get(18)?,
        updated_at: row.try_get(19)?,
        edit: EditInitial {
            title: text(3)?,
            summary: text(4)?,
            description: text(5)?,
            origin: text(6)?,
            usage_note: text(7)?,
            caution: text(8)?,
            aliases: row
                .try_get::<Option<Vec<String>>, _>(9)?
                .unwrap_or_default(),
            safety: text(10)?,
            lifecycle: text(11)?,
            category: text(12)?,
            difficulty: text(13)?,
            sentiment: text(14)?,
            year: row.try_get(15)?,
            usage: ["work", "friends", "family", "sns"].map(level),
        },
        years: [row.try_get(20)?, row.try_get(21)?, row.try_get(22)?],
        precision: row.try_get(23)?,
    })
}

/// A `meme_media` row: source id, role, rights, review state, note and the
/// source's URL and title.
type Provenance = (
    String,
    String,
    String,
    String,
    Option<String>,
    Option<(String, Option<String>)>,
);

struct Data {
    contents: Vec<Content>,
    translations: Vec<Translation>,
    sources: Vec<(Option<String>, Option<String>, Option<String>)>,
    provenance: Vec<Provenance>,
    tags: Vec<String>,
    profiles: Vec<(String, String, String)>,
}

async fn load(state: &AppState, user: &SessionUser, id: &str) -> Result<Data, sqlx::Error> {
    let contents = rows(state, user, "select platform, content_id, url, thumbnail_url, availability::text, caption, coalesce(is_representative, false), moderation_status::text
        from public.meme_contents where meme_id = $1::uuid order by is_representative desc, created_at asc", id)
    .await
    .unwrap_or_default()
    .iter()
    .filter_map(|row| {
        Some(Content {
            platform: row.try_get(0).ok()?,
            content_id: row.try_get(1).ok()?,
            url: row.try_get(2).ok()?,
            thumbnail_url: row.try_get(3).ok()?,
            availability: row.try_get(4).ok()?,
            caption: row.try_get(5).ok()?,
            is_representative: row.try_get(6).ok()?,
            moderation: row.try_get(7).ok()?,
        })
    })
    .collect();
    let translations = rows(state, user, "select t.locale, t.status, to_json(t.source_updated_at) #>> '{}', to_json(t.translated_at) #>> '{}', to_json(t.updated_at) #>> '{}',
        to_json(t.reviewed_at) #>> '{}', t.reviewed_by::text, t.title, t.summary, t.description, t.origin, t.usage_note, t.caution, t.aliases
        from public.meme_translations t where t.meme_id = $1::uuid order by t.locale asc", id)
    .await
    .unwrap_or_default()
    .iter()
    .filter_map(|row| Translation::from_row(row).ok())
    .filter(|translation| is_locale(&translation.locale) && matches!(translation.status.as_str(), "machine" | "reviewed" | "stale"))
    .collect();
    let sources = rows(state, user, "select source_url, source_role, rights_basis from public.meme_sources where meme_id = $1::uuid", id)
        .await
        .unwrap_or_default()
        .iter()
        .map(|row| (row.try_get(0).unwrap_or_default(), row.try_get(1).unwrap_or_default(), row.try_get(2).unwrap_or_default()))
        .collect();
    let provenance = rows(state, user, "select mm.source_id::text, mm.source_role, mm.rights_basis, mm.review_state, mm.reviewer_note, s.canonical_url, s.title
        from public.meme_media mm left join public.media_sources s on s.id = mm.source_id where mm.meme_id = $1::uuid order by mm.created_at asc", id)
    .await?
    .iter()
    .map(|row| {
        let url: Option<String> = row.try_get(5).unwrap_or_default();
        (
            row.try_get(0).unwrap_or_default(),
            row.try_get(1).unwrap_or_default(),
            row.try_get(2).unwrap_or_default(),
            row.try_get(3).unwrap_or_default(),
            row.try_get(4).unwrap_or_default(),
            url.map(|url| (url, row.try_get(6).unwrap_or_default())),
        )
    })
    .collect();
    let tags = rows(state, user, "select t.name from public.meme_tags_map m join public.tags t on t.id = m.tag_id where m.meme_id = $1::uuid", id)
        .await?
        .iter()
        .filter_map(|row| row.try_get(0).ok())
        .collect();
    let profiles = rows(
        state,
        user,
        "select market_code, local_title, review_state from public.meme_market_profiles
        where meme_id = $1::uuid and role = 'origin' order by created_at asc",
        id,
    )
    .await?
    .iter()
    .map(|row| {
        (
            row.try_get(0).unwrap_or_default(),
            row.try_get(1).unwrap_or_default(),
            row.try_get(2).unwrap_or_default(),
        )
    })
    .collect();
    Ok(Data {
        contents,
        translations,
        sources,
        provenance,
        tags,
        profiles,
    })
}

pub async fn page(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Response {
    let user = match super::require_operator(
        &state,
        request.headers(),
        request.uri().path(),
        request.uri().query(),
    )
    .await
    {
        Ok(user) => user,
        Err(redirect) => return redirect,
    };
    let found = rows(&state, &user, MEME, &id)
        .await
        .ok()
        .and_then(|rows| rows.first().map(meme_from));
    let Some(Ok(meme)) = found else {
        return super::super::html(
            StatusCode::NOT_FOUND,
            shell::not_found(&state.pages.site, TITLE),
        );
    };
    let main = match load(&state, &user, &id).await {
        Ok(data) => view(
            &meme,
            &data,
            crate::routes::admin::openai::configured(&state),
            labels::site_url(&state.config.site_url),
        ),
        Err(error) => {
            tracing::warn!(%error, "admin meme failed");
            shell::error_boundary()
        }
    };
    super::screen(
        &state,
        Root::Site,
        TITLE,
        &format!("/admin/memes/{id}"),
        main,
    )
}

fn view(meme: &Meme, data: &Data, configured: bool, site: &str) -> Markup {
    let house = meme.origin_kind.as_deref() == Some("house_original");
    let rights = data.sources.iter().find(|(url, role, basis)| {
        let url = url
            .as_deref()
            .map(crate::routes::public::js::trim)
            .unwrap_or_default()
            .to_lowercase();
        role.as_deref() == Some("original")
            && basis.as_deref() == Some("creator_permission")
            && (url.starts_with("http://") || url.starts_with("https://"))
    });
    html! {
        div class="space-y-6" {
            div {
                a href="/admin/memes" class="text-base text-muted hover:text-foreground" { "← 밈 관리로" }
                div class="mt-2 flex flex-wrap items-center gap-3" {
                    h1 class="text-2xl font-bold" { (meme.title) }
                    (moderation_badge(&meme.status))
                    (origin_kind_badge(meme.origin_kind.as_deref()))
                    @if matches!(meme.status.as_str(), "approved" | "limited") {
                        a href=(labels::meme_path(&meme.short_id, &meme.slug)) class="flex min-h-11 items-center text-base text-accent-text underline" { "공개 페이지 보기" }
                    }
                }
            }
            (status_controls(meme, house, rights.is_some(), rights.and_then(|(url, ..)| url.as_deref())))
            @if !house { (provenance(meme, data)) }
            (origin_country(meme, &data.profiles))
            (translation_review(&meme.id, &meme.updated_at, &data.translations, configured))
            (contents(meme, &data.contents, house))
            @if house {
                (dictionary_studio(&DictionaryDefaults {
                    name: meme.title.clone(),
                    summary: meme.summary.clone(),
                    safety: safety_label(&meme.edit.safety),
                    detail_url: format!("{}{}", site.trim_end_matches('/'), labels::meme_path(&meme.short_id, &meme.slug)),
                    source: "밈캐치 자체 제작".to_owned(),
                }))
            }
            (edit_form(&meme.id, meme.origin_kind.as_deref(), configured, &meme.edit))
        }
    }
}

/// `${SAFETY_LEVELS[level].icon} ${SAFETY_LEVELS[level].user}`.
fn safety_label(level: &str) -> String {
    labels::SAFETY_LEVELS
        .iter()
        .find(|(value, ..)| *value == level)
        .map_or_else(String::new, |(_, icon, user)| format!("{icon} {user}"))
}

/// `VALID_TRANSITIONS` of components/admin/constants.tsx.
fn transitions(status: &str) -> &'static [&'static str] {
    match status {
        "pending" => &["fact_checking", "rejected"],
        "fact_checking" => &["rights_checking", "rejected", "pending"],
        "rights_checking" => &["approved", "limited", "rejected", "fact_checking"],
        "limited" => &["approved", "rejected", "fact_checking", "rights_checking"],
        "approved" => &["limited", "fact_checking", "rights_checking"],
        _ => &[],
    }
}

/// `TRANSITION_ACTION_LABELS`, with `houseOriginalTransitionLabel` first for a house original.
fn transition_label(to: &str, house: bool) -> &'static str {
    let house_label = match to {
        "approved" => Some("수동 게시"),
        "rights_checking" => Some("권리 확인으로"),
        "fact_checking" => Some("사실 확인으로"),
        _ => None,
    };
    if let (true, Some(label)) = (house, house_label) {
        return label;
    }
    match to {
        "pending" => "대기로 되돌리기",
        "fact_checking" => "사실 확인 시작",
        "rights_checking" => "저작권 확인으로",
        "approved" => "게시 승인",
        "limited" => "제한 공개로 전환",
        _ => "반려",
    }
}

fn house_path(status: &str) -> Markup {
    html! {
        ol aria-label="자체 제작 검수 경로" class="grid gap-2 sm:grid-cols-4" {
            @for (i, (label, state, state_label)) in operator_path(status).into_iter().enumerate() {
                @let class = match state {
                    "done" => "bg-safety-green-bg text-safety-green",
                    "current" => "bg-safety-yellow-bg text-safety-yellow",
                    "blocked" => "bg-safety-red-bg text-safety-red",
                    _ => "bg-surface-2 text-muted",
                };
                li aria-current=[(state == "current").then_some("step")] class=(format!("rounded-lg px-3 py-2 text-sm {class}")) {
                    span class="mr-1 tabular-nums" { (i + 1) "." }
                    (label)
                    span class="ml-1 text-xs" { "(" (state_label) ")" }
                }
            }
        }
    }
}

/// `MemeStatusControls`.
fn status_controls(meme: &Meme, house: bool, evidence: bool, rights_url: Option<&str>) -> Markup {
    let targets = transitions(&meme.status);
    let attestation = house
        && targets
            .iter()
            .any(|to| matches!(*to, "approved" | "limited"));
    let blocked = house && !evidence && meme.status == "rights_checking";
    html! {
        section class="space-y-3 rounded-xl border border-border bg-surface p-5" data-admin-controls="meme-status"
            data-admin-meme=(meme.id) data-admin-house=(house) data-admin-blocked=(blocked) {
            h2 class="text-lg font-semibold" { "검수 상태 전이" }
            @if house { (house_path(&meme.status)) }
            @if targets.is_empty() {
                p class="rounded-xl border border-border bg-surface-2 p-4 text-base text-muted" { (moderation(&meme.status).0) " 상태에서는 더 이상 전이할 수 없어요." }
            } @else {
                @if house { p class="text-sm leading-relaxed text-muted" { (PATH_NOTE) } }
                @if let (true, Some(url)) = (house, rights_url) {
                    p class="text-sm" { "권리 출처: " a href=(url) class="break-all text-accent-text underline" { (url) } }
                }
                @if attestation && !evidence {
                    p id="house-original-rights-evidence" role="status" class="rounded-lg border border-safety-yellow bg-safety-yellow-bg p-3 text-base text-safety-yellow" {
                        span aria-hidden="true" class="mr-1" { "▲" }
                        "자체 제작 권리 근거(원본·제작 허가 출처)가 없어 게시할 수 없어요. 확인란만으로는 게시되지 않습니다."
                    }
                }
                @if attestation {
                    label class="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-3 text-base" {
                        input type="checkbox" required aria-required="true" aria-describedby=[blocked.then_some("house-original-rights-evidence")] class="mt-1 size-4" data-admin-attest;
                        span { "이 항목은 밈캐치가 만들고 권리를 보유한 자체 제작이며, 제3자 초상·음원·로고를 포함하지 않음을 확인합니다." }
                    }
                }
                div class="flex flex-wrap gap-2" {
                    @for to in targets {
                        @if *to == "limited" {
                            button type="button" disabled[blocked] class="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 text-base font-semibold text-safety-yellow disabled:opacity-50" data-admin-to=(to) {
                                (if meme.status == "approved" { "노출 중단 (제한 공개)" } else { "제한 공개로 전환" })
                            }
                        } @else {
                            @let look = match *to {
                                "rejected" => "border border-safety-red bg-safety-red-bg text-safety-red",
                                "approved" => "bg-accent-strong text-white",
                                _ => "border border-border bg-surface-2",
                            };
                            button type="button" disabled[blocked && *to == "approved"] class=(format!("min-h-11 rounded-lg px-4 text-base font-semibold disabled:opacity-50 {look}")) data-admin-to=(to) {
                                (transition_label(to, house))
                            }
                        }
                    }
                }
                template data-admin-confirm="approved" {
                    div class="rounded-lg border border-accent-strong bg-surface-2 p-4" {
                        p class="text-base text-foreground" { "이 항목을 공개하면 사용자 검색·탐색·상세 페이지에 노출될 수 있어요. 사실과 권리 검수가 끝났는지 확인한 뒤 수동 게시해 주세요." }
                        div class="mt-3 flex gap-2" {
                            button type="button" class="min-h-11 rounded-lg bg-accent-strong px-4 text-base font-semibold text-white disabled:opacity-50" data-admin-run="approved" { "확인하고 게시" }
                            button type="button" class="min-h-11 rounded-lg border border-border bg-surface px-4 text-base" data-admin-cancel { "취소" }
                        }
                    }
                }
                template data-admin-confirm="limited" {
                    div class="rounded-lg border border-safety-yellow bg-safety-yellow-bg p-4" {
                        p class="text-base text-foreground" { span aria-hidden="true" class="mr-1 text-safety-yellow" { "▲" } (LIMITED_WARNING) }
                        div class="mt-3 flex gap-2" {
                            button type="button" class="min-h-11 rounded-lg bg-safety-yellow px-4 text-base font-semibold text-background disabled:opacity-50" data-admin-run="limited" { "제한 공개로 전환" }
                            button type="button" class="min-h-11 rounded-lg border border-border bg-surface px-4 text-base" data-admin-cancel { "취소" }
                        }
                    }
                }
            }
        }
    }
}

/// `CatalogProvenancePanel`.
fn provenance(meme: &Meme, data: &Data) -> Markup {
    let year = |value: Option<f64>| {
        value.map_or_else(|| "미상".to_owned(), crate::routes::js_json::number)
    };
    let item = |label: &str, value: String| html! { div { dt class="text-muted" { (label) } dd class="font-medium" { (value) } } };
    html! {
        section class="space-y-4 rounded-2xl border border-border bg-surface p-5" {
            div class="flex flex-wrap items-center justify-between gap-3" {
                div {
                    h2 class="text-lg font-bold" { "외부 밈 등록 근거" }
                    p class="mt-1 text-sm text-muted" { "등록 당시의 날짜·태그·출처·권리 검수 상태입니다." }
                }
                a href="/admin/sources" class="text-sm font-semibold text-accent-text underline" { "출처 검수 대기열" }
            }
            dl class="grid gap-3 text-sm sm:grid-cols-4" {
                (item("원작 연도", year(meme.years[0])))
                (item("최초 밈 확인", year(meme.years[1])))
                (item("한국 유행", year(meme.years[2])))
                (item("연도 정확도", meme.precision.clone().unwrap_or_default()))
            }
            div {
                p class="text-sm text-muted" { "태그" }
                div class="mt-2 flex flex-wrap gap-2" {
                    @if data.tags.is_empty() {
                        span class="text-sm text-muted" { "등록된 태그 없음" }
                    } @else {
                        @for tag in &data.tags { span class="rounded-full bg-background px-3 py-1 text-sm" { "#" (tag) } }
                    }
                }
            }
            div class="space-y-3" {
                @for (_, role, basis, state, note, media) in &data.provenance {
                    article class="rounded-xl border border-border p-4 text-sm" {
                        div class="flex flex-wrap gap-x-3 gap-y-1" {
                            span class="font-semibold" { (role) }
                            span class="text-muted" { "권리: " (basis) }
                            span class="text-muted" { "검수: " (state) }
                        }
                        @if let Some((url, title)) = media {
                            a href=(url) target="_blank" rel="noopener noreferrer" class="mt-2 block break-all text-accent-text underline" {
                                (title.as_deref().filter(|title| !title.is_empty()).unwrap_or(url))
                            }
                        }
                        @if let Some(note) = note.as_deref().filter(|note| !note.is_empty()) {
                            p class="mt-2 whitespace-pre-wrap text-muted" { (note) }
                        }
                    }
                }
                @if data.provenance.is_empty() { p class="text-sm text-muted" { "출처 ledger가 없습니다." } }
            }
        }
    }
}

/// `countryFlag(code)`: the two regional indicator letters.
fn flag(code: &str) -> String {
    code.chars()
        .filter_map(|c| char::from_u32(u32::from(c) + 127_397))
        .collect()
}

/// `MemeOriginCountryForm`.
fn origin_country(meme: &Meme, profiles: &[(String, String, String)]) -> Markup {
    let current = profiles
        .iter()
        .find(|(.., state)| state == "reviewed")
        .or_else(|| profiles.first());
    let selected = current
        .and_then(|(code, ..)| COUNTRIES.iter().find(|country| country.code == code))
        .map_or("KR", |country| country.code);
    let local = current.map_or(meme.title.as_str(), |(_, title, _)| title.as_str());
    html! {
        section class="space-y-4 rounded-xl border border-border bg-surface p-5" data-admin-controls="meme-country" data-admin-meme=(meme.id) {
            div {
                h2 class="text-lg font-semibold" { "출처 국가" }
                p class="mt-1 text-sm text-muted" { "검수 완료된 출처 국가가 공개 카드의 원형 국기로 표시돼요." }
            }
            @if !profiles.is_empty() {
                ul class="space-y-1 text-sm text-muted" aria-label="현재 출처 국가 프로필" {
                    @for (code, title, state) in profiles {
                        @let country = COUNTRIES.iter().find(|country| country.code == code);
                        li { (country.map_or_else(|| "🌐".to_owned(), |c| flag(c.code))) " " (country.map_or(code.as_str(), |c| c.label)) (format!(" · {title} · {state}")) }
                    }
                }
            }
            form class="grid gap-4 sm:grid-cols-2" {
                label class="space-y-1 text-sm font-medium" {
                    "국가"
                    select class="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base" data-admin-field="country" {
                        @for country in COUNTRIES { option value=(country.code) selected[country.code == selected] { (flag(country.code)) " " (country.label) } }
                    }
                }
                label class="space-y-1 text-sm font-medium" {
                    "현지 제목"
                    input required maxlength="300" class="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base" value=(local) data-admin-field="localTitle";
                }
                div class="sm:col-span-2" {
                    button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-4 text-base font-semibold text-white disabled:opacity-50" { "출처 국가 검수 저장" }
                }
            }
        }
    }
}

/// `AdminMemeContents`.
fn contents(meme: &Meme, contents: &[Content], house: bool) -> Markup {
    html! {
        section class="space-y-3" data-admin-controls="meme-contents" {
            div class="flex flex-wrap items-center gap-2" {
                h2 class="text-lg font-bold" { "연결된 SNS 콘텐츠" }
                span class="text-sm text-muted" { (contents.len()) "개" }
            }
            @if contents.is_empty() {
                div class="rounded-xl border border-border bg-surface-2 p-5" {
                    p class="text-base text-muted" {
                        (if house { "자체 제작은 SNS 후보 랭킹으로 들어오지 않습니다. 필요하면 운영자가 직접 임베드를 연결하세요. 자동 게시하지 않습니다." } else { "연결된 SNS 임베드가 아직 없어요. 검토 파이프라인에서 후보를 승격하면 여기에 표시돼요." })
                    }
                }
            } @else {
                ul class="grid grid-cols-1 gap-6 md:grid-cols-2" {
                    @for content in contents {
                        li class="space-y-2 rounded-2xl border border-border bg-surface p-4" {
                            div class="flex flex-wrap items-center gap-1.5 text-sm" {
                                span class="rounded-full border border-border px-2 py-0.5 font-semibold" { (content.platform.as_deref().unwrap_or("unknown")) }
                                @if content.is_representative {
                                    span class="rounded-full border border-accent px-2 py-0.5 font-semibold text-accent" { "대표" }
                                }
                                span class="rounded-full border border-border px-2 py-0.5 text-muted" { (content.availability.as_deref().unwrap_or_default()) }
                                span class="rounded-full border border-border px-2 py-0.5 text-muted" { (content.moderation.as_deref().unwrap_or_default()) }
                            }
                            (meme_embed(content, &meme.title))
                            @if let Some(url) = content.url.as_deref().filter(|url| !url.is_empty()) {
                                a href=(url) target="_blank" rel="noopener noreferrer" class="block truncate text-sm text-muted underline-offset-4 hover:text-foreground hover:underline" { (url) }
                            }
                        }
                    }
                }
            }
        }
    }
}
