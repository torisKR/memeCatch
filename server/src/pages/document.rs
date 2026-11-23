//! The document around a native page: the `<head>` Next builds from a page's
//! metadata, in the order Next writes it, and the chrome of
//! `app/_root/root-document.tsx`.
//!
//! Everything is in the first bytes of the response. Next streams the
//! metadata of a slow page into `<body>` for browsers and for Googlebot and
//! moves it with a script; here it is always in `<head>`, which is what Next
//! sends to the crawlers it lists as unable to run scripts.

use maud::{DOCTYPE, Markup, html};
use time::OffsetDateTime;

use super::{chrome, json_ld};
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
}

impl Site {
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
}

fn head(site: &Site, head: &Head) -> Markup {
    html! {
        meta charset="utf-8";
        meta name="viewport" content="width=device-width, initial-scale=1";
        link rel="stylesheet" href=(site.css_href);
        meta name="theme-color" content="#fdfcfa" media="(prefers-color-scheme: light)";
        meta name="theme-color" content="#131316" media="(prefers-color-scheme: dark)";
        meta name="color-scheme" content="light dark";
        title { (head.title) " | " (BRAND) }
        @if let Some(description) = &head.description {
            meta name="description" content=(description);
        }
        meta name="application-name" content=(BRAND);
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
        meta name="apple-mobile-web-app-title" content=(BRAND);
        meta name="apple-mobile-web-app-status-bar-style" content="default";
        @if let (Some(canonical), Some(image)) = (&head.canonical, &head.image) {
            (share_tags(site, head, canonical, image))
        }
        // Next adds a hash of each file to these as a query string.
        link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16";
        link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any";
        link rel="apple-touch-icon" href="/apple-icon.png" type="image/png" sizes="180x180";
        @for (title, href) in FEEDS {
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
        meta property="og:url" content=(site.absolute(canonical));
        meta property="og:site_name" content=(BRAND);
        meta property="og:locale" content="ko_KR";
        meta property="og:image" content=(image.url);
        @if let Some(mime) = image.mime {
            meta property="og:image:type" content=(mime);
        }
        meta property="og:image:width" content=(SHARE_IMAGE_WIDTH);
        meta property="og:image:height" content=(SHARE_IMAGE_HEIGHT);
        meta property="og:image:alt" content=(image.alt);
        meta property="og:type" content="website";
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

/// The whole document. `request_path` is the path as requested, still
/// percent-encoded: the sign-in link returns to it.
pub fn page(site: &Site, page_head: &Head, request_path: &str, main: Markup) -> Markup {
    let login_href = format!("/login?next={}", js::encode_uri_component(request_path));
    html! {
        (DOCTYPE)
        html lang="ko" dir="ltr" data-ga=[site.ga_id.as_deref()] {
            head { (head(site, page_head)) }
            body class="flex min-h-dvh flex-col max-md:pb-[calc(4.5rem+4rem+1rem)] md:pb-0" {
                (json_ld::organization(site))
                div class="flex min-w-0 flex-1 flex-col" {
                    (chrome::header(&login_href))
                    div class="min-w-0 flex-1" { (main) }
                    (chrome::footer(OffsetDateTime::now_utc().year()))
                }
                (chrome::bottom_nav())
                (chrome::chat_launcher())
                @if let Some(id) = &site.ga_id {
                    script async src=(format!("https://www.googletagmanager.com/gtag/js?id={}", js::encode_uri_component(id))) {}
                }
                script defer src=(site.js_href) {}
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
        };
        let out = page(&site(), &head, "/x", html! {}).into_string();
        assert!(!out.contains("og:"));
        assert!(!out.contains("rel=\"canonical\""));
    }
}
