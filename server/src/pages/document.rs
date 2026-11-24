//! The document around a native page: the `<head>` Next builds from a page's
//! metadata, in the order Next writes it, and the chrome of
//! `app/_root/root-document.tsx`.
//!
//! Everything is in the first bytes of the response. Next streams the
//! metadata of a slow page into `<body>` for browsers and for Googlebot and
//! moves it with a script; here it is always in `<head>`, which is what Next
//! sends to the crawlers it lists as unable to run scripts.

use maud::{DOCTYPE, Markup, html};

use super::chrome::{Frame, chat, footer, header, overlays};
use super::i18n::Locale;
use super::json_ld;
use crate::routes::public::js;

const BRAND: &str = "밈캐치";
// `SHARED_ROOT_METADATA.verification` in app/_root/metadata.ts.
const GOOGLE_SITE_VERIFICATION: &str = "tNpEvRKUbirAkwRA-XH0HJzDh8bCF6Waqctqu1Hak38";
const NAVER_SITE_VERIFICATIONS: [&str; 2] = [
    "4973421614cb5e3682ed4c99e6deee5c66b1f587",
    "86e27030ca82a4577a7a16ed1ac0a70799c029ec",
];
// `MEME_FEEDS` in lib/meme-rss-feeds.ts.
const FEEDS: [(&str, &str); 2] = [
    ("밈캐치 — 새로 등록된 밈", "/feed.xml"),
    ("밈캐치 — 최근 내용이 바뀐 밈", "/feed/updated.xml"),
];
const SHARE_IMAGE_WIDTH: &str = "1200";
const SHARE_IMAGE_HEIGHT: &str = "630";

