//! `GET /meme-cards` (`app/(default)/meme-cards/page.tsx`): the collectible
//! card catalogue, sealed (`components/meme-collectible-gallery.tsx`). The
//! page renders the state the address names (`?page=`, `?card=`,
//! `?revealed=1`); choosing, scratching, revealing, the sign-in check and
//! claiming are `ui/meme-cards.js`, over the card routes Axum already
//! answers (`routes/cards`). A card's content is in the document only when
//! the address reveals it.
//!
//! The copy is Korean: the page has no locale prefix and Next keeps those
//! pages in Korean until the language switch changes it in place, which
//! changes only the frame here (B0 difference 67).

use std::collections::BTreeMap;
use std::sync::LazyLock;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use serde_json::json;

use super::document::{self, Head, ShareImage};
use super::meme_card::{Face, poster_face};
use super::path_and_query;
use crate::routes::cards::{self, store::Card};
use crate::{AppState, proxy};

const TITLE: &str = "밈카드";
const DESCRIPTION: &str = "원하는 밈카드를 긁어 공개하고 내 무료 컬렉션에 모으세요.";

/// `MEME_CARDS_COPY` of Korean and the four editions
/// (`server/i18n/meme-cards.json`, from `scripts/build-i18n.mjs`): a
/// function of the copy has `{name}` where its argument goes.
static COPY: LazyLock<BTreeMap<String, BTreeMap<String, String>>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../i18n/meme-cards.json")).expect("meme-cards.json")
});

/// The copy of one language.
#[derive(Clone, Copy)]
struct Copy(&'static BTreeMap<String, String>);

impl Copy {
    fn of(code: &str) -> Self {
        Self(
            COPY.get(code)
                .unwrap_or_else(|| panic!("meme-cards.json has {code}")),
        )
    }

    fn get(self, key: &str) -> &'static str {
        self.0
            .get(key)
            .map(String::as_str)
            .unwrap_or_else(|| panic!("meme-cards.json has {key}"))
    }

    /// A copy function: `{name}` replaced by each value.
    fn fill(self, key: &str, values: &[(&str, &str)]) -> String {
        values
            .iter()
            .fold(self.get(key).to_owned(), |text, (name, value)| {
                text.replace(&format!("{{{name}}}"), value)
            })
    }
}

/// The CSS module's class: `meme-collectible-<name>`.
macro_rules! class {
    ($name:literal) => {
        concat!("meme-collectible-", $name)
    };
}

/// What the address asks for (`MemeCardsPage`).
struct Address {
    page: i32,
    card: Option<String>,
    revealed: bool,
}

fn address(query: Option<&str>) -> Address {
    let pairs: Vec<(String, String)> =
        url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
    // A name given twice is an array to Next, not a string.
    let single = |name: &str| {
        let mut values = pairs
            .iter()
            .filter(|(key, _)| key == name)
            .map(|(_, value)| value.as_str());
        match (values.next(), values.next()) {
            (Some(value), None) => Some(value),
            _ => None,
        }
    };
    let twice = |name: &str| pairs.iter().filter(|(key, _)| key == name).count() > 1;
    // `parseMemeCardPage(typeof sp.page === "string" ? sp.page : null) ?? 1`.
    let page = if twice("page") {
        1
    } else {
        cards::page_number(single("page")).unwrap_or(1)
    };
    Address {
        page,
        card: single("card")
            .filter(|id| cards::card_id(id))
            .map(str::to_owned),
        revealed: single("revealed") == Some("1"),
    }
}

/// `total.toLocaleString("ko")` for a count of at most 1,000.
fn korean_count(total: i32) -> String {
    if total >= 1000 {
        format!("{},{:03}", total / 1000, total % 1000)
    } else {
        total.to_string()
    }
}

