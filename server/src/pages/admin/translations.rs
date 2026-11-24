//! `GET /admin/translations` (`app/(default)/admin/translations/page.tsx`):
//! the supply tower and coverage of the four content locales, the missing
//! translations of one locale with their GPT preview, and the review queue
//! (`TranslationReviewQueue`), ten a page. The actions are
//! `routes/admin/translations.rs`; the client parts `ui/admin-translations.js`.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use serde_json::json;
use sqlx::Row;
use sqlx::postgres::PgRow;

use super::format;
use super::shell::{self, Root};
use super::translation_coverage;
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::pages::content_depth;
use crate::routes::admin::translations::{LOCALES, is_locale, same_instant};

const PAGE_SIZE: i64 = 10;
const MISSING_LIMIT: usize = 20;
/// `OFFSET $n::int`: a later page fails as Next's does.
const MAX_OFFSET: f64 = 2_147_483_647.0;
const STATUSES: [(&str, &str); 3] = [
    ("machine", "검수 전"),
    ("reviewed", "검수 완료"),
    ("stale", "원문 변경"),
];

/// `LANGUAGE_NAMES` of the content locales.
pub fn language(locale: &str) -> &'static str {
    match locale {
        "en" => "English",
        "ja" => "日本語",
        "zh" => "中文(简体)",
        "zh-tw" => "中文(繁體)",
        _ => "",
    }
}

struct QueueRow {
    meme_id: String,
    locale: String,
    status: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    aliases: Vec<String>,
    source_updated_at: String,
    updated_at: String,
    reviewed_at: Option<String>,
    meme_title: String,
    meme_summary: String,
    meme_description: String,
    meme_origin: String,
    meme_usage_note: Option<String>,
    meme_caution: Option<String>,
    meme_short_id: String,
    meme_updated_at: String,
}

struct Missing {
    meme_id: String,
    short_id: String,
    title: String,
    updated_at: String,
    route_unlock: bool,
}

pub(super) async fn rows(
    state: &AppState,
    user: &SessionUser,
    sql: String,
    binds: Vec<Option<String>>,
) -> Result<Vec<PgRow>, sqlx::Error> {
    state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let mut query = sqlx::query(sqlx::AssertSqlSafe(sql));
                for bind in binds {
                    query = query.bind(bind);
                }
                query.fetch_all(tx).await
            })
        })
        .await
}

const FILTER: &str = "($1::text is null or t.locale = $1) and ($2::text is null or t.status = $2)";

