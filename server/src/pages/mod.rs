//! Pages this server renders itself, as finished HTML (Maud templates), in
//! place of a React server render. `docs/axum-migration/UI-PLAN.md` explains
//! the choice and lists what each page still leaves to Next.
//!
//! Route ids: `page-about`, `page-meme` and `page-assets` (the stylesheet,
//! the script and the frame in another language). A page route is off until
//! `AXUM_PILOT_ROUTES` names it (`routes::PAGE_ROUTE_IDS`), and
//! `AXUM_DISABLED_ROUTES` still switches it off.
//!
//! Only a plain document request is answered here. Next's own client router
//! asks for the same paths with an `RSC` header and expects a React payload,
//! so while Next serves the other pages those requests stay with it.

pub mod about;
pub mod account;
pub mod admin;
pub mod cache;
pub mod chrome;
pub mod collections;
pub mod community;
pub mod content_depth;
pub mod dates;
pub mod directory;
pub mod directory_order;
pub mod document;
pub mod documents;
pub mod explore;
pub mod global;
pub mod home;
pub mod i18n;
pub mod json_ld;
pub mod labels;
pub mod locale_explore;
pub mod locale_search;
pub mod meme_card;
pub mod meme_cards;
pub mod meme_detail;
pub mod news;
pub mod not_found;
pub mod quiz;
pub mod rankings;
pub mod retired;
pub mod search;
pub mod slang;
pub mod studio;
pub mod timeline;
pub mod weekly;

