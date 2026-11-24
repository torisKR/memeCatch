//! `GET /memes/{key}`: the Korean meme document
//! (`app/(default)/memes/[key]/page.tsx`, and the part of `proxy.ts` that
//! runs before it).
//!
//! In the order Next applies them:
//!
//! 1. no public row for the short id: the editorial article when the key is
//!    one of the eight editorial memes (`curated.rs`), else 404 with the "no
//!    such meme" document;
//! 2. the key is not the canonical one (a bare short id, a stale slug,
//!    lowercase percent-encoding, an alias): 308 to the canonical path, with
//!    the query string kept;
//! 3. otherwise the document, with `noindex` when it fails the index gate.
//!
//! A request stays with Next when this port cannot render the same document:
//! a failed database read (Next has its own outage page), a row with media,
//! and any document while one of its interactive parts needs a server action
//! (`parts_are_native`).

mod appendix;
mod context_nav;
mod curated;
mod export;
mod house;
mod passport;
mod related;
mod sections;
mod seo;
pub mod signal_trace;
mod sources;
mod translations;
mod view;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{CONTENT_LANGUAGE, LOCATION};
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use maud::html;
use serde::Deserialize;
use serde_json::Value;
use sqlx::Row;
use time::OffsetDateTime;
use unicode_normalization::UnicodeNormalization;

use super::content_depth::{
    ContentDepth, ContentRow, DepthInput, SourceRow, content_depth, is_context_source_url,
    is_public_display_source, public_source_url,
};
use super::document::{self, Head, ShareImage};
use super::json_ld::{self, MemeTerm};
use super::{html as html_response, labels, not_found};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::headers::AnsweredBeforeRouting;
use crate::routes::public::labels::meme_path;
use crate::routes::public::{explore_previews, js};
use crate::routes::request::decode_uri_component;
use crate::{AppState, proxy};

// CANONICAL_MEME_ALIAS_MAP in lib/canonical-meme-path.ts.
const CANONICAL_ALIASES: [(&str, &str); 2] = [("cssqxwmb", "gnact78h"), ("9ajbp6w6", "gnact78h")];
// KOREAN_MEME_CARD_SUFFIX in lib/meme-share-image.ts.
pub(super) const SHARE_CARD_SUFFIX: &str = "opengraph-image-k2cx9c";
// lib/usage-examples.ts.
const MAX_USAGE_EXAMPLES: usize = 3;
const MAX_SITUATION_LENGTH: usize = 120;
const MAX_EXAMPLE_TEXT_LENGTH: usize = 500;
pub(super) const NOINDEX_FOLLOW: &str = "noindex, follow";

// One row with its relations as JSON text: sqlx is built without its `json`
// feature. Timestamps are written as Postgres writes them into JSON, which
// is the text Next passes on to the structured data.
const MEME_BY_SHORT_ID: &str = "\
select m.id::text as id, m.short_id, m.slug, m.title, m.summary, m.description, m.origin, \
       m.usage_note, m.caution, m.usage_examples::text as usage_examples, \
       m.category::text as category, m.origin_year, m.year_precision, \
       m.safety_level::text as safety_level, m.lifecycle_status::text as lifecycle_status, \
       m.moderation_status::text as moderation_status, m.doc_class, m.origin_kind, \
       to_json(m.published_at) #>> '{}' as published_at, \
       to_json(m.updated_at) #>> '{}' as updated_at, \
       floor(extract(epoch from m.updated_at) * 1000)::bigint as updated_ms, \
       m.sentiment::text as sentiment, m.usage_context::text as usage_context, \
       to_json(m.safety_reviewed_at) #>> '{}' as safety_reviewed_at, \
       to_json(m.content_reviewed_at) #>> '{}' as content_reviewed_at, \
       (select coalesce(json_agg(json_build_object('source_url', s.source_url, 'title', s.title, \
               'hidden_from_public', s.hidden_from_public, 'platform', s.platform, \
               'creator_name', s.creator_name, 'captured_at', s.captured_at)), '[]'::json)::text \
          from public.meme_sources s where s.meme_id = m.id) as sources, \
       (select coalesce(json_agg(json_build_object('tag_id', t.tag_id, \
               'name', (select g.name from public.tags g where g.id = t.tag_id))), '[]'::json)::text \
          from public.meme_tags_map t where t.meme_id = m.id) as tags, \
       (select coalesce(json_agg(json_build_object('availability', c.availability, \
               'moderation_status', c.moderation_status)), '[]'::json)::text \
          from public.meme_contents c where c.meme_id = m.id) as contents, \
       (select count(*) from public.meme_tags_map t where t.meme_id = m.id) as tag_count, \
       exists (select 1 from public.meme_translations tr \
                where tr.meme_id = m.id and tr.status = 'reviewed') as has_reviewed_translation \
  from public.memes m \
 where m.short_id = $1 and m.moderation_status in ('approved', 'limited') \
 limit 1";

