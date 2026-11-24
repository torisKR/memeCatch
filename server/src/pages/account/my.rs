//! `GET /my` (`app/(default)/my/`): the account page. Next renders it on
//! request; `proxy.ts` sends a visitor without a session to
//! `/login?next=%2Fmy` first (307), as this does.
//!
//! Reads, as the user (row-level security decides what is theirs):
//! `get_my_profile`, the saved library (`saved_memes` joined to visible
//! memes, filtered and paged as lib/saved-library.ts does, with its count,
//! and the unfiltered total when a filter is on) and the submissions. Any
//! failed read shows the page's notice. A page past the last goes to the
//! last (Next streams that `redirect()` as a 200 with a meta refresh; here
//! a 307 to the same address, PLAN.md B6-9).
//!
//! The nickname form posts to `POST /api/account/nickname`
//! (`routes/account.rs`, `updateNickname`), and the sign-out button to
//! better-auth's sign-out: `ui/my.js`. The card collection, the recently
//! viewed memes and the daily quiz are rendered in the state Next renders
//! them before its scripts run (checking, loading); their scripts fill them.
//! The body stays Korean when the language switch changes the frame (B2-14).

use axum::extract::{Request, State};
use axum::response::{IntoResponse, Response};
use maud::{Markup, html};
use serde_json::Value;
use unicode_normalization::UnicodeNormalization;

use super::copy::{self, text};
use super::{proxy_redirect_307, redirect_307, respond};
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::pages::DYNAMIC_PAGE_CACHE;
use crate::pages::document::Head;
use crate::pages::labels::SafetyLevel;
use crate::routes::better_auth::{PageUser, page_user};
use crate::routes::public::js;
use crate::routes::unicode_classes::{LETTER_OR_NUMBER, contains};

/// `SAVED_LIBRARY_PAGE_SIZE`.
const PAGE_SIZE: i64 = 50;
/// `MAX_SEARCH_LENGTH`, in UTF-16 units.
const MAX_SEARCH_LENGTH: usize = 80;
const SUBMISSIONS_LIMIT: i64 = 50;
/// `CONTACT_EMAIL` of lib/site.ts.
const CONTACT_EMAIL: &str = "toris@toris.kr";
const CATEGORIES: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];

const LINK: &str = "inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md";
const BIG_BUTTON: &str = "mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
const PAGE_LINK: &str = "inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const PAGE_OFF: &str = "inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-muted opacity-50";
const FILTER_FIELD: &str = "mt-1 h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

/// `parseSavedLibraryFilters` and the two flags of the page.
#[derive(Debug, PartialEq, Eq)]
pub struct Query {
    pub saved_query: String,
    pub safety: Option<&'static str>,
    pub page: i64,
    pub nickname_error: Option<String>,
    pub nickname_saved: bool,
}

/// `normalizeSavedLibraryQuery`: NFKC, everything but letters, numbers,
/// white space, `_` and `-` as a space, spaces collapsed, trimmed, at most
/// 80 UTF-16 units.
pub fn normalize_query(raw: &str) -> String {
    let kept: String = raw
        .nfkc()
        .map(|c| {
            if contains(&LETTER_OR_NUMBER, c) || js::is_space(c) || c == '_' || c == '-' {
                c
            } else {
                ' '
            }
        })
        .collect();
    let collapsed = js::collapse_spaces(&kept);
    let mut out = String::new();
    let mut units = 0;
    for c in js::trim(&collapsed).chars() {
        units += c.len_utf16();
        if units > MAX_SEARCH_LENGTH {
            break;
        }
        out.push(c);
    }
    out
}

/// `parseSavedLibraryPage`: digits only, a safe integer above zero, else 1.
fn page_number(raw: Option<&str>) -> i64 {
    raw.filter(|text| !text.is_empty() && text.bytes().all(|b| b.is_ascii_digit()))
        .and_then(|text| text.parse::<i64>().ok())
        .filter(|page| *page > 0 && *page < (1_i64 << 53))
        .unwrap_or(1)
}

