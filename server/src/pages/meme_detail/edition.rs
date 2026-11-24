//! `GET /{locale}/memes/{key}` for the four editions (en, ja, zh, zh-tw):
//! a meme's reviewed translation (`app/[locale]/memes/[key]/page.tsx`, and
//! the part of `proxy.ts` that runs before it).
//!
//! In the order Next applies them:
//!
//! 1. no public row, or no current, complete, reviewed translation of an
//!    indexable Korean document in that language: 404 with the Korean "no
//!    such meme" document (Korean in every header too);
//! 2. the key is not the canonical one (the translation's slug): 308;
//! 3. otherwise the document. It is indexed when the discovery index lists
//!    the meme (or cannot be read), and links Korean, every other current
//!    translation and `x-default` (English, else Korean).
//!
//! A failed read of the row or its translations stays with Next (its outage
//! page), as the Korean page does. Only a reviewed, current translation is
//! ever served, so the page's notices for machine and stale translations
//! are never drawn.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use time::OffsetDateTime;

use super::translations::{self, Original, Stored, Version};
use super::{
    CANONICAL_ALIASES, MemeDocument, canonical_redirect_path, delivery_links, edition_view, embed,
    load, passport, permanent_redirect_in, related, resolve_delivery, share_version_of,
    short_id_from_param, site_host,
};
use crate::AppState;
use crate::fallback;
use crate::pages::document::{self, Head, ShareImage};
use crate::pages::home::copy as home_copy;
use crate::pages::home::edition::EDITIONS;
use crate::pages::i18n::Locale;
use crate::pages::json_ld::{self, MemeTerm, TermEdition};
use crate::pages::{DYNAMIC_PAGE_CACHE, explore, html_in, not_found, path_and_query};
use crate::routes::public::labels::meme_path;
use crate::routes::public::{explore_previews, js_date, localized};

pub fn paths() -> Vec<String> {
    EDITIONS
        .iter()
        .map(|code| format!("/{code}/memes/{{key}}"))
        .collect()
}

/// The edition and the key of `/{edition}/memes/{key}`.
fn split(path: &str) -> Option<(&'static str, &str)> {
    let rest = path.strip_prefix('/')?;
    let (code, key) = rest.split_once("/memes/")?;
    let code = EDITIONS.into_iter().find(|edition| *edition == code)?;
    (!key.contains('/')).then_some((code, key))
}

/// What the document shows, read and decided.
pub(super) struct EditionDocument<'a> {
    pub code: &'static str,
    pub meme: &'a MemeDocument,
    pub translation: &'a Stored,
    /// `localizedMemePath(locale, short_id, slug)`.
    pub canonical: String,
    /// The current translations, this one among them, as Postgres returns them.
    pub versions: Vec<Version>,
    pub source_links: Vec<crate::pages::content_depth::SourceRow>,
    pub video: Option<embed::MediaContent>,
    pub passport: Markup,
    pub related: Markup,
    pub json_ld: Markup,
}

impl Stored {
    pub(super) fn title(&self) -> &str {
        &self.texts[0]
    }

    pub(super) fn summary(&self) -> &str {
        &self.texts[1]
    }

    pub(super) fn description(&self) -> &str {
        &self.texts[2]
    }