/// Values fixed for the life of the process.
pub struct Site {
    /// `SITE_URL` in lib/site.ts: no trailing slash.
    pub url: String,
    pub ga_id: Option<String>,
    pub adsense_client: Option<String>,
    pub adsense_auto_ads: bool,
    pub css_href: String,
    pub js_href: String,
    /// The script of each page that has one of its own: name and path.
    pub page_js: Vec<(&'static str, String)>,
    /// The stylesheet of each page that has one of its own: name and path.
    pub page_css: Vec<(&'static str, String)>,
}

// ADSENSE_CLIENT_ID in lib/adsense-policy.ts: no other client loads ads.
const ADSENSE_CLIENT_ID: &str = "ca-pub-3004906966180197";

impl Site {
    /// `AdsenseScript`: the client whose loader a page that shows ads carries
    /// (`data-ads` on `<main>`), when ads are switched on and the client is
    /// the site's own.
    pub fn ads_client(&self) -> Option<&str> {
        self.adsense_client
            .as_deref()
            .filter(|client| *client == ADSENSE_CLIENT_ID && self.adsense_auto_ads)
    }

    /// `new URL(path, metadataBase)` for a path of this site.
    pub fn absolute(&self, path: &str) -> String {
        format!("{}{path}", self.url)
    }
}

/// One Open Graph image, 1200 by 630.
pub struct ShareImage {
    pub url: String,
    /// `og:image:type`. The per-meme card states none.
    pub mime: Option<&'static str>,
    pub alt: String,
}

impl ShareImage {
    /// `ogDefaultImageDescriptor(locale)` of a translated edition.
    pub fn edition_default(site: &Site, code: &str) -> Self {
        Self {
            url: site.absolute(&format!("/og/{code}")),
            mime: Some("image/png"),
            alt: super::home::copy::copy(code).seo.default_title.clone(),
        }
    }

    /// `ogDefaultImageDescriptor("ko")` in lib/og-default-image.ts.
    pub fn site_default(site: &Site) -> Self {
        Self {
            url: site.absolute("/og/ko"),
            mime: Some("image/png"),
            alt: "밈캐치 — 그 밈, 3초 안에 알려드려요".to_owned(),
        }
    }
}

/// A page's `Metadata`, with the fields the Korean pages set.
#[derive(Default)]
pub struct Head {
    /// Without the brand: the layout template appends ` | 밈캐치` to
    /// `<title>` and Open Graph carries the bare title.
    pub title: String,
    pub description: Option<String>,
    /// `<meta name="robots">`. `None` leaves the page indexable.
    pub robots: Option<&'static str>,
    /// Canonical path. Also `og:url`, with the share tags.
    pub canonical: Option<String>,
    /// `alternates.languages`: hreflang and path, in order.
    pub languages: Vec<(String, String)>,
    pub image: Option<ShareImage>,
    /// `koreanPageShare({ alternateLocales: true })`: the four
    /// `og:locale:alternate` tags the layout card would have had.
    pub alternate_locales: bool,
    /// No share tags of the page's own: the layout's card
    /// (`SHARED_ROOT_METADATA` in app/_root/metadata.ts) with the site title.
    pub site_card: bool,
    /// `openGraph.type: "article"` instead of `"website"`.
    pub article: bool,
    /// `openGraph.alternateLocale` of a page's own: the Open Graph locale of
    /// each translation it links (the meme page).
    pub og_alternates: Vec<&'static str>,
    /// `<title>` without the layout template: /rankings has a root layout
    /// of its own, and Next applies no template there.
    pub title_absolute: bool,
    /// The page's own script (`assets/pages/<name>.js`), after site.js.
    pub script: Option<&'static str>,
    /// The page's own stylesheet (`assets/pages/<name>.css`), after site.css.
    pub stylesheet: Option<&'static str>,
    /// A translated edition's page (`/{locale}/…`: en, ja, zh, zh-tw): its
    /// site name, Open Graph locale and alternates, and no Korean feeds.
    pub edition: Option<&'static str>,
    /// The metadata of a root layout of its own that spreads only
    /// `SHARED_ROOT_METADATA` (`/{locale}/rankings`): no application name,
    /// "MemeCatch" as the Apple title and site name, no feeds, no
    /// `og:locale`.
    pub shared_root: bool,
    /// `openGraph.url` when it is not the canonical path.
    pub share_url: Option<String>,
    /// No `openGraph` of the page's own and no layout card: Next fills the
    /// title and description from the page and the image from the root
    /// `opengraph-image` route (`/{locale}/rankings` when it cannot be read).
    /// Next writes that image's address with its own bind address; this
    /// writes the site's (`PLAN.md` B5-3).
    pub file_card: bool,
}

// `SHARED_ROOT_METADATA.appleWebApp.title`.
const SHARED_ROOT_BRAND: &str = "MemeCatch";

/// `SEO_LOCALE_CONFIG`: each edition's `openGraph.locale`, Korean first.
const EDITION_OPEN_GRAPH_LOCALES: [(&str, &str); 5] = [
    ("ko", "ko_KR"),
    ("en", "en_US"),
    ("ja", "ja_JP"),
    ("zh", "zh_CN"),
    ("zh-tw", "zh_TW"),
];

impl Head {
    /// `siteName` of the page's edition.
    fn brand(&self) -> &'static str {
        if self.shared_root {
            return SHARED_ROOT_BRAND;
        }
        self.edition.map_or(BRAND, |code| {
            super::home::copy::copy(code).seo.site_name.as_str()
        })
    }

    fn open_graph_locale(&self) -> &'static str {
        let code = self.edition.unwrap_or("ko");
        EDITION_OPEN_GRAPH_LOCALES
            .iter()
            .find(|(edition, _)| *edition == code)
            .map_or("ko_KR", |(_, locale)| locale)
    }

    /// `openGraph.alternateLocale`: the other editions.
    fn open_graph_alternates(&self) -> Vec<&'static str> {
        match self.edition {
            None => ALTERNATE_OPEN_GRAPH_LOCALES.to_vec(),
            Some(code) => EDITION_OPEN_GRAPH_LOCALES
                .iter()
                .filter(|(edition, _)| *edition != code)
                .map(|(_, locale)| *locale)
                .collect(),
        }
    }
}