/// A public row of `memes` with the relations the document reads.
pub struct MemeDocument {
    pub id: String,
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub description: String,
    pub origin: String,
    pub usage_note: Option<String>,
    pub caution: Option<String>,
    pub usage_examples: Value,
    pub category: String,
    pub origin_year: Option<i32>,
    pub year_precision: String,
    pub safety_level: String,
    pub lifecycle_status: String,
    pub moderation_status: String,
    pub doc_class: String,
    pub origin_kind: String,
    pub published_at: Option<String>,
    pub updated_at: Option<String>,
    /// `updated_at` in milliseconds since the epoch: the `?v` of the share card.
    pub updated_ms: i64,
    pub sources: Vec<SourceRow>,
    pub contents: Vec<ContentRow>,
    pub tag_count: usize,
    pub has_reviewed_translation: bool,
    pub sentiment: String,
    pub usage_context: Value,
    pub safety_reviewed_at: Option<String>,
    pub content_reviewed_at: Option<String>,
    /// `meme_tags_map(tag_id, tags(name))`, in the order Postgres returns them.
    pub tags: Vec<Tag>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct Tag {
    pub tag_id: String,
    pub name: Option<String>,
}

impl MemeDocument {
    pub fn category_label(&self) -> Option<&'static str> {
        labels::category_label(&self.category)
    }

    /// `memePathFrom(short_id, slug)`.
    pub fn path(&self) -> String {
        meme_path(&self.short_id, &self.slug)
    }

    pub fn depth(&self) -> ContentDepth {
        content_depth(&DepthInput {
            description: &self.description,
            origin: &self.origin,
            usage_note: self.usage_note.as_deref(),
            caution: self.caution.as_deref(),
            usage_examples: &self.usage_examples,
            sources: &self.sources,
            contents: &self.contents,
            tag_count: self.tag_count,
        })
    }

    /// Whether this port renders the same document Next does. Media needs
    /// the embed players and the reviewed-media policy: not ported yet.
    fn is_ported(&self) -> bool {
        self.contents.is_empty() && self.category_label().is_some()
    }

    /// `isHouseOriginal(origin_kind)`: made by 밈캐치 itself.
    pub fn is_house_original(&self) -> bool {
        self.origin_kind == "house_original"
    }

    /// `isAdsenseContentEligible`: approved, a title and a summary that
    /// differ, substantial prose and at least one source.
    fn may_carry_ads(&self, depth: &ContentDepth) -> bool {
        let title = js::trim(&self.title);
        let summary = js::trim(&self.summary);
        self.moderation_status == "approved"
            && !title.is_empty()
            && !summary.is_empty()
            && title.to_lowercase() != summary.to_lowercase()
            && depth.is_substantial()
            && depth.source_count > 0
    }
}

