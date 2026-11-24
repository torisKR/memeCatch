//! `GET /editorial` (`app/(default)/editorial/page.tsx`): what is listed, how the usage signal is set, how content is reviewed and corrected.
//!
//! Static copy.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::{korean_share, respond};
use crate::AppState;

const TITLE: &str = "편집 원칙";
const DESCRIPTION: &str = "밈캐치가 밈을 수록하는 기준, 사용 안전 신호를 매기는 근거, 사실확인·저작권 검수 절차와 오류 정정 요청 방법을 공개합니다.";

/// The editorial standards.
pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let head = korean_share(&state.pages.site, TITLE, DESCRIPTION, "/editorial", false);
    respond(&state, &request, head, main())
}

fn main() -> Markup {
    html! {
        main class="mx-auto max-w-site px-4 pb-16 pt-10" {
            div class="max-w-3xl" {
                h1 class="page-title" { "편집 원칙" }
                p class="mt-2 text-sm text-muted" { "최종 개정: 2026년 7월 26일" }
                p class="mt-4 text-lg leading-relaxed text-muted" { "밈캐치는 “이 밈, 지금 써도 되나”에 답하는 사전입니다. 그 답이 신뢰를 얻으려면 무엇을 근거로 판단했는지가 함께 보여야 한다고 생각합니다. 이 문서는 밈을 수록하는 기준, 사용 안전 신호를 매기는 근거, 검수 절차, 그리고 저희가 틀렸을 때 고치는 방법을 정리한 것입니다." }
                section class="mt-12" {
                    h2 class="text-xl font-bold" { "1. 무엇을 수록하나" }
                    p class="mt-3 text-base leading-relaxed" { "한국어권에서 실제로 통용된 밈·유행어·챌린지를 수록합니다. 유행 여부와 무관하게, 다음 세 가지를 모두 쓸 수 있어야 항목이 만들어집니다." }
                    ul class="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed" {
                        li {
                            strong { "한 문장으로 끝나는 정의" }
                            " — 다른 밈을 몰라도 그 문장만 읽고 뜻이 통해야 합니다. 설명에 또 다른 밈 이름이 필요하면 그 밈부터 먼저 수록합니다."
                        }
                        li {
                            strong { "특정 가능한 출처" }
                            " — 어디서 시작됐는지 가리킬 수 있어야 합니다. 발원지를 특정할 수 없으면 뜻과 맥락만 남기고 유래는 비워 둡니다."
                        }
                        li {
                            strong { "판정 가능한 사용 안전도" }
                            " — 실제 쓰임을 관찰할 수 있어야 합니다. 용례가 너무 적어 판단이 서지 않으면 공개를 보류합니다."
                        }
                    }
                    p class="mt-4 text-base leading-relaxed" { "수록하지 않는 것도 분명히 해 둡니다. 특정 개인을 조롱하려고 만들어져 공적 논의 가치가 없는 표현, 한 커뮤니티 안에서만 통하고 밖으로 퍼진 적 없는 내부 은어, 확인되지 않은 신상·사건 주장을 전제로 하는 밈은 수록하지 않습니다. 혐오·비하 소지가 있더라도 이미 널리 퍼져 “뜻을 몰라서 잘못 쓰는” 위험이 실재하는 표현은 기록하되, 뒤에 설명하는 ‘쓰면 위험’ 신호를 달고 추천에서 제외합니다. 설명하지 않는 것이 더 위험하다고 보기 때문입니다." }
                    h3 class="mt-6 font-bold" { "밈이 아닌 것: 사건 기록" }
                    p class="mt-2 text-base leading-relaxed" {
                        strong { "밈이란 모방·변형되며 퍼지는 표현 양식" }
                        "입니다. 아무리 널리 알려지고 화제가 됐더라도, 사건·인물·작품·게임 용어 그 자체는 밈이 아니라 "
                        strong { "‘사건 기록’" }
                        "으로 따로 분류합니다. 자체 검토에서 이런 경우가 세 갈래로 나뉘는 것을 확인했습니다."
                    }
                    ul class="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed" {
                        li {
                            strong { "사건·인물 기록" }
                            " — 오디션 우승, 소비자 사건처럼 “무슨 일이 있었나”를 담은 항목"
                        }
                        li {
                            strong { "게임 고유명사" }
                            " — 특정 게임 안에서만 통하는 보스명· 서버명 같은 용어"
                        }
                        li {
                            strong { "곡·실존 인물" }
                            " — 발매곡 자체이거나 실존 인물을 가리키는 이름"
                        }
                    }
                    p class="mt-3 text-base leading-relaxed" {
                        "이런 항목은 수록을 취소하지 않습니다. 검색 유입과 URL은 그대로 유지하되, 화면에 "
                        span class="inline-flex items-center gap-1 rounded-full bg-safety-gray-bg px-2 py-0.5 text-sm font-semibold text-safety-gray" { "밈이 아니라 인터넷 문화 사건 기록이에요" }
                        " 배지를 달아 밈 사전이 아니라는 사실을 먼저 밝힙니다."
                    }
                }
                section class="mt-12" {
                    h2 class="text-xl font-bold" { "2. 사용 안전 신호는 이렇게 매깁니다" }
                    p class="mt-3 text-base leading-relaxed" {
                        "사용 안전 신호는 밈의 재미나 품질에 대한 평가가 아닙니다."
                        strong { " 지금 이 표현을 썼을 때 상대가 어떻게 받아들일지" }
                        "에 대한 예측이며, 근거는 실제 커뮤니티 용례입니다. 등급은 네 단계이고 판정 기준은 다음과 같습니다."
                    }
                    dl class="mt-4 space-y-4" {
                        div class="rounded-2xl border border-border bg-surface p-4" {
                            dt {
                                span role="img" aria-label="써도 됨" class="safety-pulse inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_38%,transparent),0_0_10px_-2px_color-mix(in_srgb,currentColor_55%,transparent)] bg-safety-green-bg text-safety-green" {
                                    span aria-hidden="true" class="leading-none" {
                                        svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="size-4" data-safety-icon="green" aria-hidden="true" focusable="false" {
                                            path d="M4.75 12.35 9.2 16.8 19.25 6.75" {}
                                            path d="M12 2.75a9.25 9.25 0 1 1-6.54 2.71" opacity=".32" {}
                                        }
                                    }
                                    span class="min-w-0" { "써도 됨" }
                                }
                            }
                            dd class="mt-1.5 text-base leading-relaxed text-muted" { "커뮤니티 사용례에서 부정적 맥락 없이 널리 쓰이는 것이 확인된 경우입니다. 특정 집단을 겨냥한 용법이 관찰되지 않아야 합니다." }
                        }
                        div class="rounded-2xl border border-border bg-surface p-4" {
                            dt {
                                span role="img" aria-label="맥락 주의" class="safety-pulse inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_38%,transparent),0_0_10px_-2px_color-mix(in_srgb,currentColor_55%,transparent)] bg-safety-yellow-bg text-safety-yellow" {
                                    span aria-hidden="true" class="leading-none" {
                                        svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="size-4" data-safety-icon="yellow" aria-hidden="true" focusable="false" {
                                            path d="M5.25 4.25h13.5a2 2 0 0 1 2 2v8.25a2 2 0 0 1-2 2H10l-4.75 3v-3a2 2 0 0 1-2-2V6.25a2 2 0 0 1 2-2Z" {}
                                            path d="M12 7.4v4.15M12 14.1h.01" {}
                                        }
                                    }
                                    span class="min-w-0" { "맥락 주의" }
                                }
                            }
                            dd class="mt-1.5 text-base leading-relaxed text-muted" { "맥락에 따라 오해나 불쾌감을 줄 수 있는 경우입니다. 뜻 자체는 중립이어도 상대·자리에 따라 결과가 달라지면 여기에 둡니다." }
                        }
                        div class="rounded-2xl border border-border bg-surface p-4" {
                            dt {
                                span role="img" aria-label="이미 늦음" class="safety-pulse inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_38%,transparent),0_0_10px_-2px_color-mix(in_srgb,currentColor_55%,transparent)] bg-safety-gray-bg text-safety-gray" {
                                    span aria-hidden="true" class="leading-none" {
                                        svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="size-4" data-safety-icon="gray" aria-hidden="true" focusable="false" {
                                            path d="M12 3.25a8.75 8.75 0 1 1-8.75 8.75A8.75 8.75 0 0 1 12 3.25Z" {}
                                            path d="M12 7.1v5.25l3.35 2.05M3.3 5.35h3.15M2.25 8h2.1" {}
                                        }
                                    }
                                    span class="min-w-0" { "이미 늦음" }
                                }
                            }
                            dd class="mt-1.5 text-base leading-relaxed text-muted" { "뜻이나 안전성의 문제가 아니라 유행이 지나 지금 쓰면 어색하게 들리는 경우입니다. 조회 추이로 판단합니다." }
                        }
                        div class="rounded-2xl border border-border bg-surface p-4" {
                            dt {
                                span role="img" aria-label="쓰면 위험" class="safety-pulse inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_38%,transparent),0_0_10px_-2px_color-mix(in_srgb,currentColor_55%,transparent)] bg-safety-red-bg text-safety-red" {
                                    span aria-hidden="true" class="leading-none" {
                                        svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class="size-4" data-safety-icon="red" aria-hidden="true" focusable="false" {
                                            path d="m8.35 2.75-5.6 5.6v7.3l5.6 5.6h7.3l5.6-5.6v-7.3l-5.6-5.6h-7.3Z" {}
                                            path d="M7.25 12h9.5" {}
                                        }
                                    }
                                    span class="min-w-0" { "쓰면 위험" }
                                }
                            }
                            dd class="mt-1.5 text-base leading-relaxed text-muted" { "비하·혐오 등 부정적 맥락과 결합해 쓰이는 것이 확인된 경우입니다. 기록은 남기되 추천 노출에서 제외합니다." }
                        }
                    }
                    p class="mt-4 text-base leading-relaxed" {
                        "등급은 고정값이 아닙니다. 같은 말도 쓰는 사람과 자리가 바뀌면 결과가 달라지기 때문에, 밈 상세의 "
                        strong { "‘이 판정의 근거’" }
                        "에서 직장·친구·가족·SNS 상황별로 가능·주의를 따로 표시합니다. 등급을 바꿀 만한 새 용례가 관찰되면 공개 후에도 조정하며, 판단이 갈리는 항목에는 ‘논쟁 중’ 표시를 함께 답니다."
                    }
                    p class="mt-4 text-base leading-relaxed" { "유행 상태(급상승·유행 중·식는 중·추억 밈)를 나타내는 밈 생명 게이지는 안전 신호와 별개이며, 사이트 안의 조회 추이로 계산합니다. 외부 검색량이나 언론 노출을 반영하지 않으므로 “밈캐치 이용자 기준”으로 읽어 주세요." }
                }
                section class="mt-12" {
                    h2 class="text-xl font-bold" { "3. 검수 절차" }
                    p class="mt-3 text-base leading-relaxed" { "모든 항목은 아래 단계를 순서대로 거칩니다. 단계는 내부 관리 상태로 기록되며, 앞 단계를 건너뛰고 공개되지 않습니다." }
                    ol class="mt-4 space-y-3" {
                        li class="rounded-2xl border border-border bg-surface p-4" {
                            p class="font-bold" {
                                span class="text-muted" { "1." }
                                " 접수 (pending)"
                            }
                            p class="mt-1.5 text-base leading-relaxed text-muted" { "제보 또는 자동 수집으로 후보가 등록됩니다. 이 단계의 항목은 공개되지 않습니다." }
                        }
                        li class="rounded-2xl border border-border bg-surface p-4" {
                            p class="font-bold" {
                                span class="text-muted" { "2." }
                                " 사실 확인 (fact_checking)"
                            }
                            p class="mt-1.5 text-base leading-relaxed text-muted" { "뜻·유래·최초 확인 시점을 서로 독립된 복수 출처로 교차 확인합니다. 한 곳에서만 확인되는 유래는 단정하지 않습니다." }
                        }
                        li class="rounded-2xl border border-border bg-surface p-4" {
                            p class="font-bold" {
                                span class="text-muted" { "3." }
                                " 저작권 확인 (rights_checking)"
                            }
                            p class="mt-1.5 text-base leading-relaxed text-muted" { "출처마다 권리 근거를 지정합니다. 근거가 확인되지 않으면 공개 임베드로 올리지 않습니다." }
                        }
                        li class="rounded-2xl border border-border bg-surface p-4" {
                            p class="font-bold" {
                                span class="text-muted" { "4." }
                                " 공개 (approved) 또는 제한 공개 (limited)"
                            }
                            p class="mt-1.5 text-base leading-relaxed text-muted" { "두 확인을 모두 통과하면 공개합니다. 뜻은 확인됐지만 원본·연도가 더 필요한 항목은 제한 공개로 두고 화면에 “출처 확인 중”을 함께 표시합니다." }
                        }
                    }
                    p class="mt-4 text-base leading-relaxed" {
                        "확인에 실패한 항목은 반려하고 공개하지 않습니다. "
                        a rel="nofollow" class="text-accent-text underline underline-offset-2" href="/submit" { "제보" }
                        "해 주신 밈은 보통 24~48시간 안에 등록 여부를 회신하며, 유래 확인에 추가 자료가 필요하면 사흘까지 걸릴 수 있습니다. 제보자가 보낸 설명을 그대로 옮기지 않고, 저희가 다시 확인한 내용만 본문에 씁니다."
                    }
                }
                section class="mt-12" {
                    h2 class="text-xl font-bold" { "4. 출처와 저작권" }
                    p class="mt-3 text-base leading-relaxed" {
                        "밈캐치는 "
                        strong { "제3자 원본 영상·이미지 파일을 저장하지 않습니다." }
                        " 원저작자가 올린 자리로 링크하거나, 플랫폼이 공식 제공하는 임베드로만 보여 줍니다. 출처는 항목별로 원장에 기록하고, 저마다 어떤 역할인지와 어떤 권리 근거로 노출하는지를 함께 남깁니다."
                    }
                    h3 class="mt-6 font-bold" { "출처의 역할 구분" }
                    p class="mt-2 text-base leading-relaxed" { "링크 하나하나가 같은 무게를 갖지 않습니다. 원본과 나중에 퍼진 영상을 섞지 않기 위해 역할을 나눠 기록합니다." }
                    ul class="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed" {
                        li { "원본" }
                        li { "공식 재업로드" }
                        li { "최초 확인 출처" }
                        li { "2차 참고 자료" }
                        li { "사용 예시" }
                    }
                    h3 class="mt-6 font-bold" { "노출 권리 근거" }
                    p class="mt-2 text-base leading-relaxed" { "공식 임베드·창작자 허가·크리에이티브 커먼즈·공공 데이터 중 하나가 확인된 출처만 화면에 임베드합니다. 권리를 확인하지 못한 출처는 링크만 걸거나 아예 노출하지 않습니다." }
                    ul class="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed" {
                        li { "공식 임베드" }
                        li { "창작자 허가" }
                        li { "크리에이티브 커먼즈" }
                        li { "공공 데이터" }
                        li { "링크만 허용" }
                        li { "권리 미확인" }
                        li { "저작권 위험 차단" }
                    }
                    h3 class="mt-6 font-bold" { "자동 수집은 공개 승인이 아닙니다" }
                    p class="mt-2 text-base leading-relaxed" { "YouTube·TikTok·Instagram의 공개 API와 oEmbed로 출처 후보를 모으는 자동 수집을 운영하지만, 수집 결과는 검수 대기열에만 들어갑니다. 자동 점수가 아무리 높아도 그것만으로 공개되지 않으며, 사람이 확인한 항목만 공개됩니다. 제보자가 자기 TikTok 계정의 공개 영상을 직접 가져오는 경우도 마찬가지로 검수 대기 상태로만 추가됩니다." }
                    h3 class="mt-6 font-bold" { "공개 후 재확인" }
                    p class="mt-2 text-base leading-relaxed" { "공개된 출처도 그대로 두지 않습니다. 주기적으로 생존 여부와 임베드 허용 상태를 다시 확인해, 원저작자가 삭제했거나 비공개로 돌린 영상, 임베드를 막은 영상은 공개 화면에서 자동으로 내립니다. 원저작자의 결정이 저희 페이지보다 우선한다는 뜻입니다." }
                }
                section class="mt-12" {
                    h2 class="text-xl font-bold" { "5. 연도와 유래를 표기하는 방식" }
                    p class="mt-3 text-base leading-relaxed" { "밈은 “처음”을 특정하기 어려운 경우가 많습니다. 그래서 연도는 확인된 정밀도만큼만 적습니다. 날짜까지 확인되면 정확한 날짜로, 해까지만 확인되면 연도로, 그마저 애매하면 “대략” 이나 연대(예: 2010년대)로 표기합니다. 확인되지 않은 유래는 “~로 알려짐”처럼 전언임을 드러내 적고 단정하지 않습니다." }
                    p class="mt-4 text-base leading-relaxed" { "시대 구분(PC통신·초기 웹·소셜미디어·숏폼)은 그 밈이 어떤 환경에서 퍼졌는지를 보여주기 위한 분류이며, 연도를 기준으로 일관되게 적용합니다. 특정 연도의 밈을 임의로 다른 시대에 넣지 않습니다." }
                }
                section class="mt-12" {
                    h2 class="text-xl font-bold" { "6. 광고와 편집의 분리" }
                    p class="mt-3 text-base leading-relaxed" { "밈캐치는 광고로만 운영됩니다. 광고주는 밈의 수록 여부나 사용 안전 등급에 관여하지 않으며, 대가를 받고 특정 밈을 올리거나 등급을 조정하지 않습니다. 광고가 있는 자리에는 광고 표기를 함께 노출합니다." }
                }
                section id="corrections" class="mt-12 scroll-mt-20" {
                    h2 class="text-xl font-bold" { "7. 정정과 삭제 요청" }
                    p class="mt-3 text-base leading-relaxed" { "틀린 내용을 발견하셨다면 알려 주세요. 사전은 고쳐지면서 정확해지는 물건이라고 생각합니다. 다음 두 가지 경로를 씁니다." }
                    ul class="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed" {
                        li {
                            a class="text-accent-text underline underline-offset-2" href="/support" { "고객센터" }
                            " — 로그인 후 1:1 문의를 보내면 답변이 같은 화면에 기록됩니다. 진행 상황을 직접 확인할 수 있어 정정 요청에 권장합니다."
                        }
                        li {
                            "이메일 "
                            a href="mailto:toris@toris.kr" class="text-accent-text underline underline-offset-2" { "toris@toris.kr" }
                            " — 로그인 없이 보낼 수 있습니다. 저작권자 본인의 삭제 요청도 이 주소로 받습니다."
                        }
                    }
                    p class="mt-4 text-base leading-relaxed" {
                        "요청을 받으면 이렇게 처리합니다. "
                        strong { "사실 오류" }
                        "는 원래 근거를 다시 확인해 정정하거나, 확인이 안 되면 해당 서술을 내립니다."
                        strong { " 저작권자의 삭제 요청" }
                        "은 권리 확인 절차를 거칠 필요 없이 먼저 해당 임베드·링크를 내린 뒤 확인합니다. 원저작자의 뜻이 우선입니다. "
                        strong { "사용 안전 등급에 대한 이의" }
                        "는 근거로 든 용례를 다시 살펴보고, 등급을 조정하거나 왜 유지하는지 답변합니다."
                    }
                }
                section class="mt-12" {
                    h2 class="text-xl font-bold" { "8. 이 원칙의 한계" }
                    p class="mt-3 text-base leading-relaxed" { "밈캐치는 1인이 운영하는 사전입니다. 학술 기관이나 언론사의 검증 체계를 갖추고 있지 않고, 모든 항목을 같은 깊이로 확인하지도 못합니다. 사용 안전 신호는 관찰된 용례에 기반한 판단이지 어떤 공인된 기준도 아닙니다. 중요한 자리에서 쓸 표현이라면 이 사전을 참고 자료 중 하나로만 삼아 주세요. 그 한계를 감추지 않는 것이 이 문서를 공개하는 이유입니다." }
                    p class="mt-4 text-base leading-relaxed" {
                        "운영 주체와 연락처는 "
                        a class="text-accent-text underline underline-offset-2" href="/about" { "밈캐치 소개" }
                        "에, 개인정보 처리와 서비스 약관은 "
                        a class="text-accent-text underline underline-offset-2" href="/privacy" { "개인정보처리방침" }
                        "·"
                        a class="text-accent-text underline underline-offset-2" href="/terms" { "이용약관" }
                        "에 있습니다."
                    }
                }
            }
        }
    }
}
