//! What the right column holds after the origin, in page order, and the
//! reads behind it. Next runs those reads in one `Promise.all`; so does this.

use maud::{Markup, html};

use time::OffsetDateTime;

use super::MemeDocument;
use super::related::{self, Current};
use super::{passport, sources};
use crate::AppState;
use crate::pages::content_depth::SourceRow;
use crate::pages::directory;
use crate::routes::public::js;

/// `public_sources` is `delivery.publicSources` (and, without media, its
/// `sourceLinks`).
pub async fn right_rail(
    state: &AppState,
    meme: &MemeDocument,
    public_sources: &[SourceRow],
    pathname: &str,
) -> Markup {
    let tag_ids: Vec<String> = meme.tags.iter().map(|tag| tag.tag_id.clone()).collect();
    let current = Current {
        id: &meme.id,
        category: &meme.category,
        origin_year: meme.origin_year,
        tag_ids: &tag_ids,
    };
    let (related, directory, contributors, passport) = tokio::join!(
        related::related_memes(&state.db, state.config.semantic_search_enabled, &current),
        directory::load(&state.pages, &state.db),
        sources::contributors(&state.db, &meme.id),
        passport::load(&state.db, &meme.id),
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
        (auth_invite(pathname))
        (passport::section(passport.as_ref()))
        (sources::evidence(meme, public_sources, OffsetDateTime::now_utc()))
    }
}

/// `components/auth-invite.tsx` as the server renders it: invisible, holding
/// its place until `ui/invite.js` knows the session. A guest then sees the
/// card; a member, nothing. `pathname` is the request path as received
/// (`usePathname()`), which the links encode once more.
fn auth_invite(pathname: &str) -> Markup {
    let next = js::encode_uri_component(pathname);
    html! {
        div data-auth-invite="pending" class="invisible pointer-events-none select-none" {
            aside aria-label="로그인 안내" aria-hidden="true" class="overflow-hidden rounded-2xl border border-accent/25 bg-accent-soft/50" {
                div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" {
                    div class="flex items-start gap-3" {
                        span aria-hidden="true" class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent" {
                            svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true" {
                                path d="M12 2l1.9 5.9a2 2 0 0 0 1.27 1.27L21 11l-5.83 1.9a2 2 0 0 0-1.27 1.27L12 20l-1.9-5.83a2 2 0 0 0-1.27-1.27L3 11l5.83-1.83A2 2 0 0 0 10.1 7.9L12 2Z" {}
                            }
                        }
                        div class="min-w-0" {
                            p class="text-base font-bold" { "로그인하면 밈캐치를 200% 즐길 수 있어요" }
                            p class="mt-1 text-sm leading-relaxed text-muted" { "마음에 드는 밈을 저장하고, 직접 제보하고, 매일 새로운 밈을 놓치지 마세요. 가입은 무료예요." }
                        }
                    }
                    div class="flex shrink-0 gap-2" {
                        a tabindex="-1" class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent sm:flex-none" href=(format!("/login?next={next}")) { "로그인" }
                        a tabindex="-1" class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-none" href=(format!("/login?tab=signup&next={next}")) { "회원가입" }
                    }
                }
            }
        }
    }
}