/// One entry of `usage_examples` after `parseUsageExamples`.
#[derive(Debug, PartialEq, Eq)]
pub struct UsageExample {
    pub situation: String,
    pub text: String,
    pub dialogue: Vec<DialogueLine>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct DialogueLine {
    pub speaker: String,
    pub line: String,
}

/// The link the media slot offers when there is nothing to play.
pub struct Fallback<'a> {
    pub source_url: Option<&'a str>,
    /// The link is a wiki that explains the context, not the original.
    pub context_source: bool,
}

/// A short id that only redirects to another meme. The sitemap, and so the
/// count on `/about`, leaves these out.
pub(super) fn is_canonical_alias(short_id: &str) -> bool {
    CANONICAL_ALIASES
        .iter()
        .any(|(alias, _)| *alias == short_id)
}

/// `shortIdFromParam`: what precedes the first `-` of the decoded key.
fn short_id_from_param(key: &str) -> String {
    let decoded = decode_uri_component(key);
    let key = decoded.as_deref().unwrap_or(key);
    key.split('-').next().unwrap_or_default().to_owned()
}

/// `canonicalMemeRedirectPath(key, { shortId, slug, locale: "ko" })`: the
/// canonical path, unless `key` already is its last segment, encoded or
/// decoded. The stored slug is normalized (NFC) before it is encoded.
fn canonical_redirect_path(key: &str, short_id: &str, slug: &str) -> Option<String> {
    let slug: String = slug.nfc().collect();
    let encoded_key = format!("{short_id}-{}", js::encode_uri_component(&slug));
    let decoded_key = format!("{short_id}-{slug}");
    (key != encoded_key && key != decoded_key).then(|| format!("/memes/{encoded_key}"))
}

/// `parseUsageExamples` in lib/usage-examples.ts.
pub fn parse_usage_examples(value: &Value) -> Vec<UsageExample> {
    let Some(items) = value.as_array() else {
        return Vec::new();
    };
    let string = |object: &serde_json::Map<String, Value>, name: &str| {
        object.get(name).and_then(Value::as_str).map(str::to_owned)
    };
    items
        .iter()
        .filter_map(|item| {
            let object = item.as_object()?;
            let situation = string(object, "situation")?;
            if js::trim(&situation).is_empty() || js::utf16_len(&situation) > MAX_SITUATION_LENGTH {
                return None;
            }
            let dialogue: Vec<DialogueLine> = object
                .get("dialogue")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|line| {
                    let line = line.as_object()?;
                    let speaker = js::trim(&string(line, "speaker").unwrap_or_default()).to_owned();
                    let text = js::trim(&string(line, "line").unwrap_or_default()).to_owned();
                    (!speaker.is_empty()
                        && !text.is_empty()
                        && js::utf16_len(&text) <= MAX_EXAMPLE_TEXT_LENGTH)
                        .then_some(DialogueLine {
                            speaker,
                            line: text,
                        })
                })
                .collect();
            let mut text = js::trim(&string(object, "text").unwrap_or_default()).to_owned();
            if text.is_empty() && !dialogue.is_empty() {
                // The line of "나" or of a speaker named "사용자", else the last line.
                text = dialogue
                    .iter()
                    .find(|line| line.speaker == "나" || line.speaker.contains("사용자"))
                    .or(dialogue.last())
                    .map(|line| line.line.clone())
                    .unwrap_or_default();
            }
            if text.is_empty() || js::utf16_len(&text) > MAX_EXAMPLE_TEXT_LENGTH {
                return None;
            }
            Some(UsageExample {
                situation: js::trim(&situation).to_owned(),
                text,
                dialogue,
            })
        })
        .take(MAX_USAGE_EXAMPLES)
        .collect()
}

/// `preferredSourceUrl(sourceLinksWithContent(sources, []))`: the first
/// public link that is not a wiki, else the first public link.
fn preferred_source_url(sources: &[SourceRow]) -> Option<String> {
    let urls: Vec<String> = sources
        .iter()
        .filter(|source| is_public_display_source(source))
        .filter_map(|source| public_source_url(source.source_url.as_deref()))
        .collect();
    urls.iter()
        .find(|url| !is_context_source_url(url))
        .or(urls.first())
        .cloned()
}

