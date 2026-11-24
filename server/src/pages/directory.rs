//! `GET /memes` (`app/(default)/memes/page.tsx`): every Korean meme document
//! the sitemap lists, 가나다순, a hundred to a page at `/memes?page=N`.
//!
//! The list is `loadMemeDirectory` (lib/meme-directory.server.ts): approved
//! and limited memes that pass the index test and are not an alias of
//! another, ordered by `directory_order`. `/about` counts the same list.
//!
//! Only a page that exists is answered here. `?page=1` (Next's 308 to
//! `/memes`), a page out of range or malformed (Next's 404) and a catalog that
//! cannot be read (Next's error page) are handed to Next.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};
use std::time::Duration;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use sqlx::{AssertSqlSafe, Row};

use super::content_depth::{DEPTH_COLUMNS, row_depth};
use super::document::{self, Head, ShareImage, Site};
use super::{Pages, directory_order, json_ld, labels, meme_detail, path_and_query};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::labels::meme_path;
use crate::routes::request::query_pairs;
use crate::{AppState, proxy};

/// `MEME_DIRECTORY_PAGE_SIZE`.
const PAGE_SIZE: usize = 100;
/// The JSON-LD lists the first ten of a page.
const JSON_LD_ITEMS: usize = 10;
// `loadCachedDirectory` keeps the list for an hour and drops it on a catalog
// edit. Nothing tells this process about an edit, so it reads sooner.
pub const DIRECTORY_TTL: Duration = Duration::from_secs(300);

// The columns of `SELECT` in lib/meme-directory.server.ts. Built from
// constants only.
static CANDIDATES: LazyLock<String> = LazyLock::new(|| {
    format!(
        "select m.id::text as id, m.short_id, m.slug, m.title, m.summary, m.category::text as category, \
                m.origin_year, {DEPTH_COLUMNS} \
           from public.memes m \
          where m.moderation_status in ('approved', 'limited')"
    )
});

/// `MemeDirectoryItem`.
#[derive(Clone)]
pub struct Item {
    pub id: String,
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub category: String,
    pub origin_year: Option<i32>,
}

/// The directory, and the ids of `loadDiscoveryIndex`
/// (lib/index-gate.server.ts): every public meme that passes the index
/// test, aliases included. Both come from one read of the same rows.
pub struct Catalog {
    items: Vec<Item>,
    pub indexable_ids: HashSet<String>,
}

impl std::ops::Deref for Catalog {
    type Target = [Item];

    fn deref(&self) -> &[Item] {
        &self.items
    }
}

pub type Directory = Arc<Catalog>;

/// The directory, from the cache or the database. `None` when the catalog
/// cannot be read: an outage is not an empty list.
pub async fn load(pages: &Pages, db: &Db) -> Option<Directory> {
    pages
        .directory
        .get_or_load(|| read(db))
        .await
        .inspect_err(|error| tracing::warn!(%error, "meme directory failed"))
        .ok()
}

async fn read(db: &Db) -> Result<Directory, sqlx::Error> {
    // About 4,000 rows of prose: read once per cache period, kept as titles.
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(AssertSqlSafe(CANDIDATES.as_str()))
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    let mut items = Vec::new();
    let mut indexable_ids = HashSet::new();
    for row in rows {
        let id: String = row.try_get("id")?;
        let short_id: String = row.try_get("short_id")?;
        // `isDirectoryMeme`: in the discovery index and not thin, which is
        // the same test twice.
        if !row_depth(&row)?.is_indexable() {
            continue;
        }
        indexable_ids.insert(id.clone());
        if meme_detail::is_canonical_alias(&short_id) {
            continue;
        }
        let slug: String = row.try_get("slug")?;
        let title: Option<String> = row.try_get("title")?;
        let summary: Option<String> = row.try_get("summary")?;
        items.push(Item {
            title: directory_order::listed_title(title.as_deref(), &slug).to_owned(),
            summary: summary
                .as_deref()
                .map(crate::routes::public::js::trim)
                .unwrap_or_default()
                .to_owned(),
            id,
            short_id,
            slug,
            category: row.try_get("category")?,
            origin_year: row.try_get("origin_year")?,
        });
    }
    items.sort_by(|a, b| directory_order::compare(&a.title, &a.short_id, &b.title, &b.short_id));
    Ok(Arc::new(Catalog {
        items,
        indexable_ids,
    }))
}

