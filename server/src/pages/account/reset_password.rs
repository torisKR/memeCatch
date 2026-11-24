//! `GET /reset-password` (`app/(default)/reset-password/`): the new password
//! form. The reset mail links here with `?token=`; a signed-in user may also
//! come here without one. Without either the page says the link has expired.
//!
//! `ui/auth-forms.js` does what `updatePassword` of lib/actions/auth.ts does:
//! checks the two passwords, then with a token posts them to
//! `POST /api/auth/reset-password` (A2), without one to
//! `POST /api/account/password` (`routes/account.rs`), and goes to `/my`.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::respond;
use crate::AppState;
use crate::pages::DYNAMIC_PAGE_CACHE;
use crate::pages::document::{Head, SITE_CARD_DESCRIPTION};
use crate::routes::better_auth::page_user;

const INPUT: &str = "mt-1.5 h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-4 focus:ring-accent/20";
const BUTTON: &str = "flex h-12 w-full items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60";

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let token = token(request.uri().query());
    let user = page_user(&state, request.headers()).await;
    let head = Head {
        title: "새 비밀번호 설정".to_owned(),
        description: Some(SITE_CARD_DESCRIPTION.to_owned()),
        robots: Some("noindex, nofollow"),
        site_card: true,
        ..Head::default()
    };
    let email = user.map(|user| user.email);
    let main = main(&token, email.as_deref());
    respond(&state, &request, DYNAMIC_PAGE_CACHE, head, main)
}

/// `typeof params.token === "string" ? params.token : ""`: a name that
/// appears more than once counts as absent.
fn token(query: Option<&str>) -> String {
    let mut values = url::form_urlencoded::parse(query.unwrap_or("").as_bytes())
        .filter(|(key, _)| key == "token")
        .map(|(_, value)| value.into_owned());
    match (values.next(), values.next()) {
        (Some(token), None) => token,
        _ => String::new(),
    }
}

/// `email` is the signed-in user's: `canReset` is a user or a token.
fn main(token: &str, email: Option<&str>) -> Markup {
    let can_reset = email.is_some() || !token.is_empty();
    html! {
        main class="mx-auto w-full max-w-sm px-4 py-12" {
            p class="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)" { "Reset" }
            h1 class="mt-1 text-2xl font-bold tracking-tight" { "새 비밀번호 설정" }
            div class="glass-panel mt-5 rounded-2xl p-5" {
                @if can_reset {
                    p class="text-sm leading-relaxed text-muted" {
                        @if let Some(email) = email.filter(|email| !email.is_empty()) {
                            span class="font-semibold text-foreground" { (email) }
                            " 계정의 새 비밀번호를 정해 주세요."
                        } @else {
                            "메일의 재설정 링크로 새 비밀번호를 정해 주세요."
                        }
                    }
                    form class="mt-6 flex flex-col gap-4" novalidate data-auth-form="reset" {
                        @if !token.is_empty() {
                            input type="hidden" name="token" value=(token);
                        } @else {
                            // D2: signed in without a token, the current
                            // password is asked for, as better-auth's
                            // `changePassword` asks for it.
                            div {
                                label for="reset-current" class="block text-sm font-semibold" { "현재 비밀번호" }
                                input id="reset-current" type="password" autocomplete="current-password" required aria-invalid="false" aria-describedby="reset-current-hint" class=(INPUT) name="currentPassword";
                                p id="reset-current-hint" class="mt-1.5 text-xs text-muted" { "바꾸면 다른 기기의 로그인은 모두 끝나요." }
                            }
                        }
                        div {
                            label for="reset-password" class="block text-sm font-semibold" { "새 비밀번호" }
                            input id="reset-password" type="password" autocomplete="new-password" required minlength="6" aria-invalid="false" aria-describedby="reset-password-hint" class=(INPUT) name="password";
                            p id="reset-password-hint" class="mt-1.5 text-xs text-muted" { "6자 이상으로 정해 주세요." }
                        }
                        div {
                            label for="reset-confirm" class="block text-sm font-semibold" { "새 비밀번호 확인" }
                            input id="reset-confirm" type="password" autocomplete="new-password" required minlength="6" class=(INPUT) name="confirm";
                        }
                        button type="submit" class=(BUTTON) { "비밀번호 변경" }
                    }
                } @else {
                    p class="text-sm leading-relaxed text-muted" { "재설정 링크가 만료됐거나 유효하지 않아요. 링크는 발송 후 1시간 동안만 쓸 수 있어요." }
                    a class="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98]" href="/forgot-password" { "재설정 메일 다시 받기" }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_token_is_a_single_query_value() {
        assert_eq!(token(None), "");
        assert_eq!(token(Some("token=a%2Bb+c")), "a+b c");
        assert_eq!(token(Some("token=a&token=b")), "");
        assert_eq!(token(Some("x=1&token=")), "");
        assert_eq!(token(Some("tokenx=1")), "");
    }
}