fn json_rows<T: for<'de> Deserialize<'de>>(text: &str) -> Result<Vec<T>, sqlx::Error> {
    serde_json::from_str(text).map_err(|error| sqlx::Error::Decode(Box::new(error)))
}

async fn load(db: &Db, short_id: String) -> Result<Option<MemeDocument>, sqlx::Error> {
    // As the anonymous visitor (`createStaticClient`): row-level security
    // decides which sources and contents a reader may see.
    let row = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(MEME_BY_SHORT_ID)
                    .bind(short_id)
                    .fetch_optional(tx)
                    .await
            })
        })
        .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let usage_examples: Option<String> = row.try_get("usage_examples")?;
    let tag_count: i64 = row.try_get("tag_count")?;
    Ok(Some(MemeDocument {
        id: row.try_get("id")?,
        short_id: row.try_get("short_id")?,
        slug: row.try_get("slug")?,
        title: row.try_get("title")?,
        summary: row.try_get("summary")?,
        description: row.try_get("description")?,
        origin: row.try_get("origin")?,
        usage_note: row.try_get("usage_note")?,
        caution: row.try_get("caution")?,
        usage_examples: usage_examples
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(Value::Null),
        category: row.try_get("category")?,
        origin_year: row.try_get("origin_year")?,
        year_precision: row.try_get("year_precision")?,
        safety_level: row.try_get("safety_level")?,
        lifecycle_status: row.try_get("lifecycle_status")?,
        moderation_status: row.try_get("moderation_status")?,
        doc_class: row.try_get("doc_class")?,
        origin_kind: row.try_get("origin_kind")?,
        published_at: row.try_get("published_at")?,
        updated_at: row.try_get("updated_at")?,
        updated_ms: row.try_get("updated_ms")?,
        sources: json_rows(row.try_get("sources")?)?,
        contents: json_rows(row.try_get("contents")?)?,
        tag_count: usize::try_from(tag_count).unwrap_or_default(),
        has_reviewed_translation: row.try_get("has_reviewed_translation")?,
        sentiment: row.try_get("sentiment")?,
        usage_context: row
            .try_get::<Option<String>, _>("usage_context")?
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(Value::Null),
        safety_reviewed_at: row.try_get("safety_reviewed_at")?,
        content_reviewed_at: row.try_get("content_reviewed_at")?,
        tags: json_rows(row.try_get("tags")?)?,
    }))
}