use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::extract::{Path, Query, Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use maud::Markup;
use sha2::{Digest, Sha256};

use self::cache::{Keyed, Timed};
use self::chrome::Frame;
use self::document::Site;
use self::i18n::Locale;
use crate::config::Config;
use crate::routes::Routes;
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::explore_previews::Previews;
use crate::routes::public::rankings::RankingsVisibility;
use crate::routes::public::www_to_upstream;
use crate::{AppState, proxy};

/// Built by `scripts/build-ui.mjs`: the stylesheet from `ui/site.css` and
/// `app/globals.css`, the script from `ui/*.js` and the `lib/` modules it uses.
const SITE_CSS: &str = include_str!("../../assets/site.css");
const SITE_JS: &str = include_str!("../../assets/site.js");
/// The scripts of single pages (`PAGE_FILES` of the same build).
const PAGE_JS: [(&str, &str); 12] = [
    ("admin", include_str!("../../assets/pages/admin.js")),
    (
        "community-new",
        include_str!("../../assets/pages/community-new.js"),
    ),
    ("explore", include_str!("../../assets/pages/explore.js")),
    (
        "meme-cards",
        include_str!("../../assets/pages/meme-cards.js"),
    ),
    ("my", include_str!("../../assets/pages/my.js")),
    ("quiz", include_str!("../../assets/pages/quiz.js")),
    (
        "search-page",
        include_str!("../../assets/pages/search-page.js"),
    ),
    ("studio", include_str!("../../assets/pages/studio.js")),
    ("submit", include_str!("../../assets/pages/submit.js")),
    ("support", include_str!("../../assets/pages/support.js")),
    ("home", include_str!("../../assets/pages/home.js")),
    (
        "home-scene",
        include_str!("../../assets/pages/home-scene.js"),
    ),
];
/// The stylesheets of single pages (`PAGE_STYLES` of the same build).
const PAGE_CSS: [(&str, &str); 1] = [("home", include_str!("../../assets/pages/home.css"))];
const ASSET_PREFIX: &str = "/_axum/";

// `Cache-Control` of a page Next renders on request.
pub(crate) const DYNAMIC_PAGE_CACHE: &str =
    "private, no-cache, no-store, max-age=0, must-revalidate";
// The file name carries a hash of the content, so it never changes.
const IMMUTABLE_ASSET_CACHE: &str = "public, max-age=31536000, immutable";
// The frame in another language for one page (`GET /_axum/frame/{locale}`).
// It changes only with a deploy, which restarts the process.
const FRAME_FRAGMENT_TTL: Duration = Duration::from_secs(3600);
// Its key carries a path from the request, so the cap bounds what any number
// of paths can hold: about 30 KB a fragment, so some 130 of them.
const FRAME_FRAGMENT_MAX_BYTES: usize = 4 * 1024 * 1024;
// A path longer than this is not a page of this site.
const FRAME_PATH_MAX: usize = 2048;

/// What every native page needs besides the database. Cheap to clone.
#[derive(Clone)]
pub struct Pages(Arc<Shared>);

pub struct Shared {
    pub site: Site,
    css_name: String,
    js_name: String,
    /// File name and content of each page script.
    page_js: Vec<(String, &'static str)>,
    /// File name and content of each page stylesheet.
    page_css: Vec<(String, &'static str)>,
    /// The memes the sitemap lists, 가나다순 (`directory.rs`, `about.rs`).
    pub(self) directory: Timed<directory::Directory>,
    /// The four cards of the retired product pages.
    retired_cards: Timed<Vec<retired::Card>>,
    /// The decades of /timeline (`timeline.rs`).
    timeline: Timed<timeline::Timeline>,
    /// The lists of /collections/{slug} (`collections.rs`).
    collections: collections::Lists,
    /// Rendered frame fragments by (locale, path and query).
    frames: Keyed<(&'static str, String), Arc<str>>,
    /// The board of /rankings, which /llms.txt reads too (`rankings.rs`).
    pub rankings: Arc<RankingsVisibility>,
    /// The recent memes and the battle of the home page (`home.rs`).
    home: Timed<home::Data>,
    /// The reviewed translations of each edition's home (`home/edition.rs`).
    home_editions: Keyed<&'static str, home::edition::Featured>,
    /// The vote highlights of /news (`news.rs`).
    news: Timed<news::Highlights>,
    /// The ids of the discovery index (`explore.rs`).
    discovery: Timed<Arc<Vec<String>>>,
    /// The rate limits and read slots of `/api/explore/previews`, which the
    /// explore page shares as Next's module shares them.
    pub previews: Arc<Previews>,
}

impl Pages {
    pub fn new(config: &Config) -> Self {
        let css_name = format!("site.{}.css", content_hash(SITE_CSS));
        let js_name = format!("site.{}.js", content_hash(SITE_JS));
        let page_js: Vec<(&'static str, String, &'static str)> = PAGE_JS
            .iter()
            .map(|(name, body)| (*name, format!("{name}.{}.js", content_hash(body)), *body))
            .collect();
        let page_css: Vec<(&'static str, String, &'static str)> = PAGE_CSS
            .iter()
            .map(|(name, body)| (*name, format!("{name}.{}.css", content_hash(body)), *body))
            .collect();
        Self(Arc::new(Shared {
            site: Site {
                url: config.site_url.clone(),
                ga_id: config.ga_id.clone(),
                adsense_client: config.adsense_client.clone(),
                adsense_auto_ads: config.adsense_auto_ads,
                css_href: format!("{ASSET_PREFIX}{css_name}"),
                js_href: format!("{ASSET_PREFIX}{js_name}"),
                page_js: page_js
                    .iter()
                    .map(|(name, file, _)| (*name, format!("{ASSET_PREFIX}{file}")))
                    .collect(),
                page_css: page_css
                    .iter()
                    .map(|(name, file, _)| (*name, format!("{ASSET_PREFIX}{file}")))
                    .collect(),
            },
            css_name,
            js_name,
            page_js: page_js
                .into_iter()
                .map(|(_, file, body)| (file, body))
                .collect(),
            page_css: page_css
                .into_iter()
                .map(|(_, file, body)| (file, body))
                .collect(),
            directory: Timed::new(directory::DIRECTORY_TTL),
            collections: collections::lists(),
            timeline: Timed::new(timeline::TIMELINE_TTL),
            retired_cards: Timed::new(retired::RETIRED_CARDS_TTL),
            discovery: Timed::new(explore::DISCOVERY_TTL),
            news: Timed::new(news::HIGHLIGHTS_TTL),
            home: home::cache(),
            home_editions: home::edition::cache(),
            rankings: Arc::new(RankingsVisibility::default()),
            previews: Arc::new(Previews::new(now_ms())),
            frames: Keyed::new(FRAME_FRAGMENT_TTL, FRAME_FRAGMENT_MAX_BYTES, |body| {
                body.len()
            }),
        }))
    }
}

impl std::ops::Deref for Pages {
    type Target = Shared;

    fn deref(&self) -> &Shared {
        &self.0
    }
}

fn content_hash(content: &str) -> String {
    hex::encode(&Sha256::digest(content.as_bytes())[..8])
}

pub fn router(state: &AppState) -> Router<AppState> {
    let pages = admin::routes(Routes::new(state))
        .add("page-home", "/", get(home::page))
        .add_all(
            "page-locale-home",
            &home::edition::PATHS.map(str::to_owned),
            get(home::edition::page),
        )
        .add("page-about", "/about", get(about::page))
        .add("page-meme", "/memes/{key}", get(meme_detail::page))
        .add("page-memes", "/memes", get(directory::page))
        .add("page-collections", "/collections", get(collections::index))
        .add("page-weekly", "/weekly", get(weekly::page))
        .add("page-timeline", "/timeline", get(timeline::page))
        .add("page-slang", "/slang", get(slang::page))
        .add("page-explore", "/explore", get(explore::page))
        .add_all(
            "page-locale-explore",
            &locale_explore::paths(),
            get(locale_explore::page),
        )
        .add("page-global", "/global", get(global::page))
        .add("page-meme-cards", "/meme-cards", get(meme_cards::page))
        .add_all(
            "page-locale-meme-cards",
            &home::edition::EDITIONS.map(|code| format!("/{code}/meme-cards")),
            get(meme_cards::localized),
        )
        .add("page-news", "/news", get(news::page))
        .add("page-quiz", "/quiz", get(quiz::page))
        .add("page-rankings", "/rankings", get(rankings::page))
        .add_all(
            "page-locale-rankings",
            &rankings::locale_paths(),
            get(rankings::localized),
        )
        .add("page-search", "/search", get(search::page))
        .add_all(
            "page-locale-search",
            &locale_search::paths(),
            get(locale_search::page),
        )
        .add("page-studio", "/studio", get(studio::page))
        .add("page-quiz-result", "/quiz/r/{token}", get(quiz::result))
        .add(
            "page-collection",
            "/collections/{slug}",
            get(collections::list),
        )
        .add("page-contact", "/contact", get(documents::contact::page))
        .add(
            "page-editorial",
            "/editorial",
            get(documents::editorial::page),
        )
        .add("page-guides", "/guides", get(documents::guides::list))
        .add(
            "page-guide",
            "/guides/{slug}",
            get(documents::guides::article),
        )
        .add("page-privacy", "/privacy", get(documents::privacy::page))
        .add("page-terms", "/terms", get(documents::terms::page))
        .add("page-offline", "/offline", get(documents::offline))
        .add(
            "page-originals",
            "/originals",
            get(documents::originals::page),
        )
        .add(
            "page-original-edition",
            "/originals/edition/{slug}",
            get(documents::originals::edition),
        )
        .add(
            "page-missing-meme",
            "/missing-public-meme",
            get(documents::missing_public_meme),
        )
        .add(
            "page-forgot-password",
            "/forgot-password",
            get(account::forgot_password::page),
        )
        .add(
            "page-reset-password",
            "/reset-password",
            get(account::reset_password::page),
        )
        .add("page-login", "/login", get(account::login::page))
        .add("page-my", "/my", get(account::my::page))
        .add("page-support", "/support", get(account::support::page))
        .add("page-submit", "/submit", get(account::submit::page))
        .add("page-community", "/community", get(community::list::page))
        .add(
            "page-community-new",
            "/community/new",
            get(community::new::page),
        )
        .add(
            "page-community-post",
            "/community/{id}",
            get(community::post::page),
        )
        .add(
            "page-onboarding",
            "/onboarding",
            get(account::onboarding::page),
        )
        .add_all(
            "page-retired-products",
            &retired_paths(),
            get(retired::page),
        )
        .build()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            documents_only,
        ))
        // Outermost: proxy.ts answers the www host before anything else.
        .layer(middleware::from_fn_with_state(
            state.clone(),
            www_to_upstream,
        ));
    let assets = Routes::new(state)
        .add("page-assets", "/_axum/{file}", get(asset))
        .add("page-assets", "/_axum/frame/{locale}", get(frame_fragment))
        .add("page-my", "/_axum/my/recent", get(account::my::recent))
        .add(
            "page-explore",
            "/_axum/explore/body",
            get(explore::body_fragment),
        )
        .add("page-explore", "/_axum/explore/more", get(explore::more))
        .add(
            "page-explore",
            "/_axum/explore/cards",
            get(explore::cards_fragment),
        )
        .add(
            "page-search",
            "/_axum/search/body",
            get(search::body_fragment),
        )
        .add_all(
            "page-locale-search",
            &locale_search::body_paths(),
            get(locale_search::body_fragment),
        )
        .build();
    pages.merge(assets)
}

/// A navigation or a crawler's fetch: no `RSC` header, and `Sec-Fetch-Mode`
/// absent or `navigate`. `proxy.ts` uses the same test before it looks a meme
/// up, and Next answers an `RSC` request with a React payload, not HTML.
fn is_document_request(headers: &HeaderMap) -> bool {
    !headers.contains_key("rsc")
        && headers
            .get("sec-fetch-mode")
            .is_none_or(|mode| mode.as_bytes() == b"navigate")
}

/// Without an upstream every request gets the document: a Next client that
/// asks for a React payload and gets HTML does a full navigation instead.
async fn documents_only(State(state): State<AppState>, request: Request, next: Next) -> Response {
    if !state.config.no_upstream && !is_document_request(request.headers()) {
        return proxy::forward(State(state), request).await;
    }
    next.run(request).await
}

/// Every path the decision of `retired.rs` can answer, under each prefix it
/// knows. Paths it does not answer there go on to Next.
fn retired_paths() -> Vec<String> {
    let mut paths = vec![
        "/admin/creator-products".to_owned(),
        "/admin/creator-products/{*rest}".to_owned(),
    ];
    for prefix in ["", "/en", "/ja", "/zh", "/zh-tw"] {
        for path in [
            "/retired-products",
            "/products",
            "/products/{*rest}",
            "/go/products",
            "/go/products/{*rest}",
        ] {
            paths.push(format!("{prefix}{path}"));
        }
    }
    paths
}

/// The request target as received: path and query, still percent-encoded.
pub fn path_and_query(request: &Request) -> &str {
    request
        .uri()
        .path_and_query()
        .map_or_else(|| request.uri().path(), |target| target.as_str())
}

#[derive(serde::Deserialize)]
struct FrameQuery {
    path: String,
}

/// The frame of the page at `?path=` in another language, for the language
/// switch (`ui/locale.js`): `chrome::fragment` as JSON.
async fn frame_fragment(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(query): Query<FrameQuery>,
) -> Response {
    let Some(locale) = Locale::get(&code) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let path = query.path;
    if !path.starts_with('/') || path.starts_with("//") || path.len() > FRAME_PATH_MAX {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let render = || async {
        let frame = Frame {
            locale,
            path_and_query: &path,
        };
        Ok::<_, std::convert::Infallible>(Arc::from(chrome::fragment(&frame).to_string()))
    };
    let Ok(body) = state
        .pages
        .frames
        .get_or_load((locale.code(), path.clone()), render)
        .await;
    (
        [
            (CONTENT_TYPE, "application/json"),
            (CACHE_CONTROL, DYNAMIC_PAGE_CACHE),
        ],
        body.to_string(),
    )
        .into_response()
}

/// A rendered document with the headers Next puts on a page it renders on
/// request.
pub fn html(status: StatusCode, document: Markup) -> Response {
    html_cached(status, DYNAMIC_PAGE_CACHE, document)
}

/// The same with the `Cache-Control` Next sends for that page.
pub fn html_cached(status: StatusCode, cache_control: &'static str, document: Markup) -> Response {
    html_in(status, cache_control, "ko", document)
}

/// The same for a page in another language: its `Content-Language` is the
/// document's language (`ko`, `en`, `ja`, `zh-Hans`, `zh-Hant`).
pub fn html_in(
    status: StatusCode,
    cache_control: &'static str,
    language: &'static str,
    document: Markup,
) -> Response {
    (
        status,
        [
            (CONTENT_TYPE, "text/html; charset=utf-8"),
            (CONTENT_LANGUAGE, language),
            (CACHE_CONTROL, cache_control),
        ],
        document.into_string(),
    )
        .into_response()
}

async fn asset(
    State(state): State<AppState>,
    Path(file): Path<String>,
    request: Request,
) -> Response {
    let (content_type, body) = if file == state.pages.css_name {
        ("text/css; charset=utf-8", SITE_CSS)
    } else if file == state.pages.js_name {
        ("text/javascript; charset=utf-8", SITE_JS)
    } else if let Some((_, body)) = state.pages.page_js.iter().find(|(name, _)| *name == file) {
        ("text/javascript; charset=utf-8", *body)
    } else if let Some((_, body)) = state.pages.page_css.iter().find(|(name, _)| *name == file) {
        ("text/css; charset=utf-8", *body)
    } else {
        // An older or unknown name: Next answers its own 404.
        return proxy::forward(State(state), request).await;
    };
    (
        [
            (CONTENT_TYPE, content_type),
            (CACHE_CONTROL, IMMUTABLE_ASSET_CACHE),
        ],
        body,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn only_navigations_and_plain_fetches_are_document_requests() {
        let with = |name: &'static str, value: &'static str| {
            let mut headers = HeaderMap::new();
            headers.insert(name, HeaderValue::from_static(value));
            is_document_request(&headers)
        };

        assert!(is_document_request(&HeaderMap::new()));
        assert!(with("sec-fetch-mode", "navigate"));
        assert!(!with("sec-fetch-mode", "cors"));
        assert!(!with("sec-fetch-mode", "no-cors"));
        assert!(!with("rsc", "1"));
    }

    #[test]
    fn every_page_bundle_the_build_writes_is_served() {
        // `PAGE_FILES` of scripts/build-ui.mjs: `name: {…}` or `"name": {…}`
        // at its first indent (an entry may spread its `libs` over lines).
        let build = include_str!("../../scripts/build-ui.mjs");
        let start = build.find("const PAGE_FILES = {").expect("PAGE_FILES");
        let block = &build[start..start + build[start..].find("\n};").expect("its end")];
        let names: Vec<&str> = block
            .lines()
            .skip(1)
            .filter(|line| line.starts_with("  ") && !line.starts_with("   "))
            .filter_map(|line| line.trim().split_once(": {"))
            .map(|(name, _)| name.trim_matches('"'))
            .collect();
        let served: Vec<&str> = PAGE_JS.iter().map(|(name, _)| *name).collect();
        assert_eq!(names, served);
    }

    #[test]
    fn every_page_stylesheet_the_build_writes_is_served() {
        // `PAGE_STYLES` of scripts/build-ui.mjs: `name: [...]` lines.
        let build = include_str!("../../scripts/build-ui.mjs");
        let start = build.find("const PAGE_STYLES = {").expect("PAGE_STYLES");
        let block = &build[start..start + build[start..].find("\n};").expect("its end")];
        let names: Vec<&str> = block
            .lines()
            .skip(1)
            .filter_map(|line| line.trim().split_once(": ["))
            .map(|(name, _)| name.trim_matches('"'))
            .collect();
        let served: Vec<&str> = PAGE_CSS.iter().map(|(name, _)| *name).collect();
        assert_eq!(names, served);
    }

    #[test]
    fn asset_names_change_with_their_content() {
        assert_eq!(content_hash("a").len(), 16);
        assert_ne!(content_hash("a"), content_hash("b"));
    }
}
