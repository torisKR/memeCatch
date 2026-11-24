//! What the frame shows over a page: the navigation progress bar
//! (`components/nav-progress.tsx`), the sign-in dialog of
//! `components/login-gate.tsx`, and the install banner and sheet of
//! `components/pwa-install.tsx`. The last two are in Korean only.
//! The dialogs are templates; `ui/save.js` and `ui/pwa.js` show them.

use maud::{Markup, PreEscaped, html};

use super::{Frame, brand_tile};
use crate::routes::public::js;

const CLOSE: &str = r#"<path d="M6 6l12 12M18 6L6 18"></path>"#;
const KAKAO: &str = r##"<path d="M12 3.5c-4.97 0-9 3.14-9 7.02 0 2.5 1.68 4.69 4.2 5.94-.14.5-.9 3.1-.93 3.31 0 0-.02.15.08.21.1.06.22.01.22.01.28-.04 3.24-2.13 3.76-2.5.53.08 1.09.12 1.67.12 4.97 0 9-3.14 9-7.1 0-3.87-4.03-7.01-9-7.01Z"></path>"##;
const GOOGLE: &str = r##"<path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.34-.17-1.97H12v3.73h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.28Z"></path><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.58A10 10 0 0 0 12 22Z"></path><path fill="#FBBC05" d="M6.42 13.9a6 6 0 0 1 0-3.8V7.52H3.06a10 10 0 0 0 0 8.96l3.36-2.58Z"></path><path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.52l3.36 2.58C7.2 7.74 9.4 5.98 12 5.98Z"></path>"##;
const TIKTOK: &str = r#"<path d="M14.4 3.2c.5 2.5 1.9 4 4.4 4.5v3.1a8.6 8.6 0 0 1-4.4-1.4v6.1a5.8 5.8 0 1 1-5-5.7v3.2a2.7 2.7 0 1 0 1.8 2.5V3.2h3.2Z" fill="currentColor"></path>"#;
const DOWNLOAD: &str = r#"<path d="M12 3v12m0 0 4-4m-4 4-4-4" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round"></path>"#;
const BANNER_CLOSE: &str = r#"<path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"></path>"#;
const SHARE: &str = r#"<path d="M12 3v12m0-12L8 7m4-4 4 4" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" stroke-linecap="round"></path>"#;
const STEP: &str = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent";

fn svg(class: &str, paths: &'static str) -> Markup {
    html! {
        svg class=(class) viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" { (PreEscaped(paths)) }
    }
}

/// `NavProgress`, drawn at 0 % until a navigation starts.
pub fn nav_progress() -> Markup {
    html! {
        div aria-hidden="true" class="nav-progress" data-nav-progress data-visible="false" {
            div class="nav-progress__bar" style="width:0%" { span class="nav-progress__glow" {} }
        }
    }
}

