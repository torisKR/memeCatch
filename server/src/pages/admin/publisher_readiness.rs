//! `GET /admin/publisher-readiness`
//! (`app/(default)/admin/publisher-readiness/page.tsx`): one page of a
//! hundred public memes, each with the four editorial gaps of
//! `lib/publisher-readiness.ts` (no public source, no or repeated summary,
//! no usable publication date, too little prose).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use sqlx::Row as _;
use unicode_normalization::UnicodeNormalization;

use super::format;
use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::pages::content_depth::{self, ContentDepth, ContentRow, DepthInput, SourceRow};
use crate::routes::public::{js, js_date, labels};

const TITLE: &str = "퍼블리셔 준비도";
const PATH: &str = "/admin/publisher-readiness";
const PAGE_SIZE: i64 = 100;
const MAX_PAGE: i64 = 10_000;
/// `CONTENT_DEPTH_THRESHOLDS` of lib/content-depth.ts.
const MIN_PROSE_CHARS: usize = 250;
const MIN_SCORE: u32 = 5;
const DATE_ACTION: &str = "밈캐치의 최초 공개 시점을 운영 기록에서 확인하고 정정 근거를 남겨 주세요. 원본 영상이나 기사 발행일과는 구분해야 합니다. 별도 운영 데이터 정정이 필요한 published_at 필드로, 현재 밈 편집 화면에서는 수정할 수 없습니다.";

/// `PUBLISHER_READINESS_FOCUSES` and `FOCUS_LABELS`.
const FOCUSES: [(&str, &str); 4] = [
    ("source", "공개 출처 없음"),
    ("summary", "요약 없음/제목 반복"),
    ("date", "게시일 확인 필요"),
    ("depth", "고유 설명 부족"),
];

struct Issue {
    code: &'static str,
    label: &'static str,
    explanation: String,
    action: &'static str,
}

struct Item {
    id: String,
    short_id: String,
    slug: String,
    title: String,
    moderation_status: String,
    published_at: Option<String>,
    sources: Vec<String>,
    prose_chars: usize,
    score: u32,
    issues: Vec<Issue>,
}

/// `parsePublisherReadinessPage`.
fn parse_page(value: Option<&str>) -> i64 {
    match value {
        Some(text) if !text.is_empty() && text.bytes().all(|b| b.is_ascii_digit()) => {
            // `Number(text)` of a long run of digits is not a safe integer.
            text.parse::<i64>()
                .ok()
                .filter(|page| *page >= 1 && *page < (1 << 53))
                .map_or(1, |page| page.min(MAX_PAGE))
        }
        _ => 1,
    }
}

fn parse_focus(value: Option<&str>) -> Option<&'static str> {
    FOCUSES
        .iter()
        .map(|(code, _)| *code)
        .find(|code| Some(*code) == value)
}

/// `normalizedText`: NFKC, trimmed, runs of space collapsed, lower case.
fn normalized(value: &str) -> String {
    let nfkc: String = value.nfkc().collect();
    js::collapse_spaces(js::trim(&nfkc)).to_lowercase()
}

/// `safeSourceUrls`: the public sources' normalized URLs, one per document.
fn safe_sources(sources: &[SourceRow]) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut safe = Vec::new();
    for source in sources
        .iter()
        .filter(|source| content_depth::is_public_display_source(source))
    {
        let Some(url) = content_depth::public_source_url(source.source_url.as_deref()) else {
            continue;
        };
        if seen.insert(content_depth::source_document_key(&url).to_owned()) {
            safe.push(url);
        }
    }
    safe
}

fn source_score(count: usize) -> u32 {
    match count {
        0 => 0,
        1 => 1,
        _ => 2,
    }
}