/// `listTranslationsForReview`: one page, newest first, and the count.
async fn queue(
    state: &AppState,
    user: &SessionUser,
    locale: Option<&str>,
    status: Option<&str>,
    offset: i64,
) -> Result<(Vec<QueueRow>, i64), sqlx::Error> {
    let filters = vec![locale.map(str::to_owned), status.map(str::to_owned)];
    let count: i64 = rows(
        state,
        user,
        format!("select count(*)::bigint from public.meme_translations t where {FILTER}"),
        filters.clone(),
    )
    .await?
    .first()
    .map(|row| row.try_get(0))
    .transpose()?
    .unwrap_or_default();
    let ts = |column: &str| format!("to_json({column}) #>> '{{}}'");
    let sql = format!(
        "select t.meme_id::text, t.locale, t.status, t.title, t.summary, t.description, t.origin, t.usage_note, t.caution, t.aliases, \
         {}, {}, {}, m.title, m.summary, m.description, m.origin, m.usage_note, m.caution, m.short_id, {} \
         from public.meme_translations t join public.memes m on m.id = t.meme_id where {FILTER} \
         order by t.updated_at desc limit {PAGE_SIZE} offset {offset}",
        ts("t.source_updated_at"),
        ts("t.updated_at"),
        ts("t.reviewed_at"),
        ts("m.updated_at"),
    );
    let found = rows(state, user, sql, filters).await?;
    let queue = found
        .iter()
        .map(|row| -> Result<QueueRow, sqlx::Error> {
            Ok(QueueRow {
                meme_id: row.try_get(0)?,
                locale: row.try_get(1)?,
                status: row.try_get(2)?,
                title: row.try_get(3)?,
                summary: row.try_get(4)?,
                description: row.try_get(5)?,
                origin: row.try_get(6)?,
                usage_note: row.try_get(7)?,
                caution: row.try_get(8)?,
                aliases: row.try_get(9)?,
                source_updated_at: row.try_get(10)?,
                updated_at: row.try_get(11)?,
                reviewed_at: row.try_get(12)?,
                meme_title: row.try_get(13)?,
                meme_summary: row.try_get(14)?,
                meme_description: row.try_get(15)?,
                meme_origin: row.try_get(16)?,
                meme_usage_note: row.try_get(17)?,
                meme_caution: row.try_get(18)?,
                meme_short_id: row.try_get(19)?,
                meme_updated_at: row.try_get(20)?,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    Ok((queue, count))
}

pub(super) const PUBLIC: &str = "m.moderation_status in ('approved', 'limited')";

/// `listMissingMemeTranslations({ locale, limit: 20, focusMemeId })`: the
/// public memes without a translation, route-unlock candidates first, then
/// the latest; the focused one leads.
async fn missing(
    state: &AppState,
    user: &SessionUser,
    locale: &str,
    focus: Option<&str>,
) -> Result<Vec<Missing>, String> {
    if focus.is_some_and(|focus| !super::growth::is_uuid(focus)) {
        return Err("집중할 밈 ID가 올바르지 않아요.".to_owned());
    }
    // `meme_sources(source_url)`: no `hidden_from_public`, so a hidden
    // source counts as it does in the TypeScript.
    let sql = format!(
        "select m.id::text, m.short_id, m.title, to_json(m.updated_at) #>> '{{}}', \
         m.description, m.origin, m.usage_note, m.caution, m.usage_examples::text as usage_examples, \
         (select coalesce(json_agg(json_build_object('source_url', s.source_url)), '[]'::json)::text \
            from public.meme_sources s where s.meme_id = m.id) as sources, \
         (select coalesce(json_agg(json_build_object('availability', c.availability, 'moderation_status', c.moderation_status)), '[]'::json)::text \
            from public.meme_contents c where c.meme_id = m.id) as contents, \
         (select count(*) from public.meme_tags_map g where g.meme_id = m.id) as tag_count \
         from public.memes m where {PUBLIC} \
         and not exists (select 1 from public.meme_translations t where t.meme_id = m.id and t.locale = $1)"
    );
    let found = rows(state, user, sql, vec![Some(locale.to_owned())])
        .await
        .map_err(|error| crate::routes::admin::db_message(&error))?;
    let mut list = found
        .iter()
        .map(|row| -> Result<Missing, sqlx::Error> {
            Ok(Missing {
                meme_id: row.try_get(0)?,
                short_id: row.try_get(1)?,
                title: row.try_get(2)?,
                updated_at: row.try_get(3)?,
                route_unlock: content_depth::row_depth(row)?.is_indexable(),
            })
        })
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let millis = |value: &str| {
        format::parse_timestamp_or_date(value).map(|at| at.unix_timestamp_nanos() / 1_000_000)
    };
    // `sortTranslationWorklistRows`.
    list.sort_by(|left, right| {
        right
            .route_unlock
            .cmp(&left.route_unlock)
            .then_with(|| millis(&right.updated_at).cmp(&millis(&left.updated_at)))
            .then_with(|| left.meme_id.cmp(&right.meme_id))
    });
    if let Some(index) = focus.and_then(|focus| list.iter().position(|row| row.meme_id == focus)) {
        let focused = list.remove(index);
        list.truncate(MISSING_LIMIT - 1);
        list.insert(0, focused);
    } else {
        list.truncate(MISSING_LIMIT);
    }
    Ok(list)
}

/// A query parameter as Next's `searchParams` gives it to the page: a
/// repeated one is an array, which the page uses as its `String()`.
fn param(query: &[(String, String)], name: &str) -> Option<String> {
    let values = values(query, name);
    (!values.is_empty()).then(|| values.join(","))
}

fn values<'a>(query: &'a [(String, String)], name: &str) -> Vec<&'a str> {
    query
        .iter()
        .filter(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
        .collect()
}

/// Whether `option` is selected by a `defaultValue` of the parameter's
/// values: a repeated one selects each of its values, as React does for an
/// array.
fn selects(given: &[&str], joined: &str, option: &str) -> bool {
    if given.len() > 1 {
        given.contains(&option)
    } else {
        joined == option
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
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
    let query = crate::routes::request::query_pairs(request.uri());
    let locale = param(&query, "locale").unwrap_or_default();
    let status = param(&query, "status").unwrap_or_else(|| "machine".to_owned());
    let focus = param(&query, "focus").unwrap_or_default();
    let locale_filter = is_locale(&locale).then_some(locale.as_str());
    let status_filter = STATUSES
        .iter()
        .any(|(value, _)| *value == status)
        .then_some(status.as_str());
    // `Math.max(1, Math.trunc(Number(page) || 1))`.
    let number = param(&query, "page")
        .as_deref()
        .map_or(Some(1.0), crate::storage::signing::js_number)
        .filter(|n| *n != 0.0)
        .unwrap_or(1.0);
    let page = number.trunc().max(1.0);
    let offset = (page - 1.0) * PAGE_SIZE as f64;
    let listed = if page.is_finite() && offset <= MAX_OFFSET {
        queue(&state, &user, locale_filter, status_filter, offset as i64).await
    } else {
        Err(sqlx::Error::Protocol("offset out of range".to_owned()))
    };
    let main = match listed {
        Err(error) => {
            tracing::warn!(%error, "translations failed");
            shell::error_boundary()
        }
        Ok((queue, total)) => {
            let coverage = translation_coverage::coverage(&state, &user).await;
            let missing = match locale_filter {
                Some(locale) => {
                    missing(
                        &state,
                        &user,
                        locale,
                        Some(focus.as_str()).filter(|f| !f.is_empty()),
                    )
                    .await
                }
                None => Ok(Vec::new()),
            };
            let view = View {
                locale: &locale,
                locales: &values(&query, "locale"),
                status: &status,
                statuses: &values(&query, "status"),
                locale_filter,
                focus: &focus,
                page: page as i64,
                configured: crate::routes::admin::openai::configured(&state),
            };
            view.render(&queue, total, &coverage, &missing)
        }
    };
    super::screen(&state, Root::Site, "번역 검수", "/admin/translations", main)
}

struct View<'a> {
    locale: &'a str,
    locales: &'a [&'a str],
    status: &'a str,
    statuses: &'a [&'a str],
    locale_filter: Option<&'a str>,
    focus: &'a str,
    page: i64,
    configured: bool,
}

impl View<'_> {
    fn render(
        &self,
        queue: &[QueueRow],
        total: i64,
        coverage: &Result<Vec<translation_coverage::Coverage>, String>,
        missing: &Result<Vec<Missing>, String>,
    ) -> Markup {
        let (rows, error) = match coverage {
            Ok(rows) => (rows.as_slice(), None),
            Err(error) => (&[][..], Some(error.as_str())),
        };
        let total_pages = ((total + PAGE_SIZE - 1) / PAGE_SIZE).max(1);
        html! {
            div class="space-y-6" {
                div {
                    h1 class="text-2xl font-bold" { "번역 검수" }
                    p class="mt-1.5 text-sm leading-relaxed text-muted" { "오프라인 번역 배치가 만든 초안을 밈 전체에서 모아 검수합니다. GPT-5.6 Sol high가 원문과 번역을 대조해 교정본·신뢰도·발행 의견을 만들고, 공개 발행은 운영자가 최종 승인합니다." }
                }
                (translation_coverage::tower(rows, error))
                (translation_coverage::coverage_panel(rows, error))
                (missing_preview(self.locale_filter, missing, self.focus))
                (self.filters())
                @if queue.is_empty() {
                    div class="rounded-xl border border-border bg-surface p-10 text-center" {
                        p class="text-lg font-semibold" { "조건에 맞는 번역이 없어요" }
                        p class="mt-1 text-base text-muted" { "필터를 바꾸거나 잠시 후 다시 확인해 주세요." }
                    }
                } @else {
                    div class="space-y-4" {
                        @for row in queue { (card(row, self.configured)) }
                    }
                    @if total_pages > 1 { (self.pagination(total_pages)) }
                }
            }
        }
    }

    fn filters(&self) -> Markup {
        html! {
            form method="GET" class="flex flex-wrap items-end gap-3" {
                label class="block" {
                    span class="mb-1 block text-base font-medium" { "언어" }
                    select name="locale" class="min-h-11 rounded-lg border border-border bg-surface px-3 text-base" {
                        option value="" selected[selects(self.locales, self.locale, "")] { "전체" }
                        @for locale in LOCALES {
                            option value=(locale) selected[selects(self.locales, self.locale, locale)] { (language(locale)) }
                        }
                    }
                }
                label class="block" {
                    span class="mb-1 block text-base font-medium" { "검수 상태" }
                    select name="status" class="min-h-11 rounded-lg border border-border bg-surface px-3 text-base" {
                        option value="" selected[selects(self.statuses, self.status, "")] { "전체" }
                        @for (value, label) in STATUSES {
                            option value=(value) selected[selects(self.statuses, self.status, value)] { (label) }
                        }
                    }
                }
                button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white" { "적용" }
            }
        }
    }

    /// `pageHref`: the raw `locale` and `status` the page was given.
    fn href(&self, target: i64) -> String {
        let mut params = url::form_urlencoded::Serializer::new(String::new());
        if !self.locale.is_empty() {
            params.append_pair("locale", self.locale);
        }
        if !self.status.is_empty() {
            params.append_pair("status", self.status);
        }
        params.append_pair("page", &target.to_string());
        format!("/admin/translations?{}", params.finish())
    }

    fn pagination(&self, total_pages: i64) -> Markup {
        let class = |off: bool| {
            format!(
                "min-h-11 rounded-lg border border-border px-4 py-2 text-base {}",
                if off {
                    "pointer-events-none opacity-40"
                } else {
                    "hover:bg-surface-2"
                }
            )
        };
        let (first, last) = (self.page <= 1, self.page >= total_pages);
        html! {
            nav aria-label="페이지" class="flex items-center justify-center gap-3 pt-2" {
                a href=(self.href((self.page - 1).max(1))) aria-disabled=(first) class=(class(first)) { "이전" }
                span class="text-sm text-muted tabular-nums" { (self.page) " / " (total_pages) }
                a href=(self.href((self.page + 1).min(total_pages))) aria-disabled=(last) class=(class(last)) { "다음" }
            }
        }
    }
}