/// `memeCardCatalogHref(page)`.
fn catalog_href(page: i32) -> String {
    if page > 1 {
        format!("/meme-cards?page={page}")
    } else {
        "/meme-cards".to_owned()
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    render(state, request, None).await
}

/// `GET /{locale}/meme-cards` (app/[locale]/meme-cards): the same gallery
/// in an edition's language. Its links stay on `/meme-cards`, as Next's do.
pub async fn localized(State(state): State<AppState>, request: Request) -> Response {
    let code = request
        .uri()
        .path()
        .trim_start_matches('/')
        .split('/')
        .next()
        .unwrap_or_default();
    let Some(code) = super::home::edition::EDITIONS
        .into_iter()
        .find(|edition| *edition == code)
    else {
        return proxy::forward(State(state), request).await;
    };
    render(state, request, Some(code)).await
}

async fn render(state: AppState, request: Request, edition: Option<&'static str>) -> Response {
    let address = address(request.uri().query());
    let site = &state.pages.site;
    let t = Copy::of(edition.unwrap_or("ko"));
    let head = match edition {
        None => Head {
            title: TITLE.to_owned(),
            description: Some(DESCRIPTION.to_owned()),
            canonical: Some("/meme-cards".to_owned()),
            image: Some(ShareImage::site_default(site)),
            script: Some("meme-cards"),
            alternate_locales: true,
            ..Head::default()
        },
        // `buildLocalizedMetadata` with the page's own title: no hreflang.
        Some(code) => Head {
            title: t.get("title").to_owned(),
            description: Some(t.get("description").to_owned()),
            canonical: Some(format!("/{code}/meme-cards")),
            image: Some(ShareImage::edition_default(site, code)),
            script: Some("meme-cards"),
            edition: Some(code),
            ..Head::default()
        },
    };
    let catalogue = cards::catalogue_page(&state.db, address.page);
    let selected = async {
        match &address.card {
            Some(id) => cards::eligible_card(&state.db, id).await,
            None => Ok(None),
        }
    };
    let (catalogue, selected) = tokio::join!(catalogue, selected);
    let (Ok((seals, total, has_more)), Ok(selected)) = (catalogue, selected) else {
        // Next streams the page, so a failed read leaves its loading
        // skeleton in the document (a 200) and the browser then shows
        // error.tsx: Next answers, as for /memes (PLAN.md B2-3, B2-13).
        tracing::warn!("meme cards not read; Next answers");
        return proxy::forward(State(state), request).await;
    };
    let main = gallery(t, &address, &seals, total, has_more, selected.as_ref());
    let locale = super::i18n::Locale::get(edition.unwrap_or("ko")).expect("an edition is a locale");
    super::html_in(
        StatusCode::OK,
        super::DYNAMIC_PAGE_CACHE,
        locale.info().lang.as_str(),
        document::page_in(site, &head, path_and_query(&request), main, locale),
    )
}

fn seal(t: Copy, compact: bool) -> Markup {
    html! {
        div class={(class!("sealed-card")) " " @if compact { (class!("seal-compact")) }} aria-hidden="true" {
            div class=(class!("seal-inner")) {
                span class=(class!("seal-top")) { "MEMECATCH " span { "COLLECTION" } }
                div class=(class!("seal-orbit")) { span { "m" span { "↗" } } }
                div class=(class!("seal-footer")) { strong { (t.get("foilTitle")) } span { (t.get("foilHint")) } i { "✦" } }
            }
        }
    }
}

fn face(card: &Card) -> Markup {
    poster_face(&Face {
        title: &card.title,
        summary: card.summary,
        safety: None,
        year: card.origin_year,
    })
}

fn gallery(
    t: Copy,
    address: &Address,
    seals: &[Card],
    total: i32,
    has_more: bool,
    selected: Option<&Card>,
) -> Markup {
    let pages = (total + cards::CATALOGUE_PAGE_SIZE - 1) / cards::CATALOGUE_PAGE_SIZE;
    let pages = pages.max(1);
    let revealed = address.revealed && selected.is_some();
    let state = json!({
        "page": address.page,
        "seals": seals.iter().map(|card| card.id.as_str()).collect::<Vec<_>>(),
        "selected": selected.map(|card| card.id.as_str()),
        "copy": t.0,
        "card": if revealed { selected.map(|card| json!({ "id": card.id, "title": card.title, "summary": card.summary, "originYear": card.origin_year, "href": card.href, "cardNo": card.card_no })) } else { None },
    });
    html! {
        main class=(class!("page")) data-meme-cards=(state.to_string()) {
            header class=(class!("hero")) {
                div {
                    span class=(class!("eyebrow")) { (t.get("eyebrow")) }
                    h1 { (t.get("title")) }
                    p { (t.get("description")) }
                    div class=(class!("hero-links")) {
                        span class=(class!("free-badge")) { (t.get("free")) }
                        a href="/my#meme-cards" class=(class!("text-button")) { (t.get("my")) " ↗" }
                    }
                }
                div class=(class!("hero-mark")) aria-hidden="true" { "m" span { "↗" } }
            }
            @if address.card.is_some() && selected.is_none() {
                p role="status" class=(class!("notice")) { (t.get("selectedMissing")) }
            }
            @if let Some(card) = selected {
                (reveal_section(t, card, revealed))
            }
            section aria-labelledby="meme-card-catalog-title" {
                div class=(class!("section-heading")) {
                    h2 id="meme-card-catalog-title" { (t.get("catalog")) }
                    p { (t.fill("availableCount", &[("total", &korean_count(total))])) }
                }
                div class=(class!("discovery-tools")) {
                    p { (t.get("discoveryHint")) }
                    button type="button" class=(class!("secondary-button")) disabled[seals.len() < 2] data-meme-cards-shuffle { (t.get("shuffle")) " ↻" }
                }
                @if seals.is_empty() {
                    div class=(class!("empty")) { h3 { (t.get("noResults")) } p { (t.get("noResultsBody")) } }
                } @else {
                    ul class=(class!("grid")) data-meme-cards-grid {
                        @for (index, seal_card) in seals.iter().enumerate() {
                            li {
                                button type="button" data-card-id=(seal_card.id) class=(class!("catalog-button")) aria-label=(t.fill("sealedChoice", &[("index", &(index + 1).to_string())])) aria-pressed=(selected.is_some_and(|card| card.id == seal_card.id)) {
                                    (seal(t, true))
                                }
                            }
                        }
                    }
                }
                @if pages > 1 {
                    nav class=(class!("pagination")) aria-label=(t.get("catalog")) {
                        @if address.page > 1 { a class=(class!("secondary-button")) href=(catalog_href(address.page - 1)) { (t.get("previous")) } }
                        span { (t.fill("page", &[("page", &address.page.to_string()), ("pages", &pages.to_string())])) }
                        @if has_more { a class=(class!("secondary-button")) href=(catalog_href(address.page + 1)) { (t.get("next")) } }
                    }
                }
            }
            (templates(t))
        }
    }
}

/// The scratch area of a card: sealed, or revealed when the address says so.
fn scratch_area(t: Copy, card_id: &str, revealed: Option<&Card>) -> Markup {
    html! {
        div class=(class!("scratch-area")) data-card-id=(card_id) data-scratch-progress="0" data-revealed=(revealed.is_some()) data-scratch-state=(if revealed.is_some() { "revealed" } else { "sealed" }) {
            div class=(class!("scratch-card")) data-complete=(revealed.is_some()) data-pointer="false" data-dragging="false" {
                @match revealed {
                    Some(card) => { div aria-hidden="false" { (face(card)) } }
                    None => {
                        (seal(t, false))
                        canvas class=(class!("scratch-canvas")) aria-label=(t.get("scratch")) aria-hidden="false" data-complete="false" data-canvas-state="pending" data-testid="scratch-canvas" {}
                        div class=(class!("scratch-shimmer")) data-scratch-shimmer="true" aria-hidden="true" {}
                        div class=(class!("scratch-brush")) data-scratch-brush="true" aria-hidden="true" {}
                        div class=(class!("scratch-dust")) data-scratch-dust="true" aria-hidden="true" {}
                    }
                }
            }
            @if revealed.is_some() {
                p class=(class!("revealed-status")) role="status" { "✦ " (t.get("revealed")) }
            } @else {
                div class=(class!("scratch-controls")) {
                    div class=(class!("progress-track")) role="progressbar" aria-label=(t.get("revealProgress")) aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" {
                        span style="width:0%" {}
                    }
                    p class=(class!("progress")) { (t.get("revealProgress")) " 0%" }
                    button type="button" class=(class!("text-button")) data-meme-cards-reveal { (t.get("reveal")) }
                }
            }
        }
    }
}