/// `classifyPublisherReadiness`.
fn classify(row: Meme, now_ms: i64) -> Item {
    let validated = safe_sources(&row.sources);
    let as_sources: Vec<SourceRow> = validated
        .iter()
        .map(|url| SourceRow {
            source_url: Some(url.clone()),
            ..SourceRow::default()
        })
        .collect();
    let depth: ContentDepth = content_depth::content_depth(&DepthInput {
        description: &row.description,
        origin: &row.origin,
        usage_note: row.usage_note.as_deref(),
        caution: row.caution.as_deref(),
        usage_examples: &row.usage_examples,
        sources: &as_sources,
        contents: &row.contents,
        tag_count: row.tag_count,
    });
    let score = depth.score - source_score(depth.source_count) + source_score(validated.len());
    let substantial = depth.prose_chars >= MIN_PROSE_CHARS && score >= MIN_SCORE;
    let mut issues = Vec::new();
    if validated.is_empty() {
        issues.push(Issue {
            code: "source",
            label: "공개 출처 없음",
            explanation: "검증 가능한 공개 HTTP(S) 출처가 없습니다. 비공개·내부·인증 포함 주소는 세지 않습니다.".to_owned(),
            action: "밈 편집 또는 출처 검수에서 실제 공개 출처와 맥락을 확인하세요.",
        });
    }
    let summary = normalized(&row.summary);
    if summary.is_empty() {
        issues.push(Issue {
            code: "summary",
            label: "요약 없음",
            explanation: "요약이 비어 있어 독자가 제목만으로 의미와 맥락을 판단해야 합니다."
                .to_owned(),
            action: "밈 편집에서 뜻과 사용 맥락을 담은 고유 요약을 작성하세요.",
        });
    } else if normalized(&row.title) == summary {
        issues.push(Issue {
            code: "summary",
            label: "제목 반복 요약",
            explanation: "요약이 제목과 같아 독자에게 추가 설명을 제공하지 않습니다.".to_owned(),
            action: "밈 편집에서 뜻과 사용 맥락을 담은 고유 요약으로 보완하세요.",
        });
    }
    let published = row
        .published_at
        .as_deref()
        .filter(|value| !js::trim(value).is_empty());
    match published {
        None => issues.push(Issue {
            code: "date",
            label: "게시일 없음",
            explanation: "게시일이 비어 있어 실제 공개 시점을 확인할 수 없습니다.".to_owned(),
            action: DATE_ACTION,
        }),
        Some(value) if js_date::evidence_ms(js::trim(value), now_ms).is_none() => issues
            .push(Issue {
            code: "date",
            label: "게시일 확인 필요",
            explanation:
                "게시일이 유효하지 않거나 미래 시각이어서 실제 공개 시점으로 사용할 수 없습니다."
                    .to_owned(),
            action: DATE_ACTION,
        }),
        Some(_) => {}
    }
    if !substantial {
        issues.push(Issue {
            code: "depth",
            label: "고유 설명 부족",
            explanation: format!(
                "현재 고유 산문 {}자, 콘텐츠 깊이 {score}점입니다. 내부 운영 기준은 산문 {MIN_PROSE_CHARS}자 이상과 {MIN_SCORE}점 이상을 모두 요구합니다.",
                depth.prose_chars
            ),
            action: "밈 편집에서 출처를 베끼지 말고 의미·유래·사용법·주의·예문을 근거에 맞게 보완하세요.",
        });
    }
    Item {
        id: row.id,
        short_id: row.short_id,
        slug: row.slug,
        title: row.title,
        moderation_status: row.moderation_status,
        published_at: row.published_at,
        sources: validated,
        prose_chars: depth.prose_chars,
        score,
        issues,
    }
}

/// One row of `PUBLISHER_READINESS_SELECT`.
struct Meme {
    id: String,
    short_id: String,
    slug: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    usage_examples: serde_json::Value,
    moderation_status: String,
    published_at: Option<String>,
    sources: Vec<SourceRow>,
    contents: Vec<ContentRow>,
    tag_count: usize,
}