/// `searchParams` as the page reads it: a name given twice is an array.
pub fn query(raw: Option<&str>) -> Query {
    let pairs: Vec<(String, String)> = url::form_urlencoded::parse(raw.unwrap_or("").as_bytes())
        .into_owned()
        .collect();
    let single = |name: &str| {
        let mut values = pairs.iter().filter(|(key, _)| key == name);
        match (values.next(), values.next()) {
            (Some((_, value)), None) => Some(value.as_str()),
            _ => None,
        }
    };
    Query {
        saved_query: normalize_query(single("saved_q").unwrap_or_default()),
        safety: single("saved_safety").and_then(|value| {
            ["green", "yellow", "gray", "red"]
                .into_iter()
                .find(|level| *level == value)
        }),
        page: page_number(single("saved_page")),
        nickname_error: single("nickname_error").map(str::to_owned),
        nickname_saved: single("nickname_saved") == Some("1"),
    }
}

/// `savedLibraryHref`: the library's filters and page, at `#saved`.
pub fn library_href(saved_query: &str, safety: Option<&str>, page: i64) -> String {
    let mut search = url::form_urlencoded::Serializer::new(String::new());
    let saved_query = normalize_query(saved_query);
    if !saved_query.is_empty() {
        search.append_pair("saved_q", &saved_query);
    }
    if let Some(safety) = safety {
        search.append_pair("saved_safety", safety);
    }
    if page > 1 {
        search.append_pair("saved_page", &page.to_string());
    }
    let serialized = search.finish();
    if serialized.is_empty() {
        "/my#saved".to_owned()
    } else {
        format!("/my?{serialized}#saved")
    }
}

struct Saved {
    short_id: String,
    slug: String,
    title: String,
    summary: Option<String>,
    safety: String,
}

struct Submission {
    name: String,
    status: String,
    reject_reason: Option<String>,
    /// Milliseconds since the epoch, as `new Date(created_at)` holds it.
    created_at: i64,
    dup: Option<(String, String, String)>,
}

#[derive(Default)]
struct Profile {
    nickname: Option<String>,
    interests: Vec<String>,
    age_group: Option<String>,
}

struct Data {
    /// `getMemeCardCollectionPage(db, user.id, { page: 1 })` as JSON;
    /// `None` is `initialError`.
    cards: Option<String>,
    profile: Profile,
    saved: Vec<Saved>,
    /// `savedRes.count`: the matching saved memes.
    result_total: Option<i64>,
    /// `totalSavedRes.count` when a filter is on.
    total: Option<i64>,
    submissions: Vec<Submission>,
    load_error: bool,
}

const SAVED_SQL: &str = r#"select m.short_id, m.slug, m.title, m.summary, m.safety_level::text
  from public.saved_memes s join public.memes m on m.id = s.meme_id
 where ($1::text is null or m.title ilike $1 or m.summary ilike $1)
   and ($2::text is null or m.safety_level::text = $2)
 order by s.created_at desc
 offset $3 limit $4"#;
const SAVED_COUNT_SQL: &str = r#"select count(*) from public.saved_memes s join public.memes m on m.id = s.meme_id
 where ($1::text is null or m.title ilike $1 or m.summary ilike $1)
   and ($2::text is null or m.safety_level::text = $2)"#;
const SUBMISSIONS_SQL: &str = r#"select s.name, s.status::text, s.reject_reason,
       floor(extract(epoch from s.created_at) * 1000)::bigint, d.title, d.short_id, d.slug
  from public.meme_submissions s left join public.memes d on d.id = s.dup_of
 order by s.created_at desc limit $1"#;