/// `MissingTranslationDraftPreview` before a preview: the rows and their
/// buttons. The preview, its form and the messages are the script's.
fn missing_preview(
    locale: Option<&str>,
    missing: &Result<Vec<Missing>, String>,
    focus: &str,
) -> Markup {
    let (rows, error) = match missing {
        Ok(rows) => (rows.as_slice(), None),
        Err(error) => (&[][..], Some(error.as_str())),
    };
    let lane = locale == Some("zh");
    // `activeOperatorMemeId` (`focusMemeId ?? first row`); a row is active
    // only in the zh lane.
    let active = if !lane {
        None
    } else if !focus.is_empty() {
        Some(focus)
    } else {
        rows.first().map(|row| row.meme_id.as_str())
    };
    let data = json!(rows
        .iter()
        .map(|row| json!({ "memeId": row.meme_id, "title": row.title, "updatedAt": row.updated_at }))
        .collect::<Vec<_>>())
    .to_string();
    html! {
        section aria-labelledby="missing-translation-draft-preview-title" class="rounded-2xl border border-border bg-surface p-5"
            data-admin-controls="missing-translation" data-admin-locale=[locale] data-admin-rows=(data) {
            p class="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text" { "GPT TRANSLATION PREVIEW" }
            h2 id="missing-translation-draft-preview-title" class="mt-1 text-xl font-bold" { "누락 번역 초안 미리보기" }
            p class="mt-1 text-sm leading-relaxed text-muted" { "버튼을 누른 원문만 GPT-5.6 Sol high로 번역 초안을 미리 봅니다. 자동 실행·저장·발행은 하지 않습니다." }
            @if let Some(locale) = locale {
                p class="mt-4 text-sm font-semibold" { "선택 로케일: " (language(locale)) " (" (locale) ")" }
                @if lane {
                    div class="mt-4 rounded-xl border border-accent/30 bg-accent-soft/15 p-4" data-translation-operator-lane="zh" {
                        p class="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text" { "ZH ROUTE-UNLOCK OPERATOR LANE" }
                        p class="mt-1 text-sm leading-relaxed text-muted" { "번역 요청을 먼저 처리하고, 그다음 번역으로 글로벌 route를 열 수 있는 원문을 처리합니다. 저장은 machine 초안으로만 남고, GPT 미리보기와 사람 검수는 계속 명시적으로 실행합니다." }
                    }
                }
                @if let Some(error) = error {
                    p role="alert" class="mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red" data-admin-error="" { (error) }
                }
                @if rows.is_empty() {
                    p class="mt-4 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted" data-admin-list="" { "이 로케일에서 미리 볼 누락 번역 원문이 없어요." }
                } @else {
                    ul class="mt-4 space-y-3" data-admin-list="" aria-label=(format!("{} {}", language(locale), if lane { "Route-Unlock 운영 큐" } else { "누락 번역 원문" })) {
                        @for row in rows {
                            (missing_row(row, lane, active == Some(row.meme_id.as_str()), focus == row.meme_id))
                        }
                    }
                }
            } @else {
                p class="mt-4 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted" { "번역 초안을 미리 볼 로케일을 먼저 선택해 주세요." }
            }
        }
    }
}