    pub(super) fn origin(&self) -> &str {
        &self.texts[3]
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let request_path = request.uri().path().to_owned();
    let query = request.uri().query().map(str::to_owned);
    let target = path_and_query(&request).to_owned();
    let Some((code, key)) = split(&request_path) else {
        return fallback::answer(State(state), request).await;
    };
    let locale = Locale::get(code).expect("an edition is a locale");
    let language = locale.info().lang.as_str();
    // Next serves the rewritten "no such meme" page as its prerendered Korean
    // file: `Content-Language: ko`, whatever the edition.
    let missing = || not_found::response(&state.pages.site, &target);

    let requested_short_id = short_id_from_param(key);
    let target_short_id = CANONICAL_ALIASES
        .iter()
        .find(|(alias, _)| *alias == requested_short_id)
        .map_or(requested_short_id.as_str(), |(_, target)| target);
    let meme = match load(&state.db, target_short_id.to_owned()).await {
        Ok(Some(meme)) => meme,
        // `proxy.ts`: in an edition even an editorial meme's key is missing.
        Ok(None) => return missing(),
        Err(error) => {
            tracing::warn!(%error, "translated meme read failed, leaving the request to the upstream");
            return fallback::answer(State(state), request).await;
        }
    };
    let rows = match translations::reviewed(&state.db, &meme.id).await {
        Ok(rows) => rows,
        Err(error) => {
            tracing::warn!(%error, "translations read failed, leaving the request to the upstream");
            return fallback::answer(State(state), request).await;
        }
    };
    let original = Original {
        id: &meme.id,
        short_id: &meme.short_id,
        slug: &meme.slug,
        updated_at: meme.updated_at.as_deref(),
        indexable: meme.depth().is_indexable(),
    };
    // `localizedDocumentSlug` (proxy.ts) and `getLocalizedMemeByShortId`.
    let Some(translation) = rows
        .iter()
        .find(|row| row.locale == code)
        .filter(|row| translations::version(&original, row).is_some())
    else {
        return missing();
    };
    let slug = translation.slug(&meme.slug);
    if let Some(path) = canonical_redirect_path(key, &meme.short_id, slug) {
        return permanent_redirect_in(&format!("/{code}{path}"), query.as_deref(), language);
    }
    if !meme.is_ported() {
        return fallback::answer(State(state), request).await;
    }
    let versions: Vec<Version> = rows
        .iter()
        .filter_map(|row| translations::version(&original, row))
        .collect();
    render(&state, code, &meme, translation, slug, versions, &target).await
}

async fn render(
    state: &AppState,
    code: &'static str,
    meme: &MemeDocument,
    translation: &Stored,
    slug: &str,
    versions: Vec<Version>,
    target: &str,
) -> Response {
    let site = &state.pages.site;
    let canonical = format!("/{code}{}", meme_path(&meme.short_id, slug));
    let ledger = explore_previews::reviewed_media_sources(&state.db, &meme.id).await;
    let delivery = resolve_delivery(meme, ledger.as_deref());
    let (_, source_links) = delivery_links(meme, &delivery, ledger.is_some());
    let embeddable: Vec<&embed::MediaContent> = delivery
        .embeddable
        .iter()
        .map(|index| &meme.media[*index])
        .collect();
    let representative = delivery.representative.map(|index| &meme.media[index]);
    let photo = embed::share_photo(
        representative,
        delivery.embedding_allowed,
        ledger.is_some(),
        &site_host(&site.url),
    );

    let discovery = explore::discovery(state).await;
    // `detailIndexableFromDiscovery`: listed, or the index was not read.
    let indexable = discovery
        .as_deref()
        .is_none_or(|ids| ids.contains(&meme.id));
    let (passport, related) = tokio::join!(
        passport::load_in(
            &state.db,
            &meme.id,
            Some(passport::Edition {
                code,
                discovery: discovery.as_deref().map(Vec::as_slice),
            }),
        ),
        related_cards(state, code, meme, discovery.as_deref().map(Vec::as_slice)),
    );

    let seo = &home_copy::copy(code).seo;
    let copy = super::edition_copy::detail(code);
    let edition = versions
        .iter()
        .find(|version| version.code == code)
        .expect("the served translation is current");
    let term = MemeTerm {
        name: translation.title(),
        summary: translation.summary(),
        description: translation.description(),
        path: &canonical,
        category: &meme.category,
        published_at: meme.published_at.as_deref(),
        updated_at: translation.updated_at.as_deref(),
        sources: &source_links,
        edition: Some(TermEdition {
            code,
            in_language: edition.hreflang,
            site_name: &seo.site_name,
            glossary_name: &seo.glossary_name,
            home_name: &copy.home,
            category_name: seo
                .categories
                .get(&meme.category)
                .map_or("", String::as_str),
        }),
    };
    let json_ld = html! {
        @if indexable {
            (json_ld::meme_web_page(site, &term, OffsetDateTime::now_utc()))
            (json_ld::meme_defined_term(site, &term))
        }
        @if let Some(breadcrumb) = json_ld::meme_breadcrumb(site, &term) {
            (breadcrumb)
        }
    };
    let head = head(
        state,
        code,
        meme,
        translation,
        &canonical,
        &versions,
        indexable,
        photo.as_ref(),
    );
    let document = EditionDocument {
        code,
        meme,
        translation,
        canonical: canonical.clone(),
        versions,
        source_links,
        video: embed::main_video(&embeddable),
        passport: passport::section(passport.as_ref(), code),
        related,
        json_ld,
    };
    let locale = Locale::get(code).expect("an edition is a locale");
    html_in(
        StatusCode::OK,
        DYNAMIC_PAGE_CACHE,
        locale.info().lang.as_str(),
        document::page_in(
            site,
            &head,
            target,
            edition_view::article(&document),
            locale,
        ),
    )
}

/// `getRelatedMemes` with the translations of the related memes
/// (`includeEmptySummary`), as `RelatedMemes` in the edition.
async fn related_cards(
    state: &AppState,
    code: &'static str,
    meme: &MemeDocument,
    discovery: Option<&[String]>,
) -> Markup {
    let tag_ids: Vec<String> = meme.tags.iter().map(|tag| tag.tag_id.clone()).collect();
    let current = related::Current {
        id: &meme.id,
        category: &meme.category,
        origin_year: meme.origin_year,
        tag_ids: &tag_ids,
    };
    let related =
        related::related_memes(&state.db, state.config.semantic_search_enabled, &current).await;
    let ids: Vec<&str> = related.iter().map(|card| card.short_id.as_str()).collect();
    let translated = match (ids.is_empty(), discovery) {
        (true, _) => Default::default(),
        (false, Some(discovery)) => localized::search(&state.db, code, &ids, discovery, true)
            .await
            .unwrap_or_default(),
        (false, None) => Default::default(),
    };
    related::similar_in(code, &related, &translated)
}

/// The metadata of `generateMetadata`: the edition's title and description,
/// `noindex, nofollow` when the meme is not indexed, Korean and the current
/// translations with `x-default`, and the translation's share card.
#[allow(clippy::too_many_arguments)]
fn head(
    state: &AppState,
    code: &'static str,
    meme: &MemeDocument,
    translation: &Stored,
    canonical: &str,
    versions: &[Version],
    indexable: bool,
    photo: Option<&(String, Option<String>)>,
) -> Head {
    let site = &state.pages.site;
    let korean = meme.path();
    let x_default = versions
        .iter()
        .find(|version| version.code == "en")
        .map_or_else(|| korean.clone(), |version| version.path.clone());
    let languages = std::iter::once(("ko".to_owned(), korean))
        .chain(
            versions
                .iter()
                .map(|version| (version.hreflang.to_owned(), version.path.clone())),
        )
        .chain([("x-default".to_owned(), x_default)])
        .collect();
    let version = share_version_of(
        &[
            Some(meme.updated_ms),
            translation
                .updated_at
                .as_deref()
                .and_then(js_date::parse_ms),
        ],
        photo,
    );
    let caution = translation
        .caution
        .as_deref()
        .is_some_and(|caution| !crate::routes::public::js::trim(caution).is_empty());
    Head {
        title: super::seo::edition_title(code, translation.title()),
        description: Some(super::seo::edition_description(
            code,
            &super::seo::EditionDescription {
                title: translation.title(),
                summary: translation.summary(),
                origin_year: meme.origin_year,
                safety_level: &meme.safety_level,
                usage_example_count: translation.usage_examples.as_array().map_or(0, Vec::len),
                has_caution: caution,
            },
        )),
        robots: (!indexable).then_some("noindex, nofollow"),
        canonical: Some(canonical.to_owned()),
        languages,
        og_alternates: versions
            .iter()
            .filter(|version| version.code != code)
            .map(|version| version.open_graph)
            .collect(),
        image: Some(ShareImage {
            url: site.absolute(&format!("{canonical}/opengraph-image?v={version}")),
            mime: None,
            alt: translation.title().to_owned(),
        }),
        edition: Some(code),
        ..Head::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_path_names_an_edition_and_one_key() {
        assert_eq!(split("/en/memes/abc-x"), Some(("en", "abc-x")));
        assert_eq!(split("/zh-tw/memes/abc"), Some(("zh-tw", "abc")));
        assert_eq!(split("/ar/memes/abc"), None);
        assert_eq!(split("/en/memes/abc/opengraph-image"), None);
        assert_eq!(split("/memes/abc"), None);
    }
}
