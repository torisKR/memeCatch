//! `GET /originals` (`app/(default)/originals/page.tsx`): the list of the
//! site's own illustrated memes. The editions are `lib/editorial-originals.ts`
//! itself, exported to `i18n/originals.json` by `scripts/build-i18n.mjs`.

use std::sync::LazyLock;

use axum::extract::{Request, State};
use axum::response::Response;
use maud::html;
use serde::Deserialize;

use super::{korean_share, respond};
use crate::AppState;

const ORIGINALS_JSON: &str = include_str!("../../../i18n/originals.json");
const TITLE: &str = "오리지널 밈";
const DESCRIPTION: &str = "밈캐치가 직접 만든 일러스트와 이야기.";

/// `EditorialOriginal`, the fields the list shows.
#[derive(Deserialize)]
pub struct Edition {
    pub slug: String,
    pub title: String,
    pub summary: String,
}

pub static EDITIONS: LazyLock<Vec<Edition>> =
    LazyLock::new(|| serde_json::from_str(ORIGINALS_JSON).expect("i18n/originals.json parses"));

/// `editorialOriginalPath(slug)`.
pub fn edition_path(slug: &str) -> String {
    format!("/originals/edition/{slug}")
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let head = korean_share(&state.pages.site, TITLE, DESCRIPTION, "/originals", true);
    let main = html! {
        main class="mx-auto w-full max-w-3xl bg-[#f3f2ed] px-4 py-12 text-[#18181a]" {
            p class="text-sm font-bold tracking-wide text-[#a52b13]" { "MEMECATCH ORIGINALS" }
            h1 class="mt-3 text-4xl font-black tracking-tight text-balance [word-break:keep-all]" { "우리가 직접 만든 밈을 한곳에서" }
            ul class="mt-8 grid gap-3" {
                @for edition in EDITIONS.iter() {
                    li {
                        a class="block rounded-2xl border border-[#18181a] bg-[#fffaf4] p-4 text-base leading-7" href=(edition_path(&edition.slug)) {
                            span class="block font-black" { (edition.title) }
                            span class="mt-1 block" { (edition.summary) }
                        }
                    }
                }
            }
        }
    };
    respond(&state, &request, head, main)
}