/// `parseDirectoryPage`: `None` for anything but one plain positive integer
/// of at most six digits. `Some(None)` when there is no `page` at all.
fn parse_page(pairs: &[(String, String)]) -> Option<Option<usize>> {
    let mut values = pairs.iter().filter(|(key, _)| key == "page");
    let Some((_, raw)) = values.next() else {
        return Some(None);
    };
    if values.next().is_some() {
        return None;
    }
    let bytes = raw.as_bytes();
    let plain =
        (1..=6).contains(&bytes.len()) && bytes[0] != b'0' && bytes.iter().all(u8::is_ascii_digit);
    plain.then(|| raw.parse().ok()).flatten().map(Some)
}

/// `directoryPagePath`.
fn page_path(page: usize) -> String {
    if page <= 1 {
        "/memes".to_owned()
    } else {
        format!("/memes?page={page}")
    }
}

fn page_count(total: usize) -> usize {
    total.div_ceil(PAGE_SIZE).max(1)
}

fn title(page: usize, page_count: usize) -> String {
    if page == 1 {
        "밈 전체 목록 (가나다순) — 뜻·유래 사전".to_owned()
    } else {
        format!("밈 전체 목록 {page}/{page_count}쪽 (가나다순)")
    }
}

fn description(page: usize, total: usize, items: &[Item]) -> String {
    let range = match (items.first(), items.last()) {
        (Some(first), Some(last)) => {
            format!(
                " 이 쪽은 「{}」부터 「{}」까지예요.",
                first.title, last.title
            )
        }
        _ => String::new(),
    };
    let page_note = if page > 1 {
        format!(" ({page}쪽)")
    } else {
        String::new()
    };
    format!(
        "밈캐치가 뜻·유래·사용 맥락을 정리한 밈 문서 {}개를 가나다순으로 모았어요.{range} 각 문서에서 지금 써도 되는지와 출처도 확인할 수 있어요.{page_note}",
        super::about::grouped(total)
    )
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let page_number = match parse_page(&query_pairs(request.uri())) {
        Some(None) => 1,
        Some(Some(number)) if number > 1 => number,
        // `?page=1` is Next's permanent redirect to `/memes`; the rest its 404.
        Some(Some(_)) | None => return proxy::forward(State(state), request).await,
    };
    let Some(directory) = load(&state.pages, &state.db).await else {
        return proxy::forward(State(state), request).await;
    };
    let total = directory.len();
    let count = page_count(total);
    if page_number > count {
        return proxy::forward(State(state), request).await;
    }
    let start = (page_number - 1) * PAGE_SIZE;
    let items = &directory[start..total.min(start + PAGE_SIZE)];
    let site = &state.pages.site;
    let path = page_path(page_number);
    let head = Head {
        title: title(page_number, count),
        description: Some(description(page_number, total, items)),
        canonical: Some(path.clone()),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    let view = View {
        site,
        items,
        page: page_number,
        page_count: count,
        total,
        start,
    };
    super::html(
        StatusCode::OK,
        document::page(site, &head, path_and_query(&request), main(&view)),
    )
}

struct View<'a> {
    site: &'a Site,
    items: &'a [Item],
    page: usize,
    page_count: usize,
    total: usize,
    start: usize,
}

const PAGE_LINK: &str =
    "inline-flex min-h-11 items-center font-semibold underline underline-offset-4";

