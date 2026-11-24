//! `GET /news` (`app/(default)/news/page.tsx`): per age group, the memes it
//! votes it knows or uses (`getGenerationHighlights(3)` of lib/queries.ts)
//! and the static briefs of lib/meme-news.ts
//! (`components/news-page-content.tsx`).
//!
//! The copy, the age labels and the briefs are `server/i18n/news.json`,
//! exported from the TypeScript (`scripts/build-i18n.mjs`). The page is
//! Korean: Next renders it in Korean (ISR) and changes the copy in the
//! browser only when the language switch does in place, which changes only
//! the frame here (B0 difference 67).

use std::collections::HashMap;
use std::sync::{Arc, LazyLock};
use std::time::Duration;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use serde::Deserialize;

use super::document::{self, Head, ShareImage};
use super::meme_card::{self, CardMeme, MIN_LISTING};
use super::{html_cached, json_ld, path_and_query};
use crate::AppState;
use crate::db::{Db, DbIdentity, IdentityOptions};

/// `revalidate = 86400`, as Next sends it for the stored page.
const CACHE: &str = "s-maxage=86400, stale-while-revalidate=31449600";
/// How long the highlights are kept (Next: a day, `PLAN.md` B2-1).
pub const HIGHLIGHTS_TTL: Duration = Duration::from_secs(300);
pub const AUDIENCES: [&str; 3] = ["20s", "30s", "40s"];
/// `getGenerationHighlights(3)`.
const PER_GROUP: usize = 3;

#[derive(Deserialize)]
struct Copy {
    #[serde(rename = "newsTitle")]
    title: String,
    #[serde(rename = "newsDescription")]
    description: String,
    #[serde(rename = "newsIntro")]
    intro: String,
    #[serde(rename = "ageNav")]
    age_nav: String,
    briefing: String,
    efficient: String,
    #[serde(rename = "exploreAll")]
    explore_all: String,
    known: String,
    #[serde(rename = "voteInfo")]
    vote_info: String,
    /// With `{count}` where the number goes.
    votes: String,
    money: String,
    safety: String,
    culture: String,
    verified: String,
    source: String,
}

#[derive(Deserialize)]
struct Brief {
    audience: String,
    title: String,
    summary: String,
    checklist: Vec<String>,
    #[serde(rename = "sourceName")]
    source_name: String,
    #[serde(rename = "sourceUrl")]
    source_url: String,
    #[serde(rename = "verifiedAt")]
    verified_at: String,
    tone: String,
}

#[derive(Deserialize)]
struct News {
    copy: Copy,
    audiences: HashMap<String, String>,
    briefs: Vec<Brief>,
}

static NEWS: LazyLock<News> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../i18n/news.json")).expect("news.json")
});

/// `GenerationHighlight`: a meme and its know and use votes in one group.
#[derive(Clone)]
pub struct Highlight {
    meme: CardMeme,
    votes: i64,
}

/// The highlights of each group, in `AUDIENCES` order.
pub type Highlights = Arc<Vec<Vec<Highlight>>>;

const STATS_SQL: &str = "select age_group, cnt, meme_id::text from public.generation_vote_stats \
     where age_group = any($1::text[]) and vote = any($2::text[])";

/// `getGenerationHighlights(3)`. A failed read is the empty answer Next
/// renders too, but it is not kept.
pub async fn load(db: &Db) -> Result<Highlights, sqlx::Error> {
    let stats: Vec<(Option<String>, Option<i32>, Option<String>)> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(STATS_SQL)
                    .bind(AUDIENCES.map(str::to_owned).to_vec())
                    .bind(vec!["know".to_owned(), "use".to_owned()])
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    // Scores by group and meme, in the order the rows came (a Map in Next).
    let mut scores: Vec<(String, String, i64)> = Vec::new();
    let mut ids: Vec<String> = Vec::new();
    for (group, count, meme) in &stats {
        let (Some(group), Some(meme)) = (group, meme) else {
            continue;
        };
        if !ids.contains(meme) {
            ids.push(meme.clone());
        }
        let count = i64::from(count.unwrap_or(0));
        match scores.iter_mut().find(|(g, m, _)| g == group && m == meme) {
            Some((_, _, score)) => *score += count,
            None => scores.push((group.clone(), meme.clone(), count)),
        }
    }
    if ids.is_empty() {
        return Ok(Arc::new(vec![Vec::new(); AUDIENCES.len()]));
    }
    // `takeIndexableMemes` over the public memes of those ids.
    let memes = meme_card::indexable(
        db,
        "m.id::text = any(string_to_array($1, ',')) and m.moderation_status in ('approved', 'limited')",
        "m.id",
        ids.len(),
        ids.len(),
        vec![ids.join(",")],
    )
    .await?;
    let groups = AUDIENCES
        .iter()
        .map(|group| {
            let mut items: Vec<Highlight> = scores
                .iter()
                .filter(|(g, _, _)| g == group)
                .filter_map(|(_, meme, votes)| {
                    let meme = memes.iter().find(|card| card.id == *meme)?.clone();
                    Some(Highlight {
                        meme,
                        votes: *votes,
                    })
                })
                .collect();
            // Most votes, then the higher trend; a stable sort keeps the rest.
            items.sort_by(|a, b| {
                b.votes.cmp(&a.votes).then(
                    b.meme
                        .trend_score
                        .unwrap_or(0.0)
                        .total_cmp(&a.meme.trend_score.unwrap_or(0.0)),
                )
            });
            items.truncate(PER_GROUP);
            items
        })
        .collect();
    Ok(Arc::new(groups))
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let highlights = state
        .pages
        .news
        .get_or_load(|| load(&state.db))
        .await
        .inspect_err(|error| tracing::warn!(%error, "news highlights not read"))
        .unwrap_or_else(|_| Arc::new(vec![Vec::new(); AUDIENCES.len()]));
    let site = &state.pages.site;
    let copy = &NEWS.copy;
    let head = Head {
        title: copy.title.clone(),
        description: Some(copy.description.clone()),
        canonical: Some("/news".to_owned()),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    let items: Vec<(String, String)> = AUDIENCES
        .iter()
        .flat_map(|audience| {
            NEWS.briefs
                .iter()
                .filter(move |brief| brief.audience == *audience)
                .map(|brief| (brief.title.clone(), format!("/news#age-{}", brief.audience)))
        })
        .collect();
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-8" data-ads=[site.ads_client()] {
            (json_ld::news(site, &items))
            header class="max-w-3xl" {
                h1 class="page-title" { (copy.title) }
                p class="page-lede" { (copy.intro) }
                nav aria-label=(copy.age_nav) class="mt-5 flex flex-wrap gap-2" {
                    @for audience in AUDIENCES {
                        a href=(format!("#age-{audience}")) class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent" { (label(audience)) }
                    }
                }
            }
            div class="mt-8 space-y-12" {
                @for (audience, highlights) in AUDIENCES.iter().zip(highlights.iter()) {
                    (section(audience, highlights))
                }
            }
        }
    };
    html_cached(
        StatusCode::OK,
        CACHE,
        document::page(site, &head, path_and_query(&request), main),
    )
}

