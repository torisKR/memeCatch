//! `GET /privacy` (`app/(default)/privacy/page.tsx`): the privacy policy.
//!
//! The markup is what Next renders (`scripts/html-to-maud.mjs`); copy changes
//! belong in the TypeScript, then here.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::{korean_share, respond};
use crate::AppState;
use crate::pages::document::Head;

const TITLE: &str = "개인정보처리방침";
const DESCRIPTION: &str = "밈캐치 개인정보처리방침 — 수집 항목, 이용 목적, 보관 기간, 이용자 권리.";

/// The privacy policy. Its robots tag says `index, follow` explicitly, as Next's does.
pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let head = Head {
        robots: Some("index, follow"),
        ..korean_share(&state.pages.site, TITLE, DESCRIPTION, "/privacy", true)
    };
    respond(&state, &request, head, main())
}

fn main() -> Markup {
    html! {
        main class="mx-auto max-w-site px-4 pb-16 pt-10" {
            h1 class="page-title" { "개인정보처리방침" }
            p class="mt-2 text-sm text-muted" { "시행일: 2026년 8월 18일" }
            div class="prose-sm mt-8 max-w-3xl space-y-8 text-base leading-relaxed" {
                section {
                    h2 class="text-xl font-bold" { "1. 수집하는 개인정보와 방법" }
                    ul class="mt-3 list-disc space-y-1.5 pl-5" {
                        li {
                            strong { "회원가입(카카오·구글 소셜 로그인)" }
                            ": 이메일 주소, 소셜 계정 식별자, 닉네임 — 이용자가 로그인 시 직접 제공"
                        }
                        li {
                            strong { "회원가입(TikTok 로그인)" }
                            ": TikTok 앱 전용 계정 식별자(open_id), 표시 이름, 프로필 사진 — 로그인 시 TikTok에서 제공받습니다. 계정 식별자는 일방향 변환한 값만 저장하며 TikTok 계정의 이메일 주소는 제공받지 않습니다."
                        }
                        li {
                            strong { "TikTok 공개 영상 가져오기(선택)" }
                            ": 공개 영상 ID·제목·설명·공유 URL — 이용자가 video.list 권한을 허용한 경우 최신 공개 영상 최대 20개를 검수 대기 제보로 저장합니다. 로그인과 영상 가져오기에 사용하는 TikTok 액세스 토큰은 요청 처리 중에만 사용하고 저장하지 않습니다."
                        }
                        li {
                            strong { "서비스 이용 중 생성" }
                            ": 제보·댓글·좋아요·저장 활동 기록, 관심 카테고리, 가명 세션 식별자와 조회·공유·퀴즈·유입 이벤트"
                        }
                        li {
                            strong { "종료된 MemeCatch Plus 구매 기록" }
                            ": 유료 멤버십은 종료되어 새로 결제 정보를 수집하지 않습니다. 이전에 받은 주문·거래 식별자, 결제 상태·금액·통화·시각은 문의 대응과 법정 보존 기간 동안만 분리 보관합니다."
                        }
                        li {
                            strong { "자동 수집" }
                            ": 접속 로그, 쿠키(로그인 세션 유지 목적) — 서비스 서버(Oracle Cloud)에서 자체 처리"
                        }
                    }
                }
                section {
                    h2 class="text-xl font-bold" { "2. 이용 목적" }
                    ul class="mt-3 list-disc space-y-1.5 pl-5" {
                        li { "회원 식별·로그인 상태 유지" }
                        li { "이용자가 선택한 TikTok 공개 영상을 검수 대기 제보로 가져오기" }
                        li { "제보 검수·커뮤니티 운영·부정 이용 방지" }
                        li { "저장한 밈·관심 카테고리 등 개인화 기능 제공" }
                        li { "종료된 유료 멤버십의 이전 구매·환불 문의 처리" }
                        li { "밈 유행 지표 집계(익명화된 통계 목적)" }
                    }
                }
                section {
                    h2 class="text-xl font-bold" { "3. 보관 기간 및 파기" }
                    p class="mt-3" { "회원 탈퇴 시 개인정보는 지체 없이 파기합니다. 다만 관계 법령에 따라 보존이 필요한 기록(예: 접속 로그 3개월, 통신비밀보호법)은 해당 기간 동안 보관 후 파기합니다. 탈퇴 후 제보·댓글은 작성자 정보가 분리된 상태로 남거나 삭제됩니다. 결제·취소·환불 기록은 관계 법령상 보존 의무가 있는 경우 해당 기간 동안 분리 보관한 뒤 파기합니다." }
                }
                section {
                    h2 class="text-xl font-bold" { "4. 처리 위탁·외부 서비스 및 국외 이전" }
                    p class="mt-3" { "서비스 운영을 위해 아래 업체에 개인정보 처리를 위탁하거나 외부 서비스를 이용하며, 데이터는 해당 서비스의 해외 리전에서 처리될 수 있습니다." }
                    ul class="mt-3 list-disc space-y-1.5 pl-5" {
                        li {
                            strong { "Oracle Cloud Infrastructure" }
                            " — 웹 서버·데이터베이스·로그인 세션·접속 로그 호스팅"
                        }
                        li {
                            strong { "Cloudflare" }
                            " — CDN·보안 프록시, 이미지 저장소와 암호화 백업(R2)"
                        }
                        li {
                            strong { "TikTok" }
                            " — 소셜 로그인 인증과 이용자가 선택한 공개 영상 목록 제공. 사용자가 허용한 TikTok 계정·영상 정보만 암호화된 통신으로 제공받으며, 액세스 토큰은 저장하지 않습니다."
                        }
                    }
                }
                section {
                    h2 class="text-xl font-bold" { "5. 이용자의 권리" }
                    p class="mt-3" { "이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다. MY 페이지에서 닉네임 변경이 가능하며, 탈퇴·기타 요청은 아래 문의처로 연락 주시면 지체 없이 처리합니다." }
                }
                section {
                    h2 class="text-xl font-bold" { "6. 쿠키 및 광고" }
                    p class="mt-3" { "로그인 세션 유지를 위한 필수 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 거부할 수 있으나 로그인 기능이 제한될 수 있습니다." }
                    p class="mt-3" {
                        "본 서비스는 이용 통계 분석을 위해 "
                        strong { "Google 애널리틱스" }
                        "를 사용합니다. 수집되는 정보는 익명화된 이용 행태(방문 페이지, 유입 경로, 기기 유형, 문서 내 출처 링크·정정 제보 링크 클릭 — 문서 ID와 플랫폼명만 기록하며 개인을 식별할 수 있는 정보는 포함하지 않습니다)이며 개인을 식별하지 않습니다."
                    }
                    p class="mt-3" {
                        "본 서비스는 광고 게재를 위해 "
                        strong { "Google AdSense" }
                        "를 사용할 수 있습니다. Google을 포함한 제3자 광고 사업자는 쿠키를 사용해 이용자의 이전 방문 기록을 기반으로 광고를 게재하며, Google의 광고 쿠키 사용으로 이용자에게 맞춤형 광고가 표시될 수 있습니다."
                    }
                    ul class="mt-3 list-disc space-y-1.5 pl-5" {
                        li {
                            "이용자는 "
                            a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" class="text-accent-text underline underline-offset-2" { "Google 광고 설정" }
                            "에서 맞춤 광고를 해제할 수 있습니다."
                        }
                        li {
                            "제3자 광고 사업자의 쿠키 사용은 "
                            a href="https://policies.google.com/technologies/ads?hl=ko" target="_blank" rel="noopener noreferrer" class="text-accent-text underline underline-offset-2" { "Google 광고 정책" }
                            "을 참고하세요."
                        }
                    }
                }
                section {
                    h2 class="text-xl font-bold" { "7. 개인정보 보호책임자 및 문의" }
                    p class="mt-3" {
                        "개인정보 보호책임자: 밈캐치 운영자"
                        br;
                        "문의: "
                        a href="mailto:toris@toris.kr" class="text-accent-text underline underline-offset-2" { "toris@toris.kr" }
                    }
                    p class="mt-3 text-sm text-muted" { "본 방침이 변경되는 경우 시행 7일 전 사이트 공지로 알립니다." }
                }
            }
        }
    }
}
