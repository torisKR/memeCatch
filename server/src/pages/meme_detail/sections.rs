//! What the right column holds after the origin, in page order, and the
//! reads behind it. Next runs those reads in one `Promise.all`; so does this.

use maud::{Markup, html};

use time::OffsetDateTime;

use super::MemeDocument;
use super::related::{self, Current};
use super::sources;
use crate::AppState;
use crate::pages::content_depth::SourceRow;
use crate::pages::directory;

/// `public_sources` is `delivery.publicSources` (and, without media, its
/// `sourceLinks`).
pub async fn right_rail(
    state: &AppState,
    meme: &MemeDocument,
    public_sources: &[SourceRow],
) -> Markup {
    let tag_ids: Vec<String> = meme.tags.iter().map(|tag| tag.tag_id.clone()).collect();
    let current = Current {
        id: &meme.id,
        category: &meme.category,
        origin_year: meme.origin_year,
        tag_ids: &tag_ids,
    };
    let (related, directory, contributors) = tokio::join!(
        related::related_memes(&state.db, state.config.semantic_search_enabled, &current),
        directory::load(&state.pages, &state.db),
        sources::contributors(&state.db, &meme.id),
    );
    let indexable = directory.as_ref().map(|catalog| &catalog.indexable_ids);
    let similar = related::continue_stream(&state.db, &current, &related, indexable).await;
    // Only the indexable documents of the directory are linked; without it,
    // no links.
    let (same_category, same_year) = directory
        .as_deref()
        .map(|catalog| related::neighbours(catalog, &current, &related))
        .unwrap_or_default();
    // The page keeps both wrappers when a section is empty.
    html! {
        div data-detail-order="related" { (related::similar(&similar)) }
        div data-detail-order="neighbours" {
            (related::neighbour_links(&current, &same_category, &same_year))
        }
        (sources::panel(&sources::Panel {
            meme,
            source_links: public_sources,
            public_sources,
            tag_names: &sources::tag_names(meme),
            contributors: &contributors,
            submissions_open: state.config.submissions_open,
            now: OffsetDateTime::now_utc(),
        }))
    }
}