fn small(t: Copy) -> Markup {
    html! { p class=(class!("small")) { (t.get("originalArt")) br; (t.get("rights")) } }
}

fn reveal_section(t: Copy, card: &Card, revealed: bool) -> Markup {
    let shown = revealed.then_some(card);
    html! {
        section id="reveal" class=(class!("reveal")) aria-labelledby="meme-card-reveal-title" data-card-id=(card.id) data-revealed=(revealed) {
            (scratch_area(t, &card.id, shown))
            div class=(class!("reveal-details")) {
                @match shown {
                    Some(card) => {
                        span class=(class!("eyebrow")) { (format!("NO. {:04} / {}", card.card_no, cards::CATALOGUE_TARGET)) }
                        h2 id="meme-card-reveal-title" tabindex="-1" { (card.title) }
                        p { (card.summary) }
                    }
                    None => {
                        span class=(class!("eyebrow")) { (t.get("sealed")) }
                        h2 id="meme-card-reveal-title" tabindex="-1" { (t.get("revealTitle")) }
                        p { (t.get("scratchHint")) }
                    }
                }
                div class=(class!("reveal-actions")) {
                    @if let Some(card) = shown {
                        // Signed in or not is known only once the script asks.
                        button type="button" class=(class!("primary-button")) disabled data-meme-cards-claim { (t.get("checking")) }
                        p class=(class!("small")) { (t.get("loginHint")) }
                        a href=(card.href) class=(class!("secondary-button")) { (t.get("details")) " ↗" }
                    }
                    button type="button" class=(class!("text-button")) data-meme-cards-cancel { (t.get("cancel")) }
                    (small(t))
                }
            }
        }
    }
}