/// `LoginGate` for the page at `frame`'s path. Its title is the message of
/// whatever opened it (`SAVE_COPY.loginGate` for saving).
pub fn login_gate(frame: &Frame) -> Markup {
    let next = js::encode_uri_component(frame.pathname());
    html! {
        template data-login-gate {
            div class="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="login-gate-title" {
                button type="button" aria-label="닫기" data-close class="absolute inset-0 h-full w-full bg-black/50" {}
                div tabindex="-1" data-panel class="relative w-full max-w-md rounded-t-3xl border border-border bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none sm:mx-4 sm:rounded-3xl sm:pb-6" {
                    span aria-hidden="true" class="mx-auto mb-4 block h-1 w-10 rounded-full bg-border sm:hidden" {}
                    button type="button" data-close aria-label="닫기" class="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2" {
                        svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" { (PreEscaped(CLOSE)) }
                    }
                    div class="flex items-center gap-2" {
                        (brand_tile("size-8"))
                        span class="text-base font-extrabold tracking-tight" { "밈캐치" }
                        span aria-hidden="true" class="signal-live size-1.5 shrink-0 rounded-full bg-(--signal-cyan)" {}
                    }
                    h2 id="login-gate-title" class="mt-3 text-xl font-extrabold leading-snug" data-title { "로그인하면 저장할 수 있어요" }
                    p class="mt-1.5 text-muted" { "몇 초면 시작해요. 보던 화면으로 바로 돌아올게요." }
                    div class="mt-5 flex flex-col gap-2.5" {
                        button type="button" data-oauth="kakao" data-label="카카오" class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 text-base font-semibold text-[#191600] transition-transform active:scale-[0.98] disabled:opacity-60" {
                            svg viewBox="0 0 24 24" class="h-5 w-5" fill="#191600" aria-hidden="true" { (PreEscaped(KAKAO)) }
                            "카카오로 시작하기"
                        }
                        button type="button" data-oauth="google" data-label="구글" class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-base font-semibold text-foreground transition-transform active:scale-[0.98] disabled:opacity-60" {
                            svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" { (PreEscaped(GOOGLE)) }
                            "구글로 시작하기"
                        }
                        a href=(format!("/auth/tiktok?next={next}")) class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#111111] px-4 text-base font-semibold text-white transition-transform active:scale-[0.98]" {
                            svg viewBox="0 0 24 24" class="h-5 w-5" aria-hidden="true" { (PreEscaped(TIKTOK)) }
                            "TikTok으로 시작하기"
                        }
                        a href=(format!("/login?next={next}")) class="hover-glow-flame flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-strong px-4 text-base font-bold text-white transition-transform active:scale-[0.98]" { "이메일로 시작하기" }
                    }
                    p role="status" aria-live="polite" data-notice class="mt-2 min-h-5 text-center text-sm text-muted" {}
                }
            }
        }
    }
}

/// `PwaInstall`: the banner and the iPhone instructions.
pub fn install_prompt() -> Markup {
    html! {
        template data-pwa-banner {
            div role="region" data-pwa-install-banner aria-label="앱 설치 안내" class="fixed inset-x-0 bottom-16 z-50 px-4 md:bottom-4" style="padding-bottom:env(safe-area-inset-bottom)" {
                div class="glass-panel hover-glow-flame mx-auto flex max-w-lg items-center gap-3 rounded-2xl p-3 shadow-lg" {
                    span aria-hidden="true" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent" { (svg("h-6 w-6", DOWNLOAD)) }
                    p class="min-w-0 flex-1 text-base leading-snug" {
                        strong class="font-semibold" { "밈캐치를 홈 화면에" }
                        br;
                        span class="text-muted" { "앱처럼 빠르게 열어보세요" }
                    }
                    button type="button" data-install data-ios-label="방법 보기" class="min-h-11 shrink-0 rounded-xl bg-accent-strong px-4 text-base font-semibold text-white" { "설치하기" }
                    button type="button" data-dismiss aria-label="설치 안내 닫기" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted" { (svg("h-5 w-5", BANNER_CLOSE)) }
                }
            }
        }
        template data-pwa-sheet {
            div role="dialog" aria-modal="true" aria-labelledby="pwa-sheet-title" class="fixed inset-0 z-[60]" {
                button type="button" aria-label="안내 닫기" data-close class="absolute inset-0 bg-foreground/40" {}
                div tabindex="-1" data-panel class="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-border bg-surface p-6 outline-none" style="padding-bottom:calc(env(safe-area-inset-bottom) + 1.5rem)" {
                    h2 id="pwa-sheet-title" class="text-lg font-bold" { "홈 화면에 추가하는 방법" }
                    ol class="mt-4 space-y-4 text-base" {
                        li class="flex items-center gap-3" {
                            span class=(STEP) { "1" }
                            span class="flex items-center gap-1.5" {
                                "하단의 " (svg("inline h-5 w-5 text-accent", SHARE))
                                strong class="font-semibold" { "공유" } " 버튼을 눌러요"
                            }
                        }
                        li class="flex items-center gap-3" {
                            span class=(STEP) { "2" }
                            span { strong class="font-semibold" { "‘홈 화면에 추가’" } "를 선택해요" }
                        }
                        li class="flex items-center gap-3" {
                            span class=(STEP) { "3" }
                            span { "오른쪽 위 " strong class="font-semibold" { "‘추가’" } "를 누르면 끝나요" }
                        }
                    }
                    button type="button" data-dismiss class="mt-6 min-h-11 w-full rounded-xl bg-accent-strong text-base font-semibold text-white" { "확인했어요" }
                }
            }
        }
    }
}