fn missing_row(row: &Missing, lane: bool, active: bool, focused: bool) -> Markup {
    let class = format!(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 {}",
        if active {
            "border-accent bg-accent-soft/10"
        } else {
            "border-border bg-surface-2"
        }
    );
    html! {
        li class=(class) data-translation-operator-row=[lane.then_some("true")] data-translation-operator-active=(active) data-admin-meme=(row.meme_id) {
            div class="min-w-0" {
                p class="font-semibold" { (row.title) }
                p class="mt-1 font-mono text-xs text-muted" { (row.short_id) }
                @if row.route_unlock {
                    span class="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-accent-soft text-accent-text" data-translation-route-unlock="candidate" { "번역 후 글로벌 공개 후보" }
                } @else {
                    span class="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-surface text-muted" data-translation-route-unlock="blocked" { "원문 보강 필요" }
                }
                @if focused {
                    span class="mt-2 inline-flex rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-text" { "요청 우선" }
                }
                @if active {
                    span class="mt-2 inline-flex rounded-full bg-surface px-2 py-1 text-xs font-semibold text-accent-text" data-admin-active="" { "현재 후보" }
                }
            }
            button type="button" aria-label=(format!("{} GPT-5.6 Sol high 번역 초안 미리보기", row.title)) class="min-h-11 rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60" { "GPT-5.6 Sol high로 미리보기" }
        }
    }
}

