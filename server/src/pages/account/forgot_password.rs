//! `GET /forgot-password` (`app/(default)/forgot-password/`): the form that
//! asks for a reset link. `ui/auth-forms.js` does what
//! `requestPasswordReset` of lib/actions/auth.ts does: checks the address,
//! posts it to `POST /api/auth/request-password-reset` (A2) with
//! `redirectTo: "/reset-password"`, and shows the same notice whatever the
//! answer, so no answer tells whether the address has an account.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::respond;
use crate::AppState;
use crate::pages::document::Head;
use crate::pages::documents::PRERENDERED_PAGE_CACHE;

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let head = Head {
        title: "비밀번호 찾기".to_owned(),
        description: Some("가입한 이메일로 비밀번호 재설정 링크를 보내드려요.".to_owned()),
        robots: Some("noindex, nofollow"),
        site_card: true,
        ..Head::default()
    };
    respond(&state, &request, PRERENDERED_PAGE_CACHE, head, main())
}

fn main() -> Markup {
    html! {
        main class="mx-auto w-full max-w-sm px-4 py-12" {
            p class="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)" { "Recovery" }
            h1 class="mt-1 text-2xl font-bold tracking-tight" { "비밀번호 찾기" }
            div class="glass-panel mt-5 rounded-2xl p-5" {
                p class="text-sm leading-relaxed text-muted" { "가입하신 이메일을 입력하면 비밀번호를 다시 설정할 수 있는 링크를 보내드려요." }
                form class="mt-6 flex flex-col gap-4" novalidate data-auth-form="forgot" {
                    div {
                        label for="forgot-email" class="block text-sm font-semibold" { "이메일" }
                        input id="forgot-email" type="email" autocomplete="email" inputmode="email" required placeholder="you@example.com" aria-invalid="false" class="mt-1.5 h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-4 focus:ring-accent/20" name="email";
                    }
                    button type="submit" class="flex h-12 w-full items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60" { "재설정 메일 받기" }
                    a class="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-accent-text transition-colors hover:text-accent" href="/login" { "로그인으로 돌아가기" }
                }
            }
        }
    }
}