/// The 308 `proxy.ts` sends: a relative `Location` with the query kept, the
/// same target in `Refresh`, and the target as the body.
fn permanent_redirect(path: &str, query: Option<&str>) -> Response {
    let target = match query {
        Some(query) => format!("{path}?{query}"),
        None => path.to_owned(),
    };
    let header = |value: String| HeaderValue::from_str(&value).ok();
    let (Some(location), Some(refresh)) =
        (header(target.clone()), header(format!("0;url={target}")))
    else {
        // An encoded path and a query that arrived in a request line are
        // header text; this is unreachable, and a 404 is the safe answer.
        return StatusCode::NOT_FOUND.into_response();
    };
    // Built by hand: a `String` body would add a `Content-Type`, and Next
    // sends none with this redirect.
    let mut response = Response::new(Body::from(target));
    *response.status_mut() = StatusCode::PERMANENT_REDIRECT;
    let headers = response.headers_mut();
    headers.insert(LOCATION, location);
    headers.insert(HeaderName::from_static("refresh"), refresh);
    headers.insert(CONTENT_LANGUAGE, HeaderValue::from_static("ko"));
    response.extensions_mut().insert(AnsweredBeforeRouting);
    response
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    // The key as it was sent: the canonical check compares its encoding.
    let request_path = request.uri().path().to_owned();
    let query = request.uri().query().map(str::to_owned);
    let target = crate::pages::path_and_query(&request).to_owned();
    let key = request_path.strip_prefix("/memes/").unwrap_or_default();

    let requested_short_id = short_id_from_param(key);
    let target_short_id = CANONICAL_ALIASES
        .iter()
        .find(|(alias, _)| *alias == requested_short_id)
        .map_or(requested_short_id.as_str(), |(_, target)| target);
    // `/memes/random` is a route of its own (routes/public/random.rs); it
    // reaches this handler only while that route is switched off.
    if key == "random" {
        return proxy::forward(State(state), request).await;
    }

    let meme = match load(&state.db, target_short_id.to_owned()).await {
        Ok(Some(meme)) => meme,
        // `proxy.ts`: a missing row is a 404 unless the key is one of the
        // editorial memes itself (an alias of one is not), which has its
        // own article at any key.
        Ok(None) => {
            return match curated::find(&requested_short_id) {
                Some(curated) if parts_are_native(&state) => {
                    let site = &state.pages.site;
                    html_response(
                        StatusCode::OK,
                        document::page(site, &curated.head(site), &target, curated.article()),
                    )
                }
                Some(_) => proxy::forward(State(state), request).await,
                None => not_found::response(&state.pages.site, &target),
            };
        }
        Err(error) => {
            tracing::warn!(%error, "meme document read failed, leaving the request to the upstream");
            return proxy::forward(State(state), request).await;
        }
    };
    if let Some(path) = canonical_redirect_path(key, &meme.short_id, &meme.slug) {
        return permanent_redirect(&path, query.as_deref());
    }
    if !meme.is_ported() || !parts_are_native(&state) {
        return proxy::forward(State(state), request).await;
    }
    // `getReviewedMemeMediaSources`: without it Next shows no source at all.
    let lookup_ok = explore_previews::reviewed_media_sources(&state.db, &meme.id)
        .await
        .is_some();
    let public_sources = sources::public_sources(&meme.sources, lookup_ok);
    let right_rail = sections::right_rail(&state, &meme, &public_sources, &request_path).await;
    let versions = if meme.has_reviewed_translation {
        translations::versions(
            &state.db,
            &translations::Original {
                id: &meme.id,
                short_id: &meme.short_id,
                slug: &meme.slug,
                updated_at: meme.updated_at.as_deref(),
                indexable: meme.depth().is_indexable(),
            },
        )
        .await
    } else {
        Vec::new()
    };
    render(
        &state,
        &meme,
        &target,
        &public_sources,
        &versions,
        right_rail,
    )
}

/// `new URLSearchParams(query)` of a path and query as received.
fn query_pairs_of(target: &str) -> Vec<(String, String)> {
    let query = target
        .split_once('?')
        .map(|(_, query)| query)
        .unwrap_or_default();
    url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect()
}

/// Whether every interactive part of the document works without Next's
/// server actions. With the community on, the reaction bar and the comments
/// (their form and report button are actions: `postComment`, `reportContent`)
/// are Next's, so the document is. The contribution form posts to
/// `meme-contribution` while submissions are open; with that route switched
/// off only Next's own action can take it.
fn parts_are_native(state: &AppState) -> bool {
    let config = &state.config;
    !config.community_enabled
        && (!config.submissions_open || !config.disabled_routes.contains("meme-contribution"))
}