// `SHARED_ROOT_METADATA.openGraph` and `.twitter`.
const SITE_CARD_TITLE: &str = "밈캐치 — 그 밈, 3초 안에 알려드려요";
const SITE_CARD_DESCRIPTION: &str = "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지 한눈에 정리한 한국 밈 사전이에요. 1990년대 유행어부터 최신 숏폼 챌린지까지 사용 신호와 출처를 함께 보여 드려요. 궁금한 밈, 3초 안에 확인하세요.";
// `KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES` in lib/i18n-routing.ts.
const ALTERNATE_OPEN_GRAPH_LOCALES: [&str; 4] = ["en_US", "ja_JP", "zh_CN", "zh_TW"];

fn head(site: &Site, head: &Head) -> Markup {
    html! {
        meta charset="utf-8";
        meta name="viewport" content="width=device-width, initial-scale=1";
        link rel="stylesheet" href=(site.css_href);
        @if let Some((_, href)) = head.stylesheet.and_then(|name| site.page_css.iter().find(|(page, _)| *page == name)) {
            link rel="stylesheet" href=(href);
        }
        meta name="theme-color" content="#fdfcfa" media="(prefers-color-scheme: light)";
        meta name="theme-color" content="#131316" media="(prefers-color-scheme: dark)";
        meta name="color-scheme" content="light dark";
        @if head.title_absolute {
            title { (head.title) }
        } @else {
            title { (head.title) " | " (head.brand()) }
        }
        @if let Some(description) = &head.description {
            meta name="description" content=(description);
        }
        @if !head.shared_root {
            meta name="application-name" content=(head.brand());
        }
        link rel="manifest" href="/manifest.webmanifest";
        @if let Some(robots) = head.robots {
            meta name="robots" content=(robots);
        }
        @if let Some(canonical) = &head.canonical {
            link rel="canonical" href=(site.absolute(canonical));
        }
        @for (hreflang, path) in &head.languages {
            link rel="alternate" hreflang=(hreflang) href=(site.absolute(path));
        }
        meta name="google-site-verification" content=(GOOGLE_SITE_VERIFICATION);
        @for value in NAVER_SITE_VERIFICATIONS {
            meta name="naver-site-verification" content=(value);
        }
        @if let Some(client) = &site.adsense_client {
            meta name="google-adsense-account" content=(client);
        }
        meta name="mobile-web-app-capable" content="yes";
        meta name="apple-mobile-web-app-title" content=(head.brand());
        meta name="apple-mobile-web-app-status-bar-style" content="default";
        @if let (Some(canonical), Some(image)) = (&head.canonical, &head.image) {
            (share_tags(site, head, canonical, image))
        }
        @if head.site_card {
            (site_card(site))
        }
        @if head.file_card {
            (file_card(site, head))
        }
        // Next adds a hash of each file to these as a query string.
        link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16";
        link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any";
        link rel="apple-touch-icon" href="/apple-icon.png" type="image/png" sizes="180x180";
        @for (title, href) in FEEDS.iter().filter(|_| head.edition.is_none() && !head.shared_root) {
            link rel="alternate" type="application/rss+xml" title=(title) href=(href);
        }
    }
}

/// Open Graph and Twitter tags, as `koreanPageShare` and the meme page set them.
fn share_tags(site: &Site, head: &Head, canonical: &str, image: &ShareImage) -> Markup {
    html! {
        meta property="og:title" content=(head.title);
        @if let Some(description) = &head.description {
            meta property="og:description" content=(description);
        }
        meta property="og:url" content=(site.absolute(head.share_url.as_deref().unwrap_or(canonical)));
        meta property="og:site_name" content=(head.brand());
        @if !head.shared_root {
            meta property="og:locale" content=(head.open_graph_locale());
        }
        meta property="og:image" content=(image.url);
        @if let Some(mime) = image.mime {
            meta property="og:image:type" content=(mime);
        }
        meta property="og:image:width" content=(SHARE_IMAGE_WIDTH);
        meta property="og:image:height" content=(SHARE_IMAGE_HEIGHT);
        meta property="og:image:alt" content=(image.alt);
        @if head.alternate_locales {
            @for locale in head.open_graph_alternates() {
                meta property="og:locale:alternate" content=(locale);
            }
        }
        @for locale in &head.og_alternates {
            meta property="og:locale:alternate" content=(locale);
        }
        meta property="og:type" content=(if head.article { "article" } else { "website" });
        meta name="twitter:card" content="summary_large_image";
        meta name="twitter:title" content=(head.title);
        @if let Some(description) = &head.description {
            meta name="twitter:description" content=(description);
        }
        meta name="twitter:image" content=(image.url);
        meta name="twitter:image:alt" content=(image.alt);
        @if let Some(mime) = image.mime {
            meta name="twitter:image:type" content=(mime);
        }
        meta name="twitter:image:width" content=(SHARE_IMAGE_WIDTH);
        meta name="twitter:image:height" content=(SHARE_IMAGE_HEIGHT);
    }
}