const SELECT: &str = "select m.id::text as id, m.short_id, m.slug, m.title, m.summary, m.description, m.origin, m.usage_note, m.caution, \
    m.usage_examples::text as usage_examples, m.moderation_status::text as moderation_status, to_json(m.published_at) #>> '{}' as published_at, \
    (select coalesce(json_agg(json_build_object('source_url', s.source_url, 'hidden_from_public', s.hidden_from_public)), '[]'::json)::text \
       from public.meme_sources s where s.meme_id = m.id) as sources, \
    (select coalesce(json_agg(json_build_object('availability', c.availability, 'moderation_status', c.moderation_status)), '[]'::json)::text \
       from public.meme_contents c where c.meme_id = m.id) as contents, \
    (select count(*) from public.meme_tags_map t where t.meme_id = m.id) as tag_count \
    from public.memes m where m.moderation_status in ('approved', 'limited') order by m.id asc offset $1 limit $2";

fn decode(row: &sqlx::postgres::PgRow) -> Result<Meme, sqlx::Error> {
    fn json<T: serde::de::DeserializeOwned>(text: String) -> Result<T, sqlx::Error> {
        serde_json::from_str(&text).map_err(|error| sqlx::Error::Decode(Box::new(error)))
    }
    let text = |name: &str| -> Result<String, sqlx::Error> {
        Ok(row.try_get::<Option<String>, _>(name)?.unwrap_or_default())
    };
    let usage_examples: Option<String> = row.try_get("usage_examples")?;
    Ok(Meme {
        id: text("id")?,
        short_id: text("short_id")?,
        slug: text("slug")?,
        title: text("title")?,
        summary: text("summary")?,
        description: text("description")?,
        origin: text("origin")?,
        usage_note: row.try_get("usage_note")?,
        caution: row.try_get("caution")?,
        usage_examples: usage_examples
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(serde_json::Value::Null),
        moderation_status: text("moderation_status")?,
        published_at: row.try_get("published_at")?,
        sources: json(row.try_get("sources")?)?,
        contents: json(row.try_get("contents")?)?,
        tag_count: usize::try_from(row.try_get::<i64, _>("tag_count")?).unwrap_or_default(),
    })
}

/// `listPublisherReadinessPage` as the operator: the page's rows and the
/// public total.
async fn load(
    state: &AppState,
    user: &SessionUser,
    page: i64,
) -> Result<(Vec<Meme>, i64), sqlx::Error> {
    let from = (page - 1) * PAGE_SIZE;
    state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let rows = sqlx::query(SELECT).bind(from).bind(PAGE_SIZE).fetch_all(&mut *tx).await?;
                let total: i64 = sqlx::query_scalar(
                    "select count(*) from public.memes where moderation_status in ('approved', 'limited')",
                )
                .fetch_one(&mut *tx)
                .await?;
                let rows = rows.iter().map(decode).collect::<Result<Vec<_>, _>>()?;
                Ok((rows, total))
            })
        })
        .await
}

fn single<'a>(pairs: &'a [(String, String)], key: &str) -> Option<&'a str> {
    let mut values = pairs.iter().filter(|(name, _)| name == key);
    match (values.next(), values.next()) {
        (Some((_, value)), None) => Some(value),
        _ => None,
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let query = request.uri().query();
    let pairs: Vec<(String, String)> =
        url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
    let page = parse_page(single(&pairs, "page"));
    let focus = parse_focus(single(&pairs, "focus"));
    let user = match super::require_operator(&state, request.headers(), request.uri().path(), query)
        .await
    {
        Ok(user) => user,
        Err(redirect) => return redirect,
    };
    let main = match load(&state, &user, page).await {
        Ok((rows, total)) => {
            let now = crate::auth::now_ms();
            let inspected: Vec<Item> = rows.into_iter().map(|row| classify(row, now)).collect();
            view(page, focus, total, inspected)
        }
        Err(error) => {
            tracing::warn!(%error, "publisher readiness failed");
            shell::error_boundary()
        }
    };
    super::screen(&state, Root::Site, TITLE, PATH, main)
}

fn page_href(page: i64, focus: Option<&str>) -> String {
    let mut params = url::form_urlencoded::Serializer::new(String::new());
    params.append_pair("page", &page.to_string());
    if let Some(focus) = focus {
        params.append_pair("focus", focus);
    }
    format!("{PATH}?{}", params.finish())
}

