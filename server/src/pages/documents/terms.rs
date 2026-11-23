//! `GET /terms` (`app/(default)/terms/page.tsx`): the terms of service.
//!
//! The markup is what Next renders (`scripts/html-to-maud.mjs`); copy changes
//! belong in the TypeScript, then here.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::{korean_share, respond};
use crate::AppState;

const TITLE: &str = "이용약관";
const DESCRIPTION: &str =
    "밈캐치 서비스 이용약관 — 서비스 내용, 회원의 의무, 콘텐츠 권리, 책임 제한.";

/// The terms of service.
pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let head = korean_share(&state.pages.site, TITLE, DESCRIPTION, "/terms", true);
    respond(&state, &request, head, main())
}

fn main() -> Markup {
    html! {
        main class="mx-auto max-w-site px-4 pb-16 pt-10" {
            h1 class="page-title" { "이용약관" }
            p class="mt-2 text-sm text-muted" { "시행일: 2026년 8월 18일" }
            div class="mt-8 max-w-3xl space-y-8 text-base leading-relaxed" {
                section {
                    h2 class="text-xl font-bold" { "제1조 (목적과 서비스)" }
                    p class="mt-3" { "본 약관은 밈캐치(이하 “서비스”)의 이용 조건을 정합니다. 서비스는 한국 밈·유행어의 뜻·유래·사용 정보를 제공하는 사전과, 회원이 참여하는 제보·커뮤니티 기능으로 구성됩니다." }
                }
                section {
                    h2 class="text-xl font-bold" { "제2조 (회원)" }
                    ul class="mt-3 list-disc space-y-1.5 pl-5" {
                        li { "소셜 로그인(카카오·구글·TikTok) 또는 이메일로 가입할 수 있습니다." }
                        li { "회원은 언제든지 탈퇴할 수 있으며, 탈퇴 처리는 문의처를 통해 요청할 수 있습니다." }
                        li { "타인의 계정 도용, 부정 이용 시 이용이 제한될 수 있습니다." }
                    }
                }
                section {
                    h2 class="text-xl font-bold" { "제3조 (무료 이용과 광고)" }
                    ul class="mt-3 list-disc space-y-1.5 pl-5" {
                        li { "서비스의 모든 기능은 무료이며, 유료 멤버십·구독·결제 기능을 제공하지 않습니다." }
                        li { "서비스 운영비는 광고로 충당합니다. 광고는 밈의 수록 여부나 안전 등급 판단에 영향을 주지 않습니다." }
                        li { "종료된 MemeCatch Plus 이용권에 관한 문의는 아래 문의처로 결제 일시와 계정을 알려 주시면 확인 후 안내합니다." }
                    }
                }
                section {
                    h2 class="text-xl font-bold" { "제4조 (회원이 올린 콘텐츠)" }
                    ul class="mt-3 list-disc space-y-1.5 pl-5" {
                        li { "제보·댓글·게시글의 저작권은 작성자에게 있습니다." }
                        li { "작성자는 서비스가 해당 콘텐츠를 사전 편찬·노출·홍보 목적으로 사용(편집·요약 포함)하는 것을 허락합니다." }
                        li { "타인의 권리를 침해하거나 혐오·비하·불법 정보를 포함한 콘텐츠는 사전 통지 없이 숨김·삭제될 수 있습니다." }
                        li { "제보는 운영자 검수를 거쳐 게시 여부가 결정되며, 게시를 보장하지 않습니다." }
                    }
                }
                section {
                    h2 class="text-xl font-bold" { "제5조 (금지 행위)" }
                    ul class="mt-3 list-disc space-y-1.5 pl-5" {
                        li { "허위 정보의 고의 유포, 스팸·광고성 게시" }
                        li { "자동화 수단을 통한 대량 수집(공개 API·피드 제외)·서비스 방해" }
                        li { "타인의 개인정보 게시, 명예훼손, 저작권 침해" }
                    }
                }
                section {
                    h2 class="text-xl font-bold" { "제6조 (책임의 제한)" }
                    p class="mt-3" { "서비스의 밈 정보(뜻·유래·사용 안전도)는 검수를 거치지만 완전성을 보장하지 않는 참고 정보입니다. 밈 사용으로 발생한 결과, 외부 링크 콘텐츠, 천재지변·인프라 장애로 인한 중단에 대해 서비스는 고의·중과실이 없는 한 책임지지 않습니다. 무료로 제공되는 서비스의 내용은 사전 공지 후 변경·중단될 수 있습니다." }
                }
                section {
                    h2 class="text-xl font-bold" { "제7조 (문의 및 분쟁)" }
                    p class="mt-3" {
                        "약관·저작권·정정 요청 문의: "
                        a href="mailto:toris@toris.kr" class="text-accent-text underline underline-offset-2" { "toris@toris.kr" }
                        br;
                        "본 약관은 대한민국 법률에 따르며, 변경 시 시행 7일 전 공지합니다."
                    }
                }
            }
        }
    }
}