async fn read(state: &AppState, user: &PageUser, query: &Query) -> Data {
    let identity = DbIdentity::authenticated(user.id.as_str());
    let pattern = (!query.saved_query.is_empty()).then(|| format!("%{}%", query.saved_query));
    let safety = query.safety.map(str::to_owned);
    let filtered = pattern.is_some() || safety.is_some();
    let offset = (query.page - 1).saturating_mul(PAGE_SIZE);
    let db = &state.db;
    let options = IdentityOptions::default;

    let profile = db.with_identity(&identity, options(), |tx| {
        Box::pin(async move {
            sqlx::query_as::<_, (Option<String>, Option<Vec<String>>, Option<String>)>(
                "select nickname, interests, age_group from public.get_my_profile()",
            )
            .fetch_one(tx)
            .await
        })
    });
    let (p, s) = (pattern.clone(), safety.clone());
    let saved = db.with_identity(&identity, options(), move |tx| {
        Box::pin(async move {
            sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>)>(SAVED_SQL)
                .bind(p)
                .bind(s)
                .bind(offset)
                .bind(PAGE_SIZE)
                .fetch_all(tx)
                .await
        })
    });
    let (p, s) = (pattern.clone(), safety.clone());
    let count = db.with_identity(&identity, options(), move |tx| {
        Box::pin(async move {
            sqlx::query_scalar::<_, i64>(SAVED_COUNT_SQL)
                .bind(p)
                .bind(s)
                .fetch_one(tx)
                .await
        })
    });
    let total = async {
        if !filtered {
            return Ok(None);
        }
        db.with_identity(&identity, options(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, i64>("select count(*) from public.saved_memes")
                    .fetch_one(tx)
                    .await
            })
        })
        .await
        .map(Some)
    };
    let submissions = db.with_identity(&identity, options(), |tx| {
        Box::pin(async move {
            sqlx::query_as::<
                _,
                (
                    String,
                    String,
                    Option<String>,
                    i64,
                    Option<String>,
                    Option<String>,
                    Option<String>,
                ),
            >(SUBMISSIONS_SQL)
            .bind(SUBMISSIONS_LIMIT)
            .fetch_all(tx)
            .await
        })
    });
    let session_user = crate::auth::SessionUser {
        id: user.id.clone(),
        email: user.email.clone(),
    };
    let cards = crate::routes::cards::first_collection_page(db, &session_user);
    let (profile, saved, count, total, submissions, cards) =
        tokio::join!(profile, saved, count, total, submissions, cards);
    let mut load_error = false;
    let mut failed = |what: &str, error: &sqlx::Error| {
        tracing::warn!(%error, what, "/my read failed");
        load_error = true;
    };
    let profile = match profile {
        Ok((nickname, interests, age_group)) => Profile {
            nickname,
            interests: interests.unwrap_or_default(),
            age_group,
        },
        Err(error) => {
            failed("profile", &error);
            Profile::default()
        }
    };
    let (saved, result_total) = match (saved, count) {
        (Ok(rows), Ok(count)) => (rows, Some(count)),
        (saved, count) => {
            for error in [saved.err(), count.err()].into_iter().flatten() {
                failed("saved", &error);
            }
            (Vec::new(), None)
        }
    };
    let total = total.unwrap_or_else(|error| {
        failed("saved total", &error);
        None
    });
    let submissions = submissions.unwrap_or_else(|error| {
        failed("submissions", &error);
        Vec::new()
    });
    Data {
        cards,
        profile,
        saved: saved
            .into_iter()
            .map(|(short_id, slug, title, summary, safety)| Saved {
                short_id,
                slug,
                title,
                summary,
                safety: safety.unwrap_or_else(|| "gray".to_owned()),
            })
            .collect(),
        result_total,
        total,
        submissions: submissions
            .into_iter()
            .map(
                |(name, status, reject_reason, created_at, title, short_id, slug)| Submission {
                    name,
                    status,
                    reject_reason,
                    created_at,
                    dup: title
                        .zip(short_id)
                        .zip(slug)
                        .map(|((title, short_id), slug)| (title, short_id, slug)),
                },
            )
            .collect(),
        load_error,
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let Some(user) = page_user(&state, request.headers()).await else {
        // proxy.ts: `url.searchParams.set("next", "/my")`.
        return proxy_redirect_307("/login?next=%2Fmy");
    };
    let query = query(request.uri().query());
    let data = read(&state, &user, &query).await;
    let result_total = data.result_total.unwrap_or(data.saved.len() as i64);
    let page_count = ((result_total + PAGE_SIZE - 1) / PAGE_SIZE).max(1);
    if data.result_total.is_some() && query.page > page_count {
        return redirect_307(&library_href(&query.saved_query, query.safety, page_count));
    }
    let head = Head {
        title: "MY".to_owned(),
        description: Some("저장한 밈과 내 제보를 한눈에 볼 수 있어요.".to_owned()),
        site_card: true,
        script: Some("my"),
        ..Head::default()
    };
    let view = View {
        owner: &user.id,
        ko: copy::my("ko"),
        query: &query,
        data: &data,
        result_total,
        total: data.total.unwrap_or(result_total),
        page_count,
    };
    let markup = html! {
        (view.main())
        (card_templates())
    };
    respond(&state, &request, DYNAMIC_PAGE_CACHE, head, markup).into_response()
}

struct View<'a> {
    owner: &'a str,
    ko: &'static Value,
    query: &'a Query,
    data: &'a Data,
    result_total: i64,
    total: i64,
    page_count: i64,
}