/// `formatDate` of the review card.
fn date(value: Option<&str>) -> String {
    match value {
        None => "—".to_owned(),
        Some(value) => format::parse_timestamp_or_date(value)
            .map_or_else(|| value.to_owned(), format::kst_medium_short),
    }
}

const INPUT: &str = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-4 focus:ring-accent/20";
const READONLY: &str =
    "mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-base text-muted";

/// `TranslationQueueCard`.
fn card(row: &QueueRow, configured: bool) -> Markup {
    let fresh = same_instant(&row.source_updated_at, &row.meme_updated_at);
    let (label, badge) = match row.status.as_str() {
        "reviewed" => ("검수 완료·발행", "bg-safety-green-bg text-safety-green"),
        "stale" => (
            "원문 변경·갱신 필요",
            "bg-safety-yellow-bg text-safety-yellow",
        ),
        _ => ("검수 전", "bg-surface-2 text-muted"),
    };
    let prefix = format!("[{}/{}]", row.meme_short_id, row.locale);
    let name = language(&row.locale);
    let body = json!({ "memeId": row.meme_id, "locale": row.locale, "expectedTranslationUpdatedAt": row.updated_at }).to_string();
    let readonly = |label: &str, value: &str, rows: &str| {
        html! {
            label class="mt-2 block text-sm font-medium" { (label) textarea readonly rows=(rows) class=(READONLY) { (format::textarea(value)) } }
        }
    };
    let field = |label: &str, key: &str, value: &str, rows: &str| {
        html! {
            label class="mt-2 block text-sm font-medium" {
                (label)
                textarea aria-label=(format!("{prefix} {label}")) rows=(rows) class=(INPUT) data-admin-field=(key) { (format::textarea(value)) }
            }
        }
    };
    html! {
        article class="space-y-4 rounded-xl border border-border bg-surface p-5" data-admin-controls="translation-review"
            data-admin-key=(format!("translation:{}:{}", row.meme_id, row.locale)) data-admin-body=(body) data-admin-fresh=(fresh) {
            div class="flex flex-wrap items-start justify-between gap-3" {
                div {
                    div class="flex flex-wrap items-center gap-2" {
                        a href=(format!("/admin/memes/{}", row.meme_id)) class="text-lg font-semibold text-accent-text hover:underline" { (row.meme_title) }
                        span class="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted" { (name) " (" (row.locale) ")" }
                        span class=(format!("rounded-full px-2.5 py-1 text-xs font-semibold {badge}")) { (label) }
                        @if !fresh {
                            span class="rounded-full bg-safety-red-bg px-2.5 py-1 text-xs font-semibold text-safety-red" { "stale — 원문 revision 불일치" }
                        }
                    }
                    p class="mt-1.5 text-xs text-muted" { "번역 갱신 " (date(Some(&row.updated_at))) " · 마지막 검수 " (date(row.reviewed_at.as_deref())) }
                }
            }
            div class="grid gap-4 lg:grid-cols-2" {
                div {
                    h4 class="text-sm font-bold text-muted" { "원문 (한국어)" }
                    label class="mt-2 block text-sm font-medium" { "제목" input readonly value=(row.meme_title) class=(READONLY); }
                    (readonly("한 줄 요약", &row.meme_summary, "2"))
                    (readonly("설명", &row.meme_description, "6"))
                    (readonly("유래", &row.meme_origin, "5"))
                    (readonly("사용법", row.meme_usage_note.as_deref().unwrap_or_default(), "4"))
                    (readonly("주의사항", row.meme_caution.as_deref().unwrap_or_default(), "4"))
                }
                div {
                    h4 class="text-sm font-bold text-muted" { "번역 (" (name) ")" }
                    label class="mt-2 block text-sm font-medium" {
                        "제목"
                        input aria-label=(format!("{prefix} 제목")) value=(row.title) class=(INPUT) data-admin-field="title";
                    }
                    (field("한 줄 요약", "summary", &row.summary, "2"))
                    label class="mt-2 block text-sm font-medium" {
                        "별칭 (쉼표로 구분)"
                        input aria-label=(format!("{prefix} 별칭")) value=(row.aliases.join(", ")) class=(INPUT) data-admin-field="aliases";
                    }
                    (field("설명", "description", &row.description, "6"))
                    (field("유래", "origin", &row.origin, "5"))
                    (field("사용법", "usageNote", row.usage_note.as_deref().unwrap_or_default(), "4"))
                    (field("주의사항", "caution", row.caution.as_deref().unwrap_or_default(), "4"))
                }
            }
            @if !fresh {
                p class="rounded-lg bg-safety-yellow-bg px-3 py-2.5 text-sm text-safety-yellow" { "한국어 원문이 번역 이후 변경됐습니다. 새 원문 기준 번역을 생성하기 전에는 승인·발행할 수 없습니다." }
            }
            label class="block text-sm font-medium" {
                "반려 사유 (반려 시 필수 — 감사 로그에 기록돼요)"
                textarea aria-label=(format!("{prefix} 반려 사유")) rows="2" placeholder="예: 고유명사 표기가 부정확해요" class=(INPUT) data-admin-field="reason" {}
            }
            div class="flex flex-wrap gap-2 border-t border-border pt-4" {
                span title=[(!configured).then_some("OPENAI_API_KEY 설정 필요")] {
                    button type="button" disabled[!configured] class="min-h-11 rounded-lg border border-accent bg-accent/10 px-4 text-sm font-semibold text-accent-text disabled:cursor-not-allowed disabled:opacity-40" data-admin-action="gpt" { "GPT-5.6 Sol high 검수" }
                }
                button type="button" disabled[!fresh] class="min-h-11 rounded-lg bg-safety-green px-4 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40" data-admin-action="approve" { "승인·발행" }
                button type="button" class="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 text-sm font-semibold text-safety-yellow disabled:opacity-50" data-admin-action="reject" { "반려" }
                button type="button" class="min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50 border-border bg-surface-2 text-muted" data-admin-action="delete" { "삭제" }
            }
        }
    }
}