/// What `ui/meme-cards.js` builds the reveal from: a sealed section, the
/// face, and the small parts the details show.
fn templates(t: Copy) -> Markup {
    let blank = Card::placeholder();
    html! {
        template data-meme-cards-sealed { (reveal_section(t, &blank, false)) }
        // With a summary and a year, which the script fills or removes.
        template data-meme-cards-face { div aria-hidden="true" { (poster_face(&Face { title: "", summary: "-", safety: None, year: Some(0) })) } }
        template data-meme-cards-parts {
            p class=(class!("loading")) role="status" data-part="loading" { span {} (t.get("revealLoading")) }
            div class=(class!("notice")) role="alert" data-part="content-error" {
                p {}
                button type="button" class=(class!("secondary-button")) data-meme-cards-retry { (t.get("retry")) }
            }
            p class=(class!("revealed-status")) role="status" data-part="revealed" { "✦ " (t.get("revealed")) }
            span class=(class!("owned-badge")) data-part="owned" { (t.get("owned")) " ✓" }
            a href="/my#meme-cards" class=(class!("primary-button")) data-part="my" { (t.get("my")) }
            a class=(class!("primary-button")) data-part="login" { (t.get("loginClaim")) }
            p role="alert" class=(class!("notice")) data-part="auth-failure" { (t.get("authFailure")) }
            button type="button" class=(class!("secondary-button")) data-part="auth-retry" { (t.get("retry")) }
            button type="button" class=(class!("primary-button")) data-part="claim" data-meme-cards-claim {}
            p class=(class!("small")) data-part="login-hint" { (t.get("loginHint")) }
            p class=(class!("notice")) role="alert" data-part="notice" {}
            a class=(class!("secondary-button")) data-part="details" { (t.get("details")) " ↗" }
            span class=(class!("owned-badge")) data-part="seal-owned" { (t.get("owned")) }
            div class=(class!("scratch-controls")) data-part="controls" {
                div class=(class!("progress-track")) role="progressbar" aria-label=(t.get("revealProgress")) aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" {
                    span style="width:0%" {}
                }
                p class=(class!("progress")) { (t.get("revealProgress")) " 0%" }
                button type="button" class=(class!("text-button")) data-meme-cards-reveal { (t.get("reveal")) }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_address_names_one_page_card_and_reveal() {
        let a = address(Some("page=2&card=mc-0003&revealed=1"));
        assert_eq!(
            (a.page, a.card.as_deref(), a.revealed),
            (2, Some("mc-0003"), true)
        );
        let a = address(Some("page=0&card=mc-0000&revealed=true"));
        assert_eq!((a.page, a.card, a.revealed), (1, None, false));
        let a = address(Some("page=2&page=2&card=mc-0001&card=mc-0001"));
        assert_eq!((a.page, a.card), (1, None));
        assert_eq!(address(Some("page=43")).page, 1);
    }

    #[test]
    fn catalogue_hrefs_and_counts() {
        assert_eq!(catalog_href(1), "/meme-cards");
        assert_eq!(catalog_href(2), "/meme-cards?page=2");
        assert_eq!(
            (korean_count(30), korean_count(1000)),
            ("30".to_owned(), "1,000".to_owned())
        );
    }
}