// `alt` of app/opengraph-image.tsx.
const FILE_CARD_ALT: &str = "밈캐치 — 그 밈, 3초 안에 알려드려요";

/// The share tags Next derives from the page and `app/opengraph-image.tsx`.
fn file_card(site: &Site, head: &Head) -> Markup {
    let image = site.absolute("/opengraph-image");
    html! {
        meta property="og:title" content=(head.title);
        @if let Some(description) = &head.description {
            meta property="og:description" content=(description);
        }
        meta property="og:image" content=(image);
        meta property="og:image:type" content="image/png";
        meta property="og:image:width" content=(SHARE_IMAGE_WIDTH);
        meta property="og:image:height" content=(SHARE_IMAGE_HEIGHT);
        meta property="og:image:alt" content=(FILE_CARD_ALT);
        meta name="twitter:card" content="summary_large_image";
        meta name="twitter:title" content=(head.title);
        @if let Some(description) = &head.description {
            meta name="twitter:description" content=(description);
        }
        meta name="twitter:image" content=(image);
        meta name="twitter:image:alt" content=(FILE_CARD_ALT);
        meta name="twitter:image:type" content="image/png";
        meta name="twitter:image:width" content=(SHARE_IMAGE_WIDTH);
        meta name="twitter:image:height" content=(SHARE_IMAGE_HEIGHT);
    }
}

/// The layout's card, for a page that sets no share tags of its own.
fn site_card(site: &Site) -> Markup {
    let image = ShareImage::site_default(site);
    html! {
        meta property="og:title" content=(SITE_CARD_TITLE);
        meta property="og:description" content=(SITE_CARD_DESCRIPTION);
        meta property="og:site_name" content=(BRAND);
        meta property="og:locale" content="ko_KR";
        meta property="og:image" content=(image.url);
        meta property="og:image:type" content="image/png";
        meta property="og:image:width" content=(SHARE_IMAGE_WIDTH);
        meta property="og:image:height" content=(SHARE_IMAGE_HEIGHT);
        meta property="og:image:alt" content=(image.alt);
        @for locale in ALTERNATE_OPEN_GRAPH_LOCALES {
            meta property="og:locale:alternate" content=(locale);
        }
        meta property="og:type" content="website";
        meta name="twitter:card" content="summary_large_image";
        meta name="twitter:title" content=(SITE_CARD_TITLE);
        meta name="twitter:description" content=(SITE_CARD_DESCRIPTION);
        meta name="twitter:image" content=(image.url);
        meta name="twitter:image:alt" content=(image.alt);
        meta name="twitter:image:type" content="image/png";
        meta name="twitter:image:width" content=(SHARE_IMAGE_WIDTH);
        meta name="twitter:image:height" content=(SHARE_IMAGE_HEIGHT);
    }
}

/// The whole document of a Korean page. `path_and_query` is the request
/// target as received, still percent-encoded: the sign-in links return to
/// its path and the language switch keeps its query.
pub fn page(site: &Site, page_head: &Head, path_and_query: &str, main: Markup) -> Markup {
    page_in(site, page_head, path_and_query, main, Locale::korean())
}

