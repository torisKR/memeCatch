//! `GET /timeline` (`app/(default)/timeline/page.tsx`): the Korean meme
//! timeline, decade by decade and year by year, up to eight indexable memes a
//! year (components/timeline-view.tsx).
//!
//! As on Next, the document carries the first four year rows; the others
//! are mounted by `ui/timeline.js` as the reader scrolls (the infinite
//! scroll), opens a decade's tab or arrives on `#decade-…`. Here they wait in
//! `<template>`s; Next keeps them in its React payload.

use std::sync::Arc;
use std::time::Duration;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};

use super::document::{self, Head, ShareImage};
use super::meme_card::{self, CardMeme, MIN_LISTING};
use super::{html, json_ld, path_and_query};
use crate::AppState;
use crate::db::Db;

const TITLE: &str = "한국 밈 연표 — 1990년대부터 지금까지";
const SCHEMA_DESCRIPTION: &str =
    "1990년대부터 2020년대까지, 연도별 대표 밈을 한눈에 모은 한국 밈 연표.";
/// `MAX_PER_YEAR`.
const MAX_PER_YEAR: usize = 8;
/// `CANDIDATE_LIMIT`: the most trending rows the timeline is drawn from.
const CANDIDATES: usize = 2500;
/// `INITIAL_ROWS`: year rows in the document.
const INITIAL_ROWS: usize = 4;
const DECADES: [(&str, &str, i32, i32); 4] = [
    ("1990s", "1990년대", 1990, 1999),
    ("2000s", "2000년대", 2000, 2009),
    ("2010s", "2010년대", 2010, 2019),
    ("2020s", "2020년대", 2020, 2029),
];
// `cacheCatalogRead` keeps a success for an hour and drops it on a catalog
// edit, which this process does not hear about: it reads again sooner.
pub const TIMELINE_TTL: Duration = Duration::from_secs(300);

pub struct Decade {
    key: &'static str,
    label: &'static str,
    years: Vec<(i32, Vec<CardMeme>)>,
}

pub type Timeline = Arc<Vec<Decade>>;

/// `readTimeline`.
async fn read(db: &Db) -> Result<Timeline, sqlx::Error> {
    let rows = meme_card::indexable(
        db,
        "m.moderation_status in ('approved', 'limited') and m.origin_year is not null",
        "m.trend_score desc",
        CANDIDATES,
        CANDIDATES,
        Vec::new(),
    )
    .await?;
    // Years in the order the rows first name them, each with its first eight.
    let mut by_year: Vec<(i32, Vec<CardMeme>)> = Vec::new();
    for meme in rows {
        let Some(year) = meme.origin_year else {
            continue;
        };
        match by_year.iter_mut().find(|(y, _)| *y == year) {
            Some((_, bucket)) if bucket.len() < MAX_PER_YEAR => bucket.push(meme),
            Some(_) => {}
            None => by_year.push((year, vec![meme])),
        }
    }
    let mut decades = Vec::new();
    for (key, label, from, to) in DECADES {
        let mut years: Vec<(i32, Vec<CardMeme>)> = by_year
            .iter()
            .filter(|(year, memes)| (from..=to).contains(year) && memes.len() >= MIN_LISTING)
            .cloned()
            .collect();
        years.sort_by_key(|(year, _)| *year);
        if !years.is_empty() {
            decades.push(Decade { key, label, years });
        }
    }
    Ok(Arc::new(decades))
}

/// `loadTimeline`: a failed read is an empty timeline for this request.
async fn load(state: &AppState) -> Timeline {
    state
        .pages
        .timeline
        .get_or_load(|| read(&state.db))
        .await
        .inspect_err(|error| tracing::warn!(%error, "timeline failed"))
        .unwrap_or_default()
}

fn trend(meme: &CardMeme) -> f64 {
    meme.trend_score.unwrap_or(0.0)
}

/// The memes of `decades`, most trending first; a tie keeps timeline order.
fn by_trend<'a>(memes: impl Iterator<Item = &'a CardMeme>) -> Vec<&'a CardMeme> {
    let mut memes: Vec<&CardMeme> = memes.collect();
    memes.sort_by(|a, b| trend(b).total_cmp(&trend(a)));
    memes
}