/// `memePathFrom(shortId, slug)`.
fn meme_path(short_id: &str, slug: &str) -> String {
    if slug.is_empty() {
        format!("/memes/{short_id}")
    } else {
        format!("/memes/{short_id}-{slug}")
    }
}

/// `Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" })`:
/// `2026. 11. 19.`
fn medium_date(ms: i64) -> String {
    let at = time::OffsetDateTime::from_unix_timestamp_nanos(i128::from(ms) * 1_000_000)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    let seoul = at.to_offset(time::UtcOffset::from_hms(9, 0, 0).unwrap_or(time::UtcOffset::UTC));
    format!(
        "{}. {}. {}.",
        seoul.year(),
        u8::from(seoul.month()),
        seoul.day()
    )
}

impl View<'_> {
    fn t(&self, path: &str) -> &'static str {
        text(self.ko, path)
    }

    fn main(&self) -> Markup {
        let profile = &self.data.profile;
        let nickname = profile.nickname.clone().unwrap_or_default();
        let avatar = js::trim(&nickname).chars().next().map_or_else(
            || self.t("avatarFallback").to_uppercase(),
            |c| c.to_uppercase().collect(),
        );
        let age_label = profile
            .age_group
            .as_deref()
            .map(|age| text(&self.ko["ageGroups"], age))
            .filter(|label| !label.is_empty());
        let greeting = match age_label {
            Some(age) => self.t("greeting.withAge").replace("{age}", age),
            None => self.t("greeting.plain").to_owned(),
        };
        html! {
            main class="mx-auto w-full max-w-site px-4 py-8" {
                div class="flex items-center justify-between gap-4" {
                    div class="flex min-w-0 items-center gap-3" {
                        span aria-hidden="true" class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl font-bold text-accent" { (avatar) }
                        div class="min-w-0" {
                            h1 class="truncate text-2xl font-bold" { @if nickname.is_empty() { (self.t("defaultNickname")) } @else { (nickname) } }
                            p class="mt-0.5 text-sm text-muted" { (greeting) }
                        }
                    }
                    form class="shrink-0" data-my-sign-out {
                        button type="submit" class="flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" { (self.t("logout")) }
                    }
                }
                @if self.data.load_error {
                    p role="alert" class="mt-4 rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red" { (self.t("loadError")) }
                }
                div class="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8" {
                    aside class="flex flex-col gap-6 lg:sticky lg:top-20 lg:w-80 lg:shrink-0" {
                        (self.nickname_section(&nickname))
                        (self.interests_section())
                        section class="rounded-2xl border border-border bg-surface p-5" {
                            h2 class="text-lg font-bold" { (self.t("accountDelete.title")) }
                            p class="mt-2 text-sm leading-relaxed text-muted" { (self.t("accountDelete.body")) }
                            div class="mt-3 flex flex-col gap-2" {
                                a class=(LINK) href="/support" { (self.t("accountDelete.request")) }
                                a href=(format!("mailto:{CONTACT_EMAIL}")) class=(LINK) { (self.t("accountDelete.mail")) }
                            }
                        }
                    }
                    div class="min-w-0 flex-1 [&>*:first-child]:mt-0" {
                        div class="mt-8" { (daily_quiz_loading()) }
                        nav aria-label=(self.t("saved.title")) class="mt-6 flex flex-wrap gap-3 border-b border-border pb-3" {
                            a class="inline-flex min-h-11 items-center rounded-xl bg-accent-soft px-4 text-sm font-bold text-accent-text" href="#meme-cards" { "밈카드" }
                            a class="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold" href="#saved" { (self.t("saved.title")) }
                        }
                        (self.collection_checking())
                        (self.saved_section())
                        (recent_loading(self.t("recent.title")))
                        (self.submissions_section())
                    }
                }
            }
        }
    }

    fn nickname_section(&self, nickname: &str) -> Markup {
        // `nicknameErrorMessage`: the two messages the action sends are
        // shown in the reader's language; any other text is "save failed".
        let error = self.query.nickname_error.as_deref().map(|sent| match sent {
            "닉네임은 2~20자로 지어 주세요" => self.t("nickname.errors.invalidLength"),
            "이미 사용 중인 닉네임이에요" => self.t("nickname.errors.taken"),
            _ => self.t("nickname.errors.saveFailed"),
        });
        html! {
            section class="rounded-2xl border border-border bg-surface p-5" {
                h2 class="text-lg font-bold" { (self.t("nickname.title")) }
                form class="mt-3 flex gap-2" data-my-nickname {
                    label for="nickname" class="sr-only" { (self.t("nickname.label")) }
                    input id="nickname" type="text" minlength="2" maxlength="20" required aria-invalid=(error.is_some()) aria-describedby=[error.map(|_| "nickname-error")] class="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" name="nickname" value=(nickname);
                    button type="submit" class="h-12 shrink-0 rounded-xl bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2" { (self.t("nickname.save")) }
                }
                @if let Some(error) = error {
                    p id="nickname-error" role="alert" class="mt-2 text-sm text-safety-red" { (error) }
                } @else if self.query.nickname_saved {
                    p role="status" class="mt-2 text-sm text-safety-green" { (self.t("nickname.saved")) }
                }
            }
        }
    }

    fn interests_section(&self) -> Markup {
        let my = &copy::my_tables();
        let mut keys: Vec<&str> = Vec::new();
        for interest in &self.data.profile.interests {
            if !CATEGORIES.contains(&interest.as_str()) {
                continue;
            }
            let key = text(&my["displayByLegacy"], interest);
            if !keys.contains(&key) {
                keys.push(key);
            }
        }
        html! {
            section class="rounded-2xl border border-border bg-surface p-5" {
                div class="flex items-center justify-between gap-3" {
                    h2 class="text-lg font-bold" { (self.t("interests.title")) }
                    a href="/onboarding?next=/my" class=(LINK) {
                        @if keys.is_empty() { (self.t("interests.set")) } @else { (self.t("interests.edit")) }
                    }
                }
                @if keys.is_empty() {
                    p class="mt-2 text-sm text-muted" { (self.t("interests.empty")) }
                } @else {
                    ul class="mt-3 flex flex-wrap gap-2" {
                        @for key in &keys {
                            li class="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium" {
                                (text(&self.ko["categories"], text(&my["displayFirst"], key)))
                            }
                        }
                    }
                }
            }
        }
    }

    /// `MemeCollectibleCollection` before its scripts run: checking the owner.
    fn collection_checking(&self) -> Markup {
        html! {
            section id="meme-cards" class="meme-collectible-collection" aria-labelledby="my-meme-card-title" aria-busy="false" data-my-cards=(self.owner) data-my-cards-page=[self.data.cards.as_deref()] {
                div class="meme-collectible-section-heading" {
                    div {
                        h2 id="my-meme-card-title" { "내 밈카드" }
                        p { "나만 보는 무료 컬렉션 · 최근 보유 순" }
                    }
                    div {}
                }
                form class="meme-collectible-filters" {
                    label {
                        "카드 이름 검색"
                        input maxlength="80" placeholder="찾고 싶은 밈 이름" name="query";
                    }
                    label {
                        "카테고리"
                        select name="category" {
                            option value="" { "전체" }
                            @for category in CATEGORIES {
                                option value=(category) { (text(&self.ko["categories"], category)) }
                            }
                        }
                    }
                    button type="submit" class="meme-collectible-primary-button" disabled { "찾기" }
                }
                p role="status" class="meme-collectible-notice" { "로그인 확인 중…" }
                a class="meme-collectible-text-button" href="/meme-cards" { "카드 둘러보기 ↗" }
            }
        }
    }

    fn saved_section(&self) -> Markup {
        let filtered = !self.query.saved_query.is_empty() || self.query.safety.is_some();
        let href = |page| library_href(&self.query.saved_query, self.query.safety, page);
        // "필터 지우기": the library without filters. Next's link keeps them
        // (`savedLibraryPageHref()` passes the active query and safety), so
        // it clears nothing (PLAN.md B6-12).
        let cleared = library_href("", None, 1);
        let page = self.query.page;
        html! {
            section id="saved" class="mt-8 scroll-mt-24" {
                div class="flex flex-wrap items-baseline justify-between gap-3" {
                    div class="flex items-baseline gap-2" {
                        h2 class="text-lg font-bold" { (self.t("saved.title")) }
                    }
                    span class="text-sm text-muted" { (self.total) }
                }
                @if self.total > 0 {
                    form role="search" class="mt-3 rounded-2xl border border-border bg-surface p-3 sm:flex sm:items-end sm:gap-3" action="/my#saved" method="get" {
                        div class="min-w-0 flex-1" {
                            label for="saved-library-query" class="block text-xs font-bold text-muted" { (self.t("saved.library.searchLabel")) }
                            input id="saved-library-query" type="search" maxlength="80" placeholder=(self.t("saved.library.searchPlaceholder")) aria-describedby="saved-library-results" class=(FILTER_FIELD) name="saved_q" value=(self.query.saved_query);
                        }
                        div class="mt-3 min-w-40 sm:mt-0" {
                            label for="saved-library-safety" class="block text-xs font-bold text-muted" { (self.t("saved.library.safetyLabel")) }
                            select id="saved-library-safety" name="saved_safety" class=(FILTER_FIELD) {
                                option value="" selected[self.query.safety.is_none()] { (self.t("saved.library.allSafety")) }
                                @for level in ["green", "yellow", "gray", "red"] {
                                    option value=(level) selected[self.query.safety == Some(level)] { (text(&self.ko["safety"], level)) }
                                }
                            }
                        }
                        div class="mt-3 flex shrink-0 items-center gap-3 sm:mt-0" {
                            button type="submit" class="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2" { (self.t("saved.library.apply")) }
                            @if filtered {
                                a href=(cleared) class="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline underline-offset-4" { (self.t("saved.library.clear")) }
                            }
                        }
                        p id="saved-library-results" role="status" class="mt-3 text-xs text-muted sm:order-last sm:mt-0 sm:w-full" {
                            (self.t("saved.library.results").replace("{matches}", &self.result_total.to_string()).replace("{total}", &self.total.to_string()))
                        }
                    }
                }
                @if self.data.saved.is_empty() {
                    div class="mt-3 rounded-2xl border border-border bg-surface p-6 text-center" {
                        @if filtered {
                            p class="text-muted" { (self.t("saved.library.emptyFilteredTitle")) }
                            p class="mt-1 text-muted" { (self.t("saved.library.emptyFilteredBody")) }
                            a href=(cleared) class=(BIG_BUTTON) { (self.t("saved.library.clear")) }
                        } @else {
                            p class="text-muted" { (self.t("saved.emptyTitle")) }
                            p class="mt-1 text-muted" { (self.t("saved.emptyBody")) }
                            a href="/explore" class=(BIG_BUTTON) { (self.t("saved.explore")) }
                        }
                    }
                } @else {
                    ul class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" {
                        @for meme in &self.data.saved {
                            @let level = SafetyLevel::parse(&meme.safety);
                            li class="flex h-full flex-col rounded-2xl border border-border bg-surface transition-colors hover:border-accent" {
                                a class="flex flex-1 flex-col p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" href=(meme_path(&meme.short_id, &meme.slug)) {
                                    div class="flex items-start justify-between gap-2" {
                                        h3 class="min-w-0 flex-1 truncate text-base font-bold" { (meme.title) }
                                        span class=(format!("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold {}", safety_chip(level))) {
                                            span aria-hidden="true" { (safety_icon(level)) }
                                            (text(&self.ko["safety"], level.token()))
                                        }
                                    }
                                    @if let Some(summary) = meme.summary.as_deref().filter(|summary| !summary.is_empty()) {
                                        p class="mt-1 line-clamp-2 text-sm text-muted" { (summary) }
                                    }
                                }
                            }
                        }
                    }
                }
                @if self.page_count > 1 {
                    nav aria-label=(self.t("saved.library.pagination.label")) class="mt-5 flex items-center justify-between gap-3" {
                        @if page > 1 {
                            a href=(href(page - 1)) class=(PAGE_LINK) { (self.t("saved.library.pagination.previous")) }
                        } @else {
                            span aria-disabled="true" class=(PAGE_OFF) { (self.t("saved.library.pagination.previous")) }
                        }
                        span aria-current="page" class="text-sm font-medium text-muted" {
                            (self.t("saved.library.pagination.status").replace("{page}", &page.to_string()).replace("{total}", &self.page_count.to_string()))
                        }
                        @if page < self.page_count {
                            a href=(href(page + 1)) class=(PAGE_LINK) { (self.t("saved.library.pagination.next")) }
                        } @else {
                            span aria-disabled="true" class=(PAGE_OFF) { (self.t("saved.library.pagination.next")) }
                        }
                    }
                }
            }
        }
    }

    fn submissions_section(&self) -> Markup {
        html! {
            section class="mt-8" {
                h2 class="text-lg font-bold" { (self.t("submissions.title")) }
                @if self.data.submissions.is_empty() {
                    div class="mt-3 rounded-2xl border border-border bg-surface p-6 text-center" {
                        p class="text-muted" { (self.t("submissions.emptyTitle")) }
                        p class="mt-1 text-muted" { (self.t("submissions.emptyBody")) }
                        a href="/submit" class=(BIG_BUTTON) { (self.t("submissions.first")) }
                    }
                } @else {
                    ul class="mt-3 flex flex-col gap-3" {
                        @for submission in &self.data.submissions {
                            li class="rounded-2xl border border-border bg-surface p-4" {
                                div class="flex items-center justify-between gap-3" {
                                    h3 class="min-w-0 truncate text-base font-bold" { (submission.name) }
                                    span class=(format!("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold {}", status_chip(&submission.status))) {
                                        (text(&self.ko["submissions"]["status"], &format!("{}.badge", submission.status)))
                                    }
                                }
                                p class="mt-1 text-sm text-muted" { (self.t("submissions.submittedAt").replace("{date}", &medium_date(submission.created_at))) }
                                @if submission.status == "pending" {
                                    p class="mt-2 text-muted" { (self.t("submissions.pendingDetail")) }
                                }
                                @if let (true, Some(reason)) = (submission.status == "rejected", submission.reject_reason.as_deref().filter(|reason| !reason.is_empty())) {
                                    p class="mt-2 rounded-xl bg-safety-red-bg px-3 py-2 text-safety-red" { (self.t("submissions.rejectionReason")) ": " (reason) }
                                }
                                @if let Some((title, short_id, slug)) = &submission.dup {
                                    p class="mt-2 text-muted" {
                                        (self.t("submissions.duplicate")) " → "
                                        a href=(meme_path(short_id, slug)) class="inline-flex min-h-11 items-center text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md" { (title) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn safety_chip(level: SafetyLevel) -> &'static str {
    match level.token() {
        "green" => "bg-safety-green-bg text-safety-green",
        "yellow" => "bg-safety-yellow-bg text-safety-yellow",
        "red" => "bg-safety-red-bg text-safety-red",
        _ => "bg-safety-gray-bg text-safety-gray",
    }
}

/// `SAFETY_LEVELS[level].icon`.
fn safety_icon(level: SafetyLevel) -> &'static str {
    match level.token() {
        "green" => "●",
        "yellow" => "▲",
        "red" => "✕",
        _ => "◌",
    }
}

fn status_chip(status: &str) -> &'static str {
    match status {
        "reviewing" => "bg-safety-yellow-bg text-safety-yellow",
        "approved" => "bg-safety-green-bg text-safety-green",
        "rejected" => "bg-safety-red-bg text-safety-red",
        _ => "bg-safety-gray-bg text-safety-gray",
    }
}

/// The most `MyRecent` asks for.
const RECENT_MAX: usize = 6;

/// `GET /_axum/my/recent?ids=<id>,<id>`: `MyRecent` once its memes are read,
/// for `ui/my.js`, which has the ids from this browser's `mc_recent_memes`.
/// Next's component reads the same memes with the planner from the browser
/// (`memes` by id, approved or limited, the first six ids) and renders their
/// cards; here the server renders the section. No content (204) when none
/// of them is shown: the component then hides the section.
pub async fn recent(State(state): State<AppState>, request: Request) -> Response {
    let ids: Vec<String> =
        url::form_urlencoded::parse(request.uri().query().unwrap_or("").as_bytes())
            .find(|(key, _)| key == "ids")
            .map(|(_, value)| value.split(',').map(str::to_owned).collect())
            .unwrap_or_default();
    let ids: Vec<String> = ids
        .into_iter()
        .take(RECENT_MAX)
        .filter(|id| uuid_like(id))
        .collect();
    if ids.is_empty() {
        return axum::http::StatusCode::NO_CONTENT.into_response();
    }
    let sql = format!(
        "select {} from public.memes m where m.id::text = any($1) and m.moderation_status in ('approved', 'limited')",
        crate::pages::meme_card::CARD_COLUMNS
    );
    let wanted = ids.clone();
    let rows = state
        .db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(sqlx::AssertSqlSafe(sql))
                    .bind(wanted)
                    .fetch_all(tx)
                    .await
            })
        })
        .await;
    let Ok(rows) = rows else {
        // A failed read hides the section, as the component's `catch` does.
        return axum::http::StatusCode::NO_CONTENT.into_response();
    };
    let cards: Vec<_> = rows
        .iter()
        .filter_map(|row| crate::pages::meme_card::CardMeme::from_row(row).ok())
        .collect();
    let ordered: Vec<_> = ids
        .iter()
        .filter_map(|id| cards.iter().find(|card| &card.id == id))
        .collect();
    if ordered.is_empty() {
        return axum::http::StatusCode::NO_CONTENT.into_response();
    }
    let recent = &copy::my("ko")["recent"];
    let markup = html! {
        section class="mt-8" data-my-recent {
            div class="flex items-baseline justify-between gap-3" {
                h2 class="text-lg font-bold" { (text(recent, "title")) }
                button type="button" class="inline-flex min-h-11 items-center text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline hover:decoration-flame-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-md" data-my-recent-clear { (text(recent, "clearAll")) }
            }
            div data-track="my_recent_click" {
                (crate::pages::meme_card::grid("mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3", ordered.into_iter().map(|card| crate::pages::meme_card::card(card, None))))
            }
        }
    };
    (
        [
            (axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (axum::http::header::CACHE_CONTROL, DYNAMIC_PAGE_CACHE),
        ],
        markup.into_string(),
    )
        .into_response()
}

/// A UUID as text: what `.in("id", ids)` can match.
fn uuid_like(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        })
}

/// What `ui/my.js` builds the collection's cards from: a face without art
/// and one with art at `/__art__` (the script puts the card's path there).
/// Each has a summary and a year, which the script fills or removes.
fn card_templates() -> Markup {
    use crate::pages::meme_card::{Face, owned_face, poster_face};
    let face = Face {
        title: "",
        summary: "-",
        safety: None,
        year: Some(0),
    };
    html! {
        template data-my-card-face { (poster_face(&face)) }
        template data-my-card-art { (owned_face(&face, "/__art__")) }
    }
}

/// `DailyMemeQuiz variant="compact"` before its question arrives.
fn daily_quiz_loading() -> Markup {
    html! {
        section aria-labelledby="daily-meme-quiz-title" data-home-section="daily-quiz" data-daily-quiz="compact" {
            div class="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6" {
                div class="flex flex-wrap items-center justify-between gap-3" {
                    h2 id="daily-meme-quiz-title" class="flex items-center gap-2 text-lg font-bold sm:text-xl" {
                        span aria-hidden="true" class="inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-sm font-extrabold text-flame-800" { "오늘" }
                        "오늘의 밈 퀴즈"
                    }
                }
                p role="status" class="mt-4 text-sm text-muted" { "오늘의 문제를 가져오고 있어요…" }
            }
        }
    }
}

/// `MyRecent` while it reads the recently viewed memes.
fn recent_loading(title: &str) -> Markup {
    html! {
        section class="mt-8" aria-busy="true" data-my-recent {
            h2 class="text-lg font-bold" { (title) }
            div class="mt-3" {
                div class="grid grid-cols-2 gap-4 sm:grid-cols-3" {
                    @for _ in 0..4 {
                        div class="min-w-0" {
                            div aria-hidden="true" class="shimmer instrument-grid rounded-lg aspect-[4/3] w-full rounded-[16px]" {}
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

    // Expected values: normalizeSavedLibraryQuery and savedLibraryHref under Node.
    #[test]
    fn the_library_query_is_read_as_lib_saved_library_reads_it() {
        assert_eq!(normalize_query("  ＡＢ  c%d*'밈_-  "), "AB c d 밈_-");
        assert_eq!(normalize_query("a,b"), "a b");
        assert_eq!(normalize_query(&"가".repeat(90)).chars().count(), 80);
        assert_eq!(page_number(Some("2")), 2);
        assert_eq!(page_number(Some("0")), 1);
        assert_eq!(page_number(Some("-1")), 1);
        assert_eq!(page_number(Some("1e3")), 1);
        assert_eq!(page_number(Some("9007199254740992")), 1);
        let q = query(Some(
            "saved_q=a&saved_safety=red&saved_page=3&nickname_saved=1",
        ));
        assert_eq!(
            (q.saved_query.as_str(), q.safety, q.page, q.nickname_saved),
            ("a", Some("red"), 3, true)
        );
        assert_eq!(query(Some("saved_safety=blue")).safety, None);
        assert_eq!(
            library_href("밈 a", Some("red"), 2),
            "/my?saved_q=%EB%B0%88+a&saved_safety=red&saved_page=2#saved"
        );
        assert_eq!(library_href("", None, 1), "/my#saved");
    }
}
