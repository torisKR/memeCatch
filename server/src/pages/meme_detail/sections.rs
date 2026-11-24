//! What the right column holds after the origin, in page order, and the
//! reads behind it. Next runs those reads in one `Promise.all`; so does this.

use maud::{Markup, html};

use time::OffsetDateTime;

use super::MemeDocument;
use super::related::{self, Current};
use super::{appendix, passport, sources};
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
        (appendix::appendix(meme))
        (community_gate())
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

/// `REACTIONS` of lib/labels.ts, in order.
const REACTIONS: [(&str, &str); 6] = [
    ("💡", "이해됨"),
    ("😂", "웃김"),
    ("👀", "이제 알았다"),
    ("🕰️", "이미 늦었다"),
    ("🔥", "아직 살아있다"),
    ("🚨", "쓰면 위험하다"),
];

/// `Comments` while `flags.communityEnabled` is false: `components/community-gate.tsx`
/// with its defaults. With the community on the document is Next's
/// (`mod.rs`), so this is the only form the section takes here.
fn community_gate() -> Markup {
    html! {
        section aria-label="댓글은 곧 열려요" class="instrument-grid rounded-2xl border border-border bg-surface-2 p-6 text-center" {
            svg class="mx-auto h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" {
                path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.7-.3-3.9-.9L3 20l1-4.4A8.5 8.5 0 1 1 21 11.5Z" stroke-linejoin="round" {}
                path d="M8.5 10.5h7M8.5 13.5h4" stroke-linecap="round" {}
            }
            h3 class="mt-3 text-base font-semibold" { "댓글은 곧 열려요" }
            p class="mt-1 text-base text-muted" { "커뮤니티 기능을 차근차근 준비하고 있어요. 열리면 이 자리에서 바로 만나요." }
            div class="mt-4" {
                p class="text-base text-muted" { "지금은 반응 버튼으로 마음을 남길 수 있어요." }
                ul class="mt-2 flex flex-wrap justify-center gap-2" aria-label="반응 종류" {
                    @for (emoji, label) in REACTIONS {
                        li class="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-sm text-muted" {
                            span aria-hidden="true" { (emoji) }
                            (label)
                        }
                    }
                }
            }
        }
    }
}
