//! `GET /admin/memes/new` (`app/(default)/admin/memes/new/page.tsx`):
//! `HouseOriginalForm` as it first renders; `ui/admin-memes.js` runs the
//! draft studio (`/api/admin/meme-studio`) and `createHouseOriginal`
//! (`routes/admin/memes.rs`).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use serde_json::json;

use super::fields::{CATEGORIES, CONTEXTS, DIFFICULTIES, safety_select};
use super::shell::Root;
use crate::AppState;
use crate::routes::studio::COUNTRIES;

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    if let Err(redirect) = super::require_operator(
        &state,
        request.headers(),
        request.uri().path(),
        request.uri().query(),
    )
    .await
    {
        return redirect;
    }
    let main = html! {
        div class="space-y-6" {
            div {
                a href="/admin/memes" class="text-base text-muted hover:text-foreground" { "← 밈 관리로" }
                h1 class="mt-2 text-2xl font-bold" { "자체 제작 등록" }
            }
            (form())
        }
    };
    super::screen(
        &state,
        Root::Site,
        "자체 제작 등록",
        "/admin/memes/new",
        main,
    )
}

/// `houseOriginalOperatorPath(status)`: each step's label, state and the
/// state's label.
pub fn operator_path(status: &str) -> Vec<(&'static str, &'static str, &'static str)> {
    const STEPS: [&str; 4] = ["대기", "사실 확인", "권리 확인", "수동 게시"];
    let published = matches!(status, "approved" | "limited");
    let rejected = status == "rejected";
    let current = if published {
        STEPS.len()
    } else {
        match status {
            "fact_checking" => 1,
            "rights_checking" => 2,
            _ => 0,
        }
    };
    STEPS
        .iter()
        .enumerate()
        .map(|(i, label)| {
            let state = if rejected {
                if i == STEPS.len() - 1 {
                    "blocked"
                } else if i == 0 {
                    "done"
                } else {
                    "upcoming"
                }
            } else if published || i < current {
                "done"
            } else if i == current {
                "current"
            } else {
                "upcoming"
            };
            let state_label = match state {
                "done" => "완료",
                "current" => "진행",
                "upcoming" => "남음",
                _ => "중단",
            };
            (*label, state, state_label)
        })
        .collect()
}

/// The steps as `HouseOriginalForm` and `MemeStatusControls` list them.
pub fn path_steps(status: &str) -> Markup {
    html! {
        @for (i, (label, state, state_label)) in operator_path(status).into_iter().enumerate() {
            @let class = if state == "current" { "bg-safety-yellow-bg text-safety-yellow" } else { "bg-surface-2 text-muted" };
            li aria-current=[(state == "current").then_some("step")] class=(format!("rounded-lg px-3 py-2 text-sm {class}")) {
                span class="mr-1 tabular-nums" { (i + 1) "." }
                (label)
                span class="ml-1 text-xs" { "(" (state_label) ")" }
            }
        }
    }
}

/// `houseOriginalPathNote()`.
pub const PATH_NOTE: &str = "대기 → 사실 확인 → 권리 확인 → 운영자가 확인란을 치고 수동 게시합니다. 자동 게시하지 않습니다.";

const INPUT: &str = "min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base";
const TONES: [(&str, &str); 4] = [
    ("wholesome", "다정하게"),
    ("sarcastic", "시니컬하게"),
    ("absurd", "황당하게"),
    ("hype", "신나게"),
];
const FORMATS: [(&str, &str); 3] = [
    ("image-macro", "이미지 문구"),
    ("reaction", "리액션"),
    ("caption", "게시물 캡션"),
];