/// `target` is the request's path and query, as received.
/// `public_sources` is `delivery.publicSources`, which for a document without
/// media is also `delivery.sourceLinks`.
fn render(
    state: &AppState,
    meme: &MemeDocument,
    target: &str,
    public_sources: &[SourceRow],
    versions: &[translations::Version],
    right_rail: maud::Markup,
) -> Response {
    let site = &state.pages.site;
    let path = meme.path();
    let depth = meme.depth();
    // `detailIndexableFromDiscovery`. Next also asks its discovery index,
    // which holds the ids that pass this same test on rows up to an hour
    // old; the row read for this request is the newer answer.
    let indexable = depth.is_indexable();

    let head = Head {
        title: seo::title(&meme.title, meme.is_house_original()),
        description: Some(seo::description(&seo::DescriptionInput {
            title: &meme.title,
            summary: &meme.summary,
            origin_year: meme.origin_year,
            year_precision: &meme.year_precision,
            safety_level: &meme.safety_level,
            usage_example_count: meme.usage_examples.as_array().map_or(0, Vec::len),
            has_origin: !js::trim(&meme.origin).is_empty(),
            has_caution: meme
                .caution
                .as_deref()
                .is_some_and(|caution| !js::trim(caution).is_empty()),
            house_original: meme.is_house_original(),
        })),
        robots: (!indexable).then_some(NOINDEX_FOLLOW),
        // Korean, the current translations in the order they were read,
        // and `x-default`: the English document when there is one.
        languages: std::iter::once(("ko".to_owned(), path.clone()))
            .chain(
                versions
                    .iter()
                    .map(|version| (version.hreflang.to_owned(), version.path.clone())),
            )
            .chain([(
                "x-default".to_owned(),
                versions
                    .iter()
                    .find(|version| version.hreflang == "en")
                    .map_or_else(|| path.clone(), |version| version.path.clone()),
            )])
            .collect(),
        og_alternates: versions.iter().map(|version| version.open_graph).collect(),
        image: Some(ShareImage {
            // No representative image either, so the version is the row's clock.
            url: site.absolute(&format!(
                "{path}/{SHARE_CARD_SUFFIX}?v={}",
                meme.updated_ms.max(0)
            )),
            mime: None,
            alt: meme.title.clone(),
        }),
        canonical: Some(path.clone()),
        ..Head::default()
    };

    let term = MemeTerm {
        name: &meme.title,
        summary: &meme.summary,
        description: &meme.description,
        path: &path,
        category: &meme.category,
        published_at: meme.published_at.as_deref(),
        updated_at: meme.updated_at.as_deref(),
        sources: public_sources,
    };
    let json_ld = html! {
        // A thin document is noindex; it does not present itself as a
        // finished dictionary entry in structured data either.
        @if indexable {
            (json_ld::meme_web_page(site, &term, OffsetDateTime::now_utc()))
            (json_ld::meme_defined_term(site, &term))
        }
        @if let Some(breadcrumb) = json_ld::meme_breadcrumb(site, &term) {
            (breadcrumb)
        }
    };
    let source_url = preferred_source_url(public_sources);
    let usage_examples = parse_usage_examples(&meme.usage_examples);
    let main = view::main(&view::DetailView {
        meme,
        path: &path,
        depth: &depth,
        fallback: Fallback {
            context_source: source_url.as_deref().is_some_and(is_context_source_url),
            source_url: source_url.as_deref(),
        },
        usage_examples: &usage_examples,
        json_ld,
        // `AdsenseScript`: switched on, and the client is the site's own.
        ads_client: site.ads_client().filter(|_| meme.may_carry_ads(&depth)),
        right_rail,
        context_nav: context_nav::nav(&query_pairs_of(target)),
    });
    html_response(StatusCode::OK, document::page(site, &head, target, main))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn short_id_is_what_precedes_the_first_dash_of_the_decoded_key() {
        assert_eq!(short_id_from_param("wk36uaq4-ai-slop"), "wk36uaq4");
        assert_eq!(short_id_from_param("wk36uaq4"), "wk36uaq4");
        assert_eq!(short_id_from_param("wk36uaq4%2Dai"), "wk36uaq4");
        // A malformed escape: the raw key is split, as in the `catch`.
        assert_eq!(short_id_from_param("ab%zz-x"), "ab%zz");
        assert_eq!(short_id_from_param("%ff-x"), "%ff");
        assert_eq!(short_id_from_param(""), "");
    }

    #[test]
    fn only_the_exact_canonical_key_is_not_redirected() {
        let path = |key: &str| canonical_redirect_path(key, "pgkor003", "중꺾마 정신");
        let canonical = "/memes/pgkor003-%EC%A4%91%EA%BA%BE%EB%A7%88%20%EC%A0%95%EC%8B%A0";

        assert_eq!(
            path("pgkor003-%EC%A4%91%EA%BA%BE%EB%A7%88%20%EC%A0%95%EC%8B%A0"),
            None
        );
        assert_eq!(path("pgkor003-중꺾마 정신"), None);
        // A bare id, a stale slug, lowercase escapes and an escaped dash.
        for key in [
            "pgkor003",
            "pgkor003-old-slug",
            "pgkor003-%ec%a4%91%ea%ba%be%eb%a7%88%20%ec%a0%95%ec%8b%a0",
            "pgkor003%2D%EC%A4%91%EA%BA%BE%EB%A7%88%20%EC%A0%95%EC%8B%A0",
        ] {
            assert_eq!(path(key).as_deref(), Some(canonical), "{key}");
        }
        // A slug stored decomposed (NFD) has one composed canonical path.
        let decomposed: String = "중꺾마 정신".nfd().collect();
        assert_ne!(decomposed, "중꺾마 정신");
        assert_eq!(
            canonical_redirect_path("pgkor003", "pgkor003", &decomposed).as_deref(),
            Some(canonical)
        );
    }

    #[test]
    fn usage_examples_keep_valid_entries_and_at_most_three() {
        let parsed = parse_usage_examples(&json!([
            {"situation": " 회의 ", "text": " 예문 "},
            {"situation": "", "text": "상황 없음"},
            {"situation": "대화", "dialogue": [
                {"speaker": "팀장", "line": "끝났나요?"},
                {"speaker": " 나 ", "line": " 거의요 "},
                {"speaker": "", "line": "말한 사람 없음"}]},
            "문자열",
            {"situation": "셋째", "text": "c"},
            {"situation": "넷째", "text": "d"},
        ]));

        assert_eq!(parsed.len(), 3);
        assert_eq!(
            (parsed[0].situation.as_str(), parsed[0].text.as_str()),
            ("회의", "예문")
        );
        // No text of its own: the line of "나" stands for the example.
        assert_eq!(parsed[1].text, "거의요");
        assert_eq!(parsed[1].dialogue.len(), 2);
        assert_eq!(parsed[2].situation, "셋째");
        assert!(parse_usage_examples(&json!({"situation": "객체"})).is_empty());
        assert!(parse_usage_examples(&Value::Null).is_empty());
    }

    #[test]
    fn the_fallback_link_prefers_an_original_over_a_wiki() {
        let source = |url: &str, hidden: bool| SourceRow {
            source_url: Some(url.to_owned()),
            hidden_from_public: Some(hidden),
            ..SourceRow::default()
        };
        let wiki = source("https://namu.wiki/w/x", false);
        let news = source("https://news.example.org/a", false);
        let hidden = source("https://hidden.example.org/", true);

        assert_eq!(
            preferred_source_url(&[wiki.clone(), news]).as_deref(),
            Some("https://news.example.org/a")
        );
        assert_eq!(
            preferred_source_url(&[hidden, wiki]).as_deref(),
            Some("https://namu.wiki/w/x")
        );
        assert_eq!(preferred_source_url(&[]), None);
    }

    #[test]
    fn a_redirect_keeps_the_query_and_repeats_the_target() {
        let response = permanent_redirect("/memes/abc-x", Some("a=1&b=%ED%95%9C"));
        assert_eq!(response.status(), StatusCode::PERMANENT_REDIRECT);
        assert_eq!(response.headers()[LOCATION], "/memes/abc-x?a=1&b=%ED%95%9C");
        assert_eq!(
            response.headers()["refresh"],
            "0;url=/memes/abc-x?a=1&b=%ED%95%9C"
        );
        assert_eq!(response.headers()["content-language"], "ko");
    }
}
