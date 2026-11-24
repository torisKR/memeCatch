//! Google and Kakao sign-in (docs/axum-migration/UI-PLAN.md section 4, step
//! 5): better-auth's `signInSocial` (`start.rs`) and `callbackOAuth`
//! (`callback.rs`) for the two providers of lib/auth/server.ts
//! (`providers.rs`). They move together, under one route id (`auth-oauth`):
//! the state is better-auth's own format (`state.rs`), and the session at
//! the end is the one get-session reads. The user, account and session rows are
//! better-auth's (`link.rs`, `store.rs`).
//!
//! Not here: account linking (`/link-social`, which this app does not call)
//! and the flows that start there, ID-token sign-in, TikTok
//! (`app/auth/tiktok`, a route handler of its own: `../tiktok/`, PLAN.md A4), and
//! `app/auth/callback/route.ts`, the page the
//! app's `callbackURL` names, which only reads the session cookie
//! (PLAN.md A3).

pub mod callback;
pub(super) mod http;
mod link;
pub mod providers;
pub mod start;
mod state;
mod store;

pub use providers::Providers;