fn main(view: &View<'_>) -> Markup {
    let first_ten: Vec<(String, String)> = view
        .items
        .iter()
        .take(JSON_LD_ITEMS)
        .map(|item| (item.title.clone(), meme_path(&item.short_id, &item.slug)))
        .collect();
    let prev = (view.page > 1).then(|| page_path(view.page - 1));
    let next = (view.page < view.page_count).then(|| page_path(view.page + 1));
    html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-8" {
            (json_ld::collection_page(view.site, &title(view.page, view.page_count), None, &page_path(view.page), view.items.len(), view.start, &first_ten))
            nav aria-label="브레드크럼" class="text-sm text-muted" {
                a class="hover:text-foreground" href="/" { "밈캐치" }
                " "
                span aria-hidden="true" { "›" }
                " "
                a class="hover:text-foreground" href="/explore" { "밈 탐색" }
            }
            h1 class="mt-2 text-3xl font-extrabold tracking-tight [word-break:keep-all]" {
                "밈 전체 목록"
                @if view.page > 1 {
                    span class="ml-2 text-xl font-bold text-muted" { (view.page) "쪽" }
                }
            }
            p class="mt-3 max-w-2xl text-base leading-relaxed text-muted [word-break:keep-all]" {
                "뜻·유래·사용 맥락을 확인한 밈 문서 " (super::about::grouped(view.total)) "개를 가나다순으로 모았어요. 조건으로 거르려면 "
                a class="underline underline-offset-2" href="/explore" { "밈 탐색" }
                ", 주제로 보려면 "
                a class="underline underline-offset-2" href="/collections" { "테마별 모음" }
                "을 쓰세요."
            }
            ol start=(view.start + 1) class="mt-8 divide-y divide-border border-y border-border" {
                @for item in view.items {
                    (entry(item))
                }
            }
            nav aria-label="목록 페이지" class="mt-8 space-y-4" {
                div class="flex justify-between gap-3" {
                    @if let Some(prev) = prev {
                        a rel="prev" class=(PAGE_LINK) href=(prev) { "← 이전 쪽" }
                    } @else {
                        span {}
                    }
                    @if let Some(next) = next {
                        a rel="next" class=(PAGE_LINK) href=(next) { "다음 쪽 →" }
                    } @else {
                        span {}
                    }
                }
                ul class="flex flex-wrap gap-2 text-sm" {
                    @for number in 1..=view.page_count {
                        li {
                            @if number == view.page {
                                span aria-current="page" class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-foreground px-2 font-bold text-background" { (number) }
                            } @else {
                                a class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border px-2 hover:bg-surface-2" href=(page_path(number)) { (number) }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn entry(item: &Item) -> Markup {
    let label = labels::category_label(&item.category);
    let year = item.origin_year.filter(|year| *year != 0);
    let note = [
        label.map(str::to_owned),
        year.map(|year| format!("{year}년")),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join(" · ");
    html! {
        li class="py-3" {
            a class="text-base font-bold underline decoration-transparent decoration-2 underline-offset-4 hover:decoration-accent [word-break:keep-all]" href=(meme_path(&item.short_id, &item.slug)) { (item.title) }
            @if label.is_some() || year.is_some() {
                span class="ml-2 text-xs text-muted" { (note) }
            }
            @if !item.summary.is_empty() {
                p class="mt-0.5 line-clamp-1 text-sm text-muted" { (item.summary) }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pairs(query: &str) -> Vec<(String, String)> {
        url::form_urlencoded::parse(query.as_bytes())
            .into_owned()
            .collect()
    }

    #[test]
    fn only_one_plain_positive_page_number_is_a_page() {
        assert_eq!(parse_page(&pairs("")), Some(None));
        assert_eq!(parse_page(&pairs("utm_source=x")), Some(None));
        assert_eq!(parse_page(&pairs("page=2")), Some(Some(2)));
        assert_eq!(parse_page(&pairs("page=%32")), Some(Some(2)));
        assert_eq!(parse_page(&pairs("page=999999")), Some(Some(999_999)));
        for bad in [
            "page=0",
            "page=02",
            "page=-1",
            "page=2.5",
            "page=abc",
            "page=",
            "page",
            "page=1000000",
            "page=2&page=3",
            "page=+2",
        ] {
            assert_eq!(parse_page(&pairs(bad)), None, "{bad}");
        }
    }

    #[test]
    fn page_one_has_no_query_and_the_count_is_never_zero() {
        assert_eq!(page_path(1), "/memes");
        assert_eq!(page_path(3), "/memes?page=3");
        assert_eq!(page_count(0), 1);
        assert_eq!(page_count(100), 1);
        assert_eq!(page_count(101), 2);
    }
}