fn form() -> Markup {
    let countries = json!(
        COUNTRIES
            .iter()
            .map(|c| (c.code, c.label))
            .collect::<std::collections::BTreeMap<_, _>>()
    )
    .to_string();
    html! {
        form class="space-y-4 rounded-xl border border-border bg-surface p-5" data-admin-controls="house-original" data-admin-countries=(countries) {
            p class="rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed" {
                "밈캐치가 직접 만든 사전 항목만 등록합니다. 인터넷 밈을 카탈로그로 옮기거나 AI 초안을 자동 게시하지 않습니다. 저장하면 "
                strong { "대기(pending)" }
                "만 만들어지고, 사실 확인과 권리 확인은 따로 진행합니다."
            }
            ol aria-label="자체 제작 검수 경로" class="grid gap-2 sm:grid-cols-4" { (path_steps("pending")) }
            p class="text-sm leading-relaxed text-muted" { (PATH_NOTE) }
            section aria-label="자체 밈 초안 생성" class="space-y-3 rounded-xl border border-accent bg-accent-soft p-4" data-admin-studio {
                div {
                    h2 class="text-lg font-bold" { "SNS 없이 자체 초안 만들기" }
                    p class="mt-1 text-sm leading-relaxed text-muted" { "주제와 국가를 고르면 Bedrock 초안 3개를 만듭니다. 생성 예산을 사용할 수 없거나 일시 장애가 나면 저장 가능한 초안을 만들지 않으며, 초안을 고르기 전에는 저장하지 않습니다." }
                }
                label class="block" {
                    span class="mb-1 block text-sm font-medium" { "자체 밈 주제" }
                    input maxlength="120" placeholder="예: 회의가 5분 일찍 끝난 날" class=(INPUT) value="" data-admin-field="topic";
                }
                div class="grid gap-3 sm:grid-cols-3" {
                    label class="block" {
                        span class="mb-1 block text-sm font-medium" { "밈 국가" }
                        select class=(INPUT) data-admin-field="country" {
                            @for country in COUNTRIES { option value=(country.code) selected[country.code == "KR"] { (country.label) } }
                        }
                    }
                    label class="block" {
                        span class="mb-1 block text-sm font-medium" { "초안 분위기" }
                        select class=(INPUT) data-admin-field="tone" {
                            @for (value, label) in TONES { option value=(value) selected[value == "hype"] { (label) } }
                        }
                    }
                    label class="block" {
                        span class="mb-1 block text-sm font-medium" { "초안 형식" }
                        select class=(INPUT) data-admin-field="format" {
                            @for (value, label) in FORMATS { option value=(value) selected[value == "caption"] { (label) } }
                        }
                    }
                }
                button type="button" disabled class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50" data-admin-generate { "자체 밈 초안 3개 만들기" }
            }
            label class="block" {
                span class="mb-1 block text-base font-medium" { "제목" }
                input required class=(INPUT) value="" data-admin-field="title";
            }
            label class="block" {
                span class="mb-1 block text-base font-medium" { "한 줄 요약" }
                input required class=(INPUT) value="" data-admin-field="summary";
            }
            label class="block" {
                span class="mb-1 block text-base font-medium" { "설명" }
                textarea rows="5" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base" data-admin-field="description" {}
            }
            label class="block" {
                span class="mb-1 block text-base font-medium" { "어떻게 만들었나요?" }
                textarea rows="4" aria-describedby="house-origin-hint" class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base" data-admin-field="origin" {}
            }
            p id="house-origin-hint" class="-mt-2 text-sm text-muted" { "밈캐치가 이 형식을 만든 경위. 검수 메모나 게시 여부를 쓰지 말고, 인터넷 원출처나 연도를 지어내지 마세요." }
            div class="grid gap-3 sm:grid-cols-3" {
                (safety_select("신호등", "safetyLevel", "yellow"))
                label class="block" {
                    span class="mb-1 block text-base font-medium" { "분류" }
                    select class=(INPUT) data-admin-field="category" {
                        @for (value, label) in CATEGORIES { option value=(value) selected[value == "phrase"] { (label) } }
                    }
                }
                label class="block" {
                    span class="mb-1 block text-base font-medium" { "난이도" }
                    select class=(INPUT) data-admin-field="difficulty" {
                        @for (value, label) in DIFFICULTIES { option value=(value) selected[value == "normal"] { (label) } }
                    }
                }
            }
            label class="block sm:max-w-xs" {
                span class="mb-1 block text-base font-medium" { "제작 연도 (선택)" }
                input inputmode="numeric" placeholder="2026" class=(INPUT) value="" data-admin-field="originYear";
            }
            fieldset {
                legend class="mb-2 text-base font-medium" { "상황별 신호등" }
                div class="grid gap-3 sm:grid-cols-2" {
                    @for (key, label, level) in CONTEXTS { (safety_select(label, key, level)) }
                }
            }
            button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50" { "대기로 저장" }
        }
    }
}
