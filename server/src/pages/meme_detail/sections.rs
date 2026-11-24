//! What the right column holds after the origin, in page order, and the
//! reads behind it. Next runs those reads in one `Promise.all`; so does this.

use maud::{Markup, html};

use super::MemeDocument;
use super::related::{self, Current};
use crate::AppState;
use crate::pages::directory;

pub async fn right_rail(state: &AppState, meme: &MemeDocument) -> Markup {
    let tag_ids: Vec<String> = meme.tags.iter().map(|tag| tag.tag_id.clone()).collect();
    let current = Current {
        id: &meme.id,
        category: &meme.category,
        origin_year: meme.origin_year,
        tag_ids: &tag_ids,
    };
    let (related, directory) = tokio::join!(
        related::related_memes(&state.db, state.config.semantic_search_enabled, &current),
        directory::load(&state.pages, &state.db),
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
    }
}