fn metric(label: &str, value: &str) -> Markup {
    html! {
        div class="rounded-xl border border-border bg-surface p-4" {
            div class="text-sm text-muted" { (label) }
            div class="mt-1 text-2xl font-bold tabular-nums" { (value) }
        }
    }
}

fn count(value: usize) -> String {
    format::count(i64::try_from(value).unwrap_or(i64::MAX))
}

fn view(page: i64, focus: Option<&str>, total: i64, inspected: Vec<Item>) -> Markup {
    let inspected_count = inspected.len();
    let items: Vec<&Item> = inspected
        .iter()
        .filter(|item| {
            focus.is_none_or(|focus| item.issues.iter().any(|issue| issue.code == focus))
        })
        .collect();
    let total_pages = ((total + PAGE_SIZE - 1) / PAGE_SIZE).max(1);
    let focus_label = focus.and_then(|focus| {
        FOCUSES
            .iter()
            .find(|(code, _)| *code == focus)
            .map(|(_, label)| *label)
    });
    html! {
        div class="space-y-8" {
            header class="space-y-2" {
                h1 class="text-2xl font-bold" { (TITLE) }
                p class="max-w-3xl text-sm leading-relaxed text-muted" { "공개 중인 approved/limited 문서를 100개씩 읽어 출처, 요약, 게시일, 고유 설명의 편집 보완점을 찾습니다. 이 진단은 내부 운영 기준이며 외부 심사 결과를 예측하거나 보장하지 않습니다." }
            }
            section aria-labelledby="readiness-summary" class="space-y-3" {
                h2 id="readiness-summary" class="text-lg font-bold" { "검사 범위" }
                div class="grid gap-3 sm:grid-cols-3" {
                    (metric("전체 공개 문서", &format::count(total)))
                    (metric("이번 페이지 검사", &count(inspected_count)))
                    (metric("현재 표시", &format!("{}건", count(items.len()))))
                }
                p class="text-xs leading-relaxed text-muted" { "전체 수는 공개 코퍼스 전체입니다. 보완점 수와 집중 필터는 이번 페이지에서 검사한 최대 100개 안에서만 계산하며 전체 코퍼스 통계로 해석하면 안 됩니다." }
            }
            section aria-labelledby="readiness-focus" class="space-y-3" {
                h2 id="readiness-focus" class="text-lg font-bold" { "현재 페이지 집중 보기" }
                form method="GET" class="flex flex-wrap items-end gap-3" {
                    label class="block" {
                        span class="mb-1 block text-sm font-medium" { "보완점" }
                        select name="focus" class="min-h-11 rounded-lg border border-border bg-surface px-3 text-base" {
                            option value="" selected[focus.is_none()] { "전체 문서" }
                            @for (code, label) in FOCUSES {
                                option value=(code) selected[focus == Some(code)] { (label) }
                            }
                        }
                    }
                    input type="hidden" name="page" value=(page);
                    button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white" { "적용" }
                }
                @if let Some(label) = focus_label {
                    p class="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm" {
                        strong { (label) } " 항목을 현재 페이지 안에서만 추렸습니다:  " (count(items.len())) "건"
                    }
                }
            }
            section aria-labelledby="readiness-results" class="space-y-4" {
                h2 id="readiness-results" class="text-lg font-bold" { "문서별 보완점" }
                @if inspected_count == 0 {
                    p class="rounded-xl border border-border bg-surface p-8 text-center text-muted" { "이 페이지에서 검사할 공개 문서가 없습니다. 전체 수와 페이지 번호를 확인하세요." }
                } @else if items.is_empty() {
                    p class="rounded-xl border border-border bg-surface p-8 text-center text-muted" { "이번 페이지에는 선택한 보완점이 없습니다. 이는 전체 코퍼스의 완료 판정이 아닙니다." }
                } @else {
                    ul class="space-y-4" { @for item in &items { (card(item)) } }
                }
            }
            nav aria-label="퍼블리셔 준비도 페이지 이동" class="flex items-center gap-4 text-sm" {
                @if page > 1 {
                    a href=(page_href(page - 1, focus)) class="text-accent-text underline" { "← 이전" }
                }
                span class="text-muted" { (format::count(page)) " / " (format::count(total_pages)) }
                @if page < total_pages {
                    a href=(page_href(page + 1, focus)) class="text-accent-text underline" { "다음 →" }
                }
            }
            section aria-labelledby="manual-account-checks" class="rounded-xl border border-border bg-surface p-5" {
                h2 id="manual-account-checks" class="text-lg font-bold" { "계정 검토 수동 확인" }
                p class="mt-1 text-sm text-muted" { "이 화면은 Google 또는 광고 계정과 통신하지 않으며 실시간 계정 상태를 표시하지 않습니다." }
                ol class="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed" {
                    li { "AdSense 사이트 화면에서 검토 상태와 최근 안내를 직접 확인합니다." }
                    li { "공개 ads.txt의 게시자 ID와 계정에 표시된 ID가 같은지 직접 확인합니다." }
                    li { "장기간 대기 중이면 공식 도움말 또는 문의 채널에서 필요한 후속 조치를 확인합니다." }
                }
            }
        }
    }
}

