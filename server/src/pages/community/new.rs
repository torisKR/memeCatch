//! `GET /community/new` (`app/(default)/community/new/page.tsx`): the
//! writing form (`components/community-post-form.tsx`) for a signed-in
//! user; anyone else is sent to `/login?next=/community/new` (307).
//!
//! `assets/pages/community-new.js` runs the form: the draft on this device,
//! the write and preview tabs (`POST /api/community/preview` renders the
//! draft with `crate::markdown`), uploads through `lib/upload.ts`, the meme
//! search (`search_memes` through the planner, as the browser client sends
//! it) and `POST /api/community/post` (`createCommunityPost`). The category
//! chips of the search come from the templates here, so their glyphs are
//! drawn once, by `labels::category_tag`.

use axum::extract::{Request, State};
use axum::response::{IntoResponse, Response};
use maud::{Markup, PreEscaped, html};

use crate::AppState;
use crate::pages::DYNAMIC_PAGE_CACHE;
use crate::pages::account::{error_panel, redirect_307, respond};
use crate::pages::document::{Head, ShareImage};
use crate::pages::labels;
use crate::routes::better_auth::page_user;

const TITLE: &str = "커뮤니티 글쓰기";
const DESCRIPTION: &str = "밈 추천·추억·토론 — 커뮤니티에 새 글을 올려요.";
/// `UPLOAD_ACCEPT_MEDIA` of lib/upload-shared.ts.
const ACCEPT_MEDIA: &str = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";
const CATEGORIES: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];
const TOOLBAR_BUTTON: &str = "relative flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold text-muted transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-2 hover:text-foreground disabled:opacity-50";
const FIELD: &str = "mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-3 text-base placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20";

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    if page_user(&state, request.headers()).await.is_none() {
        return redirect_307("/login?next=/community/new");
    }
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        canonical: Some("/community/new".to_owned()),
        image: Some(ShareImage::site_default(&state.pages.site)),
        alternate_locales: true,
        script: Some("community-new"),
        ..Head::default()
    };
    let markup = html! {
        (main())
        @for category in CATEGORIES {
            @if let Some(tag) = labels::category_tag(category, "") {
                template data-category-tag=(category) { (tag) }
            }
        }
        template data-action-error { (error_panel()) }
    };
    respond(&state, &request, DYNAMIC_PAGE_CACHE, head, markup).into_response()
}

const BOLD: &str = r#"<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"></path>"#;
const LINK: &str = r#"<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"></path>"#;
const MEDIA: &str = r#"<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="8.5" cy="10" r="1.5"></circle><path d="m21 15-4.5-4.5L9 18"></path>"#;

fn main() -> Markup {
    let tab = |pressed: bool, label: &str, name: &str| {
        html! {
            button type="button" aria-pressed=(pressed) class=(format!("{TOOLBAR_BUTTON} {}", if pressed { "bg-surface-2 text-foreground shadow-[inset_0_-2px_0_0_var(--signal-cyan)]" } else { "" })) data-post-tab=(name) { (label) }
        }
    };
    let tool = |label: &str, name: &str, width: &str, paths: &'static str| {
        html! {
            button type="button" aria-label=(label) title=(label) class=(TOOLBAR_BUTTON) data-post-tool=(name) {
                svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width=(width) stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" { (PreEscaped(paths)) }
            }
        }
    };
    html! {
        main class="mx-auto w-full max-w-site px-4 py-8" {
            div class="mx-auto w-full max-w-md" {
                h1 class="page-title" { (TITLE) }
                p class="page-lede" { "밈 추천, 추억, 토론 — 뭐든 편하게 써 주세요. 밈을 첨부하면 함께 보여드려요." }
                div class="instrument-grid mt-6 rounded-2xl border border-border bg-surface p-5" {
                    form class="space-y-5" data-post-form {
                        div {
                            label for="post-title" class="text-sm font-semibold" { "제목" }
                            input id="post-title" maxlength="100" placeholder="예) 요즘 이 밈 아직도 쓰는 사람 있나요?" class=(FIELD) value="";
                            p class="mt-1 text-sm text-muted" data-post-title-count { "0/100자 · 2자 이상" }
                        }
                        div {
                            label for="post-body" class="text-sm font-semibold" { "내용" }
                            div class="mt-1.5 overflow-hidden rounded-xl border bg-surface transition-colors focus-within:ring-4 focus-within:ring-accent/20 border-border focus-within:border-accent" data-post-editor {
                                div class="flex items-center gap-0.5 border-b border-border px-2 py-1.5" data-post-toolbar {
                                    (tab(true, "쓰기", "write"))
                                    (tab(false, "미리보기", "preview"))
                                    span class="mx-1 h-4 w-px bg-border" aria-hidden="true" {}
                                    (tool("굵게", "bold", "2.5", BOLD))
                                    (tool("링크", "link", "2", LINK))
                                    (tool("이미지·동영상 올리기", "upload", "2", MEDIA))
                                }
                                textarea id="post-body" maxlength="5000" rows="10" placeholder="밈 추천, 추억, 토론 — 뭐든 편하게 써 주세요." class="w-full resize-y bg-transparent p-3 text-base placeholder:text-muted focus:outline-none " {}
                            }
                            input type="file" accept=(ACCEPT_MEDIA) multiple hidden data-post-files;
                            p class="mt-1 text-sm text-muted" data-post-body-count { "마크다운 지원 · 이미지/영상을 끌어다 놓거나 붙여넣으면 업로드돼요 · 0/5,000자" }
                        }
                        div {
                            label for="post-origin-url" class="text-sm font-semibold" {
                                "원본 출처 링크 "
                                span class="font-normal text-muted" { "(밈대결 참가용 · 선택)" }
                            }
                            input id="post-origin-url" type="url" inputmode="url" maxlength="500" placeholder="https://www.youtube.com/watch?v=... 또는 TikTok·Instagram·X·Threads" class=(FIELD) value="";
                            p class="mt-1 text-sm text-muted" { "원본 링크를 넣거나 원본이 확인된 밈을 첨부하면 밈대결에 자동으로 올라가요. 뉴스·블로그 링크는 제외돼요." }
                        }
                        fieldset data-post-meme {
                            legend class="text-sm font-semibold" {
                                "밈 첨부 "
                                span class="font-normal text-muted" { "(선택)" }
                            }
                            input placeholder="밈 이름으로 검색해서 첨부해요" aria-label="첨부할 밈 검색" class=(FIELD) value="";
                        }
                        div {
                            button type="submit" disabled class="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50" { "글 올리기" }
                            p class="mt-1.5 text-center text-sm text-muted" { "1시간에 최대 5개까지 쓸 수 있어요." }
                        }
                    }
                }
            }
        }
    }
}