/// The whole document in the frame of `locale` (`RootDocument locale`): a
/// translated edition's page.
pub fn page_in(
    site: &Site,
    page_head: &Head,
    path_and_query: &str,
    main: Markup,
    locale: Locale,
) -> Markup {
    let frame = Frame {
        locale,
        path_and_query,
    };
    let info = frame.locale.info();
    html! {
        (DOCTYPE)
        html lang=(info.lang) dir=(info.dir) data-ga=[site.ga_id.as_deref()] {
            head { (head(site, page_head)) }
            body class="flex min-h-dvh flex-col max-md:pb-[calc(4.5rem+4rem+1rem)] md:pb-0" {
                (json_ld::organization(site))
                (overlays::nav_progress())
                div class="flex min-w-0 flex-1 flex-col" {
                    (header::header(&frame))
                    div class="min-w-0 flex-1" { (main) }
                    (footer::footer(&frame))
                }
                (footer::bottom_nav(&frame))
                (chat::chat(&frame))
                (overlays::login_gate(&frame))
                (overlays::install_prompt())
                @if let Some(id) = &site.ga_id {
                    script async src=(format!("https://www.googletagmanager.com/gtag/js?id={}", js::encode_uri_component(id))) {}
                }
                script defer src=(site.js_href) {}
                @if let Some((_, href)) = page_head.script.and_then(|name| site.page_js.iter().find(|(page, _)| *page == name)) {
                    script defer src=(href) {}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn site() -> Site {
        Site {
            url: "https://catchmeme.com".to_owned(),
            ga_id: None,
            adsense_client: Some("ca-pub-1".to_owned()),
            adsense_auto_ads: false,
            css_href: "/_axum/site.css".to_owned(),
            js_href: "/_axum/site.js".to_owned(),
            page_js: Vec::new(),
            page_css: Vec::new(),
        }
    }

    #[test]
    fn head_is_complete_before_the_body_and_escapes_its_values() {
        let head = Head {
            title: "\"밈\" <뜻>".to_owned(),
            description: Some("a & b".to_owned()),
            robots: Some("noindex, follow"),
            canonical: Some("/memes/abc-x".to_owned()),
            languages: vec![("ko".to_owned(), "/memes/abc-x".to_owned())],
            image: Some(ShareImage::site_default(&site())),
            ..Head::default()
        };
        let out = page(&site(), &head, "/memes/abc-x", html! { main {} }).into_string();
        let (head_html, body_html) = out.split_once("</head>").expect("a head");

        assert!(head_html.contains("<title>&quot;밈&quot; &lt;뜻&gt; | 밈캐치</title>"));
        assert!(head_html.contains(r#"<meta name="description" content="a &amp; b">"#));
        assert!(head_html.contains(r#"<meta name="robots" content="noindex, follow">"#));
        assert!(
            head_html
                .contains(r#"<link rel="canonical" href="https://catchmeme.com/memes/abc-x">"#)
        );
        assert!(head_html.contains(
            r#"<link rel="alternate" hreflang="ko" href="https://catchmeme.com/memes/abc-x">"#
        ));
        assert!(head_html.contains(r#"<meta property="og:image:type" content="image/png">"#));
        assert!(head_html.contains(r#"<meta name="google-adsense-account" content="ca-pub-1">"#));
        // No analytics id: no analytics script, and no attribute for site.js to read.
        assert!(!out.contains("googletagmanager"));
        assert!(!out.contains("data-ga"));
        assert!(body_html.contains(r#"href="/login?next=%2Fmemes%2Fabc-x""#));
    }

    #[test]
    fn a_page_without_a_canonical_has_no_share_tags() {
        let head = Head {
            title: "없음".to_owned(),
            description: None,
            robots: Some("noindex, follow"),
            canonical: None,
            languages: Vec::new(),
            image: None,
            ..Head::default()
        };
        let out = page(&site(), &head, "/x", html! {}).into_string();
        assert!(!out.contains("og:"));
        assert!(!out.contains("rel=\"canonical\""));
    }
}