/// `formatPublicationDate`.
fn publication_date(value: Option<&str>) -> String {
    value
        .map(js::trim)
        .and_then(|text| js_date::evidence_ms(text, crate::auth::now_ms()).map(|_| text))
        .and_then(format::parse_timestamp_or_date)
        .map_or_else(|| "확인 필요".to_owned(), format::kst_date)
}

fn card(item: &Item) -> Markup {
    html! {
        li class="rounded-xl border border-border bg-surface p-5" {
            div class="flex flex-wrap items-start justify-between gap-3" {
                div {
                    h3 class="text-lg font-bold" { (item.title) }
                    p class="mt-1 text-xs text-muted" {
                        (item.moderation_status) " · 게시일 " (publication_date(item.published_at.as_deref())) " · 고유 산문  " (count(item.prose_chars)) "자 · 깊이 " (item.score) "점"
                    }
                }
                div class="flex flex-wrap gap-3 text-sm" {
                    a href=(format!("/admin/memes/{}", js::encode_uri_component(&item.id))) class="text-accent-text underline" { "편집" }
                    a href=(labels::meme_path(&item.short_id, &item.slug)) class="text-accent-text underline" { "공개 페이지" }
                    a href="/admin/sources" class="text-accent-text underline" { "출처 검수" }
                }
            }
            @if !item.sources.is_empty() {
                div class="mt-4" {
                    h4 class="text-sm font-semibold" { "공개 HTTP(S) 형식 출처" }
                    ul class="mt-1 space-y-1 text-sm" {
                        @for url in &item.sources {
                            li class="truncate" { a href=(url) target="_blank" rel="noreferrer" class="text-accent-text underline" { (url) } }
                        }
                    }
                }
            }
            @if item.issues.is_empty() {
                p class="mt-4 text-sm text-muted" { "이 페이지에서 검사하는 네 가지 내부 보완점은 발견되지 않았습니다. 외부 심사나 사실 검증의 완료를 뜻하지 않습니다." }
            } @else {
                ul class="mt-4 space-y-3" {
                    @for issue in &item.issues {
                        li class="rounded-lg bg-surface-2 p-3 text-sm leading-relaxed" {
                            strong { (issue.label) }
                            p class="mt-1 text-muted" { (issue.explanation) }
                            p class="mt-1" { "다음 작업: " (issue.action) }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_and_focus_parse_as_the_typescript_does() {
        assert_eq!(parse_page(None), 1);
        assert_eq!(parse_page(Some("0")), 1);
        assert_eq!(parse_page(Some("3")), 3);
        assert_eq!(parse_page(Some("-3")), 1);
        assert_eq!(parse_page(Some("99999")), MAX_PAGE);
        assert_eq!(parse_page(Some("99999999999999999999")), 1);
        assert_eq!(parse_focus(Some("depth")), Some("depth"));
        assert_eq!(parse_focus(Some("x")), None);
        assert_eq!(normalized("  Ｍｅｍｅ \t 뜻 "), "meme 뜻");
    }
}