fn label(audience: &str) -> &str {
    NEWS.audiences
        .get(audience)
        .map_or(audience, String::as_str)
}

/// `AudienceSection`.
fn section(audience: &str, highlights: &[Highlight]) -> Markup {
    let copy = &NEWS.copy;
    let name = label(audience);
    html! {
        section id=(format!("age-{audience}")) aria-labelledby=(format!("age-{audience}-title")) class="scroll-mt-20" {
            div class="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3" {
                div {
                    p class="text-sm font-semibold text-accent" { (name) " " (copy.briefing) }
                    h2 id=(format!("age-{audience}-title")) class="mt-1 text-2xl font-extrabold" { (copy.efficient) }
                }
                a class="inline-flex min-h-11 items-center text-sm font-semibold text-muted hover:text-accent" href="/explore" {
                    (copy.explore_all) " " span aria-hidden="true" class="ml-1" { "→" }
                }
            }
            @if highlights.len() >= MIN_LISTING {
                div class="mt-5" {
                    h3 class="text-lg font-bold" { (name) (copy.known) }
                    p class="mt-1 text-sm text-muted" { (copy.vote_info) }
                    // `TrackedBlock`: ui/page.js reports the link followed.
                    div class="mt-4" data-track="generation_news_click" {
                        ul class="grid grid-cols-2 gap-4 sm:grid-cols-3" {
                            @for item in highlights {
                                li {
                                    (meme_card::card(&item.meme, None))
                                    p class="mt-1.5 text-center text-xs text-muted" { (copy.votes.replace("{count}", &item.votes.to_string())) }
                                }
                            }
                        }
                    }
                }
            }
            div class="mt-6 grid gap-4 lg:grid-cols-3" {
                @for brief in NEWS.briefs.iter().filter(|brief| brief.audience == audience) {
                    (brief_card(brief))
                }
            }
        }
    }
}

/// `NewsBriefCard`.
fn brief_card(brief: &Brief) -> Markup {
    let copy = &NEWS.copy;
    let (tone, tone_class) = match brief.tone.as_str() {
        "money" => (&copy.money, "bg-safety-yellow-bg text-safety-yellow"),
        "safety" => (&copy.safety, "bg-safety-green-bg text-safety-green"),
        _ => (&copy.culture, "bg-accent-soft text-accent"),
    };
    html! {
        article class="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm" {
            span class={"w-fit rounded-full px-2.5 py-1 text-xs font-bold " (tone_class)} { (tone) }
            h3 class="mt-3 text-xl font-extrabold leading-snug" { (brief.title) }
            p class="mt-2 text-sm leading-relaxed text-muted" { (brief.summary) }
            ul class="mt-4 flex-1 space-y-2" {
                @for item in &brief.checklist {
                    li class="flex gap-2 text-sm leading-relaxed" {
                        span aria-hidden="true" class="mt-0.5 text-accent" { "✓" }
                        span { (item) }
                    }
                }
            }
            div class="mt-4 border-t border-border pt-3 text-xs text-muted" {
                p class="stat-mono text-signal-cyan" { (copy.verified) " " (brief.verified_at) }
                a href=(brief.source_url) target="_blank" rel="noopener noreferrer" class="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-foreground" {
                    (copy.source) ": " (brief.source_name) " " span aria-hidden="true" class="ml-1" { "↗" }
                }
            }
        }
    }
}