/// `generateMetadata`: the top meme of each decade in the description.
fn description(decades: &[Decade]) -> String {
    let highlights: Vec<String> = decades
        .iter()
        .filter_map(|decade| {
            let top = by_trend(decade.years.iter().flat_map(|(_, memes)| memes))
                .into_iter()
                .next()?;
            Some(format!("{} {}", decade.label, top.title))
        })
        .collect();
    if highlights.is_empty() {
        "1990년대 유행어부터 2020년대 숏폼 챌린지까지, 연도별 대표 밈으로 정리한 한국 밈 연표."
            .to_owned()
    } else {
        format!(
            "{}까지 — 연도별 대표 밈으로 정리한 한국 밈 연표.",
            highlights.join(", ")
        )
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let decades = load(&state).await;
    let site = &state.pages.site;
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(description(&decades)),
        canonical: Some("/timeline".to_owned()),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    let schema: Vec<(String, String)> = by_trend(
        decades
            .iter()
            .flat_map(|d| d.years.iter().flat_map(|(_, memes)| memes)),
    )
    .into_iter()
    .take(10)
    .map(|meme| (meme.title.clone(), meme.path()))
    .collect();
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-8" data-ads=[site.ads_client()] {
            @if !schema.is_empty() {
                (json_ld::collection_page(site, "한국 밈 연표", Some(SCHEMA_DESCRIPTION), "/timeline", schema.len(), 0, &schema))
            }
            div {
                h1 class="page-title" { "한국 밈 연표" }
                p class="page-lede" { "한국 밈의 역사는 1990년대 개그 프로그램 유행어에서 시작해, 2000년대 디시인사이드 짤방과 싸이월드 감성을 거쳐, 2010년대 급식체와 인터넷 방송 밈으로 확장됐고, 2020년대 들어서는 숏폼 챌린지가 중심이 됐어요. 이 페이지는 연도별 대표 밈을 모아, 각 시대를 상징하는 유행어와 챌린지가 언제 등장해 어떻게 이어져 왔는지 한눈에 보여줘요." }
            }
            @if decades.is_empty() {
                div class="mt-8 rounded-2xl border border-border bg-surface p-8 text-center" {
                    p class="text-lg font-bold" { "연표를 불러오지 못했어요" }
                    p class="mt-1.5 text-base text-muted" { "잠시 후 새로고침해 주세요. 그동안 연대별 밈은 탐색에서 볼 수 있어요." }
                }
            } @else {
                (view(&decades))
            }
        }
    };
    let document = document::page(site, &head, path_and_query(&request), main);
    html(StatusCode::OK, document)
}

/// `TimelineView` with its first rows shown and the rest as templates.
fn view(decades: &[Decade]) -> Markup {
    let total: usize = decades.iter().map(|decade| decade.years.len()).sum();
    let starts: Vec<usize> = decades
        .iter()
        .scan(0, |start, decade| {
            let this = *start;
            *start += decade.years.len();
            Some(this)
        })
        .collect();
    html! {
        div data-timeline data-initial=(INITIAL_ROWS.min(total)) data-total=(total) {
            @if decades.len() > 1 {
                nav aria-label="연대 바로가기" class="sticky top-14 z-[5] -mx-4 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden" {
                    @for decade in decades {
                        a class="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent" href=(format!("#decade-{}", decade.key)) data-decade-tab=(decade.key) { (decade.label) }
                    }
                }
            }
            div class="mt-8 space-y-12" {
                @for (decade, start) in decades.iter().zip(&starts) {
                    @let visible = INITIAL_ROWS.saturating_sub(*start).min(decade.years.len());
                    @if visible == 0 {
                        template data-section=(decade.key) data-start=(start) { (section(decade, 0)) }
                    } @else {
                        (section(decade, visible))
                    }
                }
            }
            @if total > INITIAL_ROWS {
                div aria-hidden="true" class="h-px" data-timeline-sentinel {}
            }
        }
    }
}

fn section(decade: &Decade, visible: usize) -> Markup {
    let id = format!("decade-{}", decade.key);
    html! {
        // `Reveal` does not pass `aria-labelledby` on, so Next's section has none.
        section data-decade=(decade.key) {
            h2 id=(id) class="scroll-mt-24 text-2xl font-extrabold tracking-tight" { (decade.label) }
            div class="mt-5 space-y-7" {
                @for (index, (year, memes)) in decade.years.iter().enumerate() {
                    @if index < visible {
                        div { (year_row(decade.key, *year, memes)) }
                    } @else {
                        template data-row { div { (year_row(decade.key, *year, memes)) } }
                    }
                }
            }
        }
    }
}

fn year_row(decade: &str, year: i32, memes: &[CardMeme]) -> Markup {
    html! {
        div class="relative flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-5 lg:gap-6" {
            span aria-hidden="true" class="absolute inset-y-0 left-0 hidden w-px bg-gradient-to-b from-(--flame-500) to-transparent sm:block" {}
            div class="flex shrink-0 items-center gap-2 sm:w-20 sm:flex-col sm:items-start sm:gap-0 sm:pt-1.5 lg:w-24" {
                span class="flex items-center gap-1.5" {
                    span aria-hidden="true" class="signal-live size-1.5 shrink-0 rounded-full bg-(--flame-500)" {}
                    span class="stat-mono whitespace-nowrap text-xl font-extrabold tracking-tight text-accent sm:text-2xl" { (year) }
                }
                span aria-hidden="true" class="h-px flex-1 bg-border sm:hidden" {}
            }
            div class="grid min-w-0 flex-1 grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6" {
                @for meme in memes {
                    div class="min-w-0" data-timeline-card=(meme.id) data-year=(year) data-decade=(decade) {
                        (meme_card::card(meme, None))
                    }
                }
            }
        }
    }
}
