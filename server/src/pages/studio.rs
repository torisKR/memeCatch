//! `GET /studio` (`app/(default)/studio/page.tsx`): `MemeStudioApp` with
//! the AI generation off, as the server renders it (the ideas workspace,
//! "신나게" and "게시물 캡션" chosen, no topic; the artifact workspace hidden,
//! the image meme chosen, the rights not confirmed). No data is read.
//!
//! What happens in the browser is `ui/studio.js` (its own bundle, with
//! `components/studio/meme-artifacts.ts`): the choices, `POST
//! /api/meme-studio` and the concepts to copy, the reference search on the
//! topic, and the canvas PNGs. The dictionary card's form is a template the
//! script clones, as React mounts it.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};

use super::document::{self, Head, ShareImage};
use super::documents::PRERENDERED_PAGE_CACHE;
use super::{html_cached, path_and_query};
use crate::AppState;
use crate::routes::public::js::trim as js_trim;

const TITLE: &str = "밈 스튜디오";
const DESCRIPTION: &str =
    "게시물 아이디어를 만들고, 내가 권리를 가진 이미지로 PNG 밈과 사전 카드를 출력합니다.";
const SELECTED: &str = "border-accent bg-accent-strong text-white";
const UNSELECTED: &str =
    "border-border bg-surface text-muted hover:border-accent hover:text-accent";
const FOCUS: &str =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const FIELD: &str = "mt-1.5 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none transition-colors focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none sm:text-sm";
const BUTTON: &str = "inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-[filter,opacity,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:active:scale-100 motion-reduce:transition-none";
/// `UPLOAD_ACCEPT` of lib/upload-shared.ts: the keys of `ALLOWED_IMAGE_TYPES`.
const UPLOAD_ACCEPT: &str = "image/jpeg,image/png,image/webp,image/gif";
/// `IMAGE_PRESETS` of components/studio/meme-artifacts.ts.
const PRESETS: [(&str, &str); 3] = [
    ("square", "정사각형 1080"),
    ("vertical", "세로 1080 × 1920"),
    ("landscape", "가로 1200 × 630"),
];
const TONES: [(&str, &str, &str); 4] = [
    ("wholesome", "다정하게", "따뜻함 · 응원"),
    ("sarcastic", "시니컬하게", "건조함 · 빈정거림"),
    ("absurd", "황당하게", "엉뚱함 · 혼돈"),
    ("hype", "신나게", "과장 · 주인공 느낌"),
];
const FORMATS: [(&str, &str); 3] = [
    ("image-macro", "이미지 문구"),
    ("reaction", "리액션"),
    ("caption", "게시물 캡션"),
];
const TONE: &str = "hype";
const FORMAT: &str = "caption";

fn look(active: bool) -> &'static str {
    if active { SELECTED } else { UNSELECTED }
}

fn workspaces() -> Markup {
    let options = [
        ("ideas", "아이디어 생성", "토픽에 맞는 문구 3개 만들기"),
        (
            "artifacts",
            "내 콘텐츠 출력",
            "이미지와 사전 카드를 PNG로 만들기",
        ),
    ];
    html! {
        div class="rounded-2xl border border-border bg-surface-2 p-2" {
            div role="group" aria-label="스튜디오 작업 공간" class="grid gap-2 sm:grid-cols-2" {
                @for (value, label, hint) in options {
                    @let active = value == "ideas";
                    button type="button" aria-pressed=(active) aria-controls=(format!("studio-workspace-{value}")) data-studio-workspace=(value)
                        class=(format!("min-h-11 rounded-xl border px-4 py-2.5 text-left transition-colors {FOCUS} motion-reduce:transition-none {}", look(active))) {
                        span class="block text-base font-bold sm:text-sm" { (label) }
                        span class=(format!("block text-xs {}", if active { "text-white/85" } else { "text-muted" })) { (hint) }
                    }
                }
            }
        }
    }
}

fn ideas() -> Markup {
    html! {
        div id="studio-workspace-ideas" class="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start" {
            section aria-label="밈 아이디어 입력" class="rounded-2xl border border-border bg-surface p-5 sm:p-6" {
                label for="studio-topic" class="block text-sm font-bold" { "어떤 내용인가요?" }
                input id="studio-topic" type="text" maxlength="120" placeholder="예: 내 의자를 뺏은 고양이" class=(format!("mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition-colors focus:border-accent {FOCUS} motion-reduce:transition-none sm:text-sm")) name="topic" value="";
                fieldset class="mt-5" {
                    legend class="text-sm font-bold" { "분위기" }
                    div class="mt-2 grid grid-cols-2 gap-2" {
                        @for (value, label, hint) in TONES {
                            @let active = value == TONE;
                            button type="button" aria-pressed=(active) data-studio-tone=(value)
                                class=(format!("min-h-11 rounded-xl border px-3 py-2.5 text-left transition-colors {FOCUS} motion-reduce:transition-none {}", look(active))) {
                                span class="block text-sm font-bold" { (label) }
                                span class=(format!("block text-xs {}", if active { "text-white/80" } else { "" })) { (hint) }
                            }
                        }
                    }
                }
                fieldset class="mt-5" {
                    legend class="text-sm font-bold" { "형식" }
                    div class="mt-2 flex flex-wrap gap-2" {
                        @for (value, label) in FORMATS {
                            button type="button" aria-pressed=(value == FORMAT) data-studio-format=(value)
                                class=(format!("inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors {FOCUS} {}", look(value == FORMAT))) { (label) }
                        }
                    }
                }
                button type="button" disabled data-studio-generate class="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-strong px-6 text-base font-bold text-white transition-[filter,opacity,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:active:scale-100 motion-reduce:transition-none" { "밈 아이디어 만들기" }
                p class="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm leading-relaxed text-muted" { "기본 템플릿으로 아이디어를 만듭니다." }
                // `MemeReferenceSearch variant="studio"` with no topic.
                section aria-label="제작 참고 밈" class="mt-4 rounded-2xl border border-border bg-surface p-4" data-studio-reference {
                    button type="button" disabled class="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50" { "제작 참고 밈 찾기" }
                    p class="mt-2 text-xs text-muted" { "참고 자료이며 재사용 권한은 별도로 확인해 주세요." }
                    div role="status" aria-live="polite" class="mt-3 text-sm text-muted" {}
                }
            }
            section aria-label="생성된 밈 아이디어" aria-live="polite" aria-busy="false" class="min-w-0" data-studio-results {
                div class="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center" {
                    p class="text-lg font-extrabold" { "아직 만든 아이디어가 없습니다" }
                    p class="max-w-sm text-sm leading-relaxed text-muted" { "토픽과 분위기, 형식을 고른 뒤 아이디어 만들기를 눌러 주세요." }
                }
            }
        }
    }
}

fn preset_select() -> Markup {
    html! {
        label class="block text-sm font-bold" {
            "출력 크기"
            select aria-label="출력 크기" name="artifact-preset" class=(FIELD) {
                @for (value, label) in PRESETS {
                    option value=(value) selected[value == "square"] { (label) }
                }
            }
        }
    }
}

/// The two buttons and the canvas with its placeholder.
fn output(render: &str, canvas: &str, placeholder: &str) -> (Markup, Markup) {
    let buttons = html! {
        div class="flex flex-wrap gap-2" {
            button type="button" class=(BUTTON) disabled { (render) }
            button type="button" class=(BUTTON) disabled { "PNG 내려받기" }
        }
    };
    let view = html! {
        div class="min-w-0 rounded-2xl border border-border bg-surface-2 p-3" {
            canvas aria-label=(canvas) class="mx-auto max-h-[650px] w-full object-contain hidden" {}
            p class="grid min-h-56 place-items-center text-center text-sm text-muted" { (placeholder) }
        }
    };
    (buttons, view)
}

/// `ImageArtifact` before a file is chosen.
fn image_artifact() -> Markup {
    let (buttons, view) = output(
        "미리보기 렌더",
        "밈 이미지 결과",
        "권리를 확인하고 이미지를 선택한 뒤 미리보기를 렌더하세요.",
    );
    html! {
        div class="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]" data-studio-artifact {
            div class="space-y-4" {
                label class="block text-sm font-bold" {
                    "내 이미지 업로드"
                    input aria-label="내 이미지 업로드" type="file" accept=(UPLOAD_ACCEPT) class=(FIELD) name="image-file";
                }
                label class="block text-sm font-bold" { "상단 문구" input maxlength="140" class=(FIELD) name="image-top-text" value=""; }
                label class="block text-sm font-bold" { "하단 문구" input maxlength="140" class=(FIELD) name="image-bottom-text" value=""; }
                label class="block text-sm font-bold" {
                    "출처 표기 " span class="font-normal text-muted" { "(필수)" }
                    input aria-label="이미지 출처 표기" maxlength="100" placeholder="예: 직접 제작" class=(FIELD) name="image-attribution" value="";
                }
                (preset_select())
                (buttons)
            }
            (view)
        }
    }
}

/// `DictionaryArtifact`'s fields filled from `defaults` (`dictionaryDefaults`).
#[derive(Default)]
pub struct DictionaryDefaults {
    pub name: String,
    pub summary: String,
    pub safety: String,
    pub detail_url: String,
    pub source: String,
}

/// `DictionaryArtifact` with no defaults, for the script to clone.
fn dictionary_artifact() -> Markup {
    dictionary_artifact_with(&DictionaryDefaults::default())
}

/// `DictionaryArtifact` filled from `defaults`.
fn dictionary_artifact_with(defaults: &DictionaryDefaults) -> Markup {
    // `isValidDetailUrl`: an https URL with a host.
    let invalid = !defaults.detail_url.is_empty()
        && !url::Url::parse(js_trim(&defaults.detail_url)).is_ok_and(|url| {
            url.scheme() == "https" && url.host_str().is_some_and(|host| !host.is_empty())
        });
    let (buttons, view) = output(
        "사전 카드 렌더",
        "밈 사전 카드 결과",
        "이름·정의·출처를 입력하면 사전 카드를 만들 수 있어요.",
    );
    html! {
        div class="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]" data-studio-artifact {
            div class="space-y-4" {
                p class="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted" { "외부 SNS 이미지는 복사하지 않고 밈캐치 자체 그래픽과 입력한 텍스트만 사용합니다." }
                label class="block text-sm font-bold" { "밈 이름" input name="dictionary-name" value=(defaults.name) class=(FIELD); }
                label class="block text-sm font-bold" { "한 줄 정의" textarea name="dictionary-summary" rows="3" class=(FIELD) { (defaults.summary) } }
                label class="block text-sm font-bold" { "사용 안전 신호" input name="dictionary-safety" value=(defaults.safety) placeholder="예: 친한 사이에서만 권장" class=(FIELD); }
                label class="block text-sm font-bold" { "상세 URL" input name="dictionary-detail-url" type="url" value=(defaults.detail_url) aria-invalid=[invalid.then_some("true")] placeholder="https://catchmeme.com/memes/밈-이름" class=(FIELD); }
                @if invalid { p role="alert" class="text-sm text-accent-text" { "https로 시작하는 올바른 주소를 입력해 주세요." } }
                label class="block text-sm font-bold" {
                    "텍스트 출처 " span class="font-normal text-muted" { "(필수)" }
                    input aria-label="사전 카드 출처 표기" name="dictionary-source" value=(defaults.source) placeholder="예: 직접 제작" class=(FIELD);
                }
                (preset_select())
                (buttons)
            }
            (view)
        }
    }
}

/// `<ArtifactStudio dictionaryOnly dictionaryDefaults>` of the meme editor:
/// the rights checkbox and the dictionary card, no choice of output.
pub fn dictionary_studio(defaults: &DictionaryDefaults) -> Markup {
    html! {
        section class="rounded-2xl border border-border bg-background p-4 sm:p-6" aria-labelledby="artifact-studio-title" data-admin-controls="dictionary-studio" {
            h2 id="artifact-studio-title" class="text-2xl font-extrabold" { "내 콘텐츠 출력" }
            p class="mt-2 text-sm leading-relaxed text-muted" { "이미지 밈과 사전 카드를 브라우저 안에서 만들고 PNG로 내려받습니다. 파일은 서버에 업로드되지 않습니다." }
            label class="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm font-semibold" {
                input name="rights-confirmed" type="checkbox" class="mt-0.5 size-5";
                span { "이 파일을 편집하고 출력할 권리가 있으며, 제3자의 권리를 침해하지 않음을 확인합니다." }
            }
            p role="status" class="mt-2 text-sm text-muted" { "렌더와 다운로드 전에 권리 확인이 필요합니다." }
            (dictionary_artifact_with(defaults))
        }
    }
}

fn artifacts() -> Markup {
    html! {
        div id="studio-workspace-artifacts" hidden class="mt-6" {
            section class="rounded-2xl border border-border bg-background p-4 sm:p-6" aria-labelledby="artifact-studio-title" {
                h2 id="artifact-studio-title" class="text-2xl font-extrabold" { "내 콘텐츠 출력" }
                p class="mt-2 text-sm leading-relaxed text-muted" { "이미지 밈과 사전 카드를 브라우저 안에서 만들고 PNG로 내려받습니다. 파일은 서버에 업로드되지 않습니다." }
                label class="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm font-semibold" {
                    input type="checkbox" class="mt-0.5 size-5" name="rights-confirmed";
                    span { "이 파일을 편집하고 출력할 권리가 있으며, 제3자의 권리를 침해하지 않음을 확인합니다." }
                }
                p role="status" class="mt-2 text-sm text-muted" { "렌더와 다운로드 전에 권리 확인이 필요합니다." }
                div role="group" aria-label="출력 종류" class="my-5 flex flex-wrap gap-2" {
                    @for (value, label) in [("image", "이미지 밈"), ("dictionary", "사전 카드")] {
                        button type="button" aria-pressed=(value == "image") data-studio-mode=(value)
                            class=(format!("min-h-11 rounded-full border px-4 text-sm font-bold transition-colors {FOCUS} motion-reduce:transition-none {}", look(value == "image"))) { (label) }
                    }
                }
                (image_artifact())
                template data-studio-dictionary { (dictionary_artifact()) }
            }
        }
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let site = &state.pages.site;
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        canonical: Some("/studio".to_owned()),
        image: Some(ShareImage::site_default(site)),
        alternate_locales: true,
        script: Some("studio"),
        ..Head::default()
    };
    let main = html! {
        main class="bg-background text-foreground" data-studio {
            div class="mx-auto max-w-site px-4 pb-16 pt-8 sm:pt-10" {
                header class="max-w-3xl" {
                    p class="text-sm font-bold text-accent" { "밈 스튜디오" }
                    h1 class="mt-1.5 text-3xl font-extrabold tracking-tight sm:text-4xl" { "아이디어를 만들고, 내 콘텐츠로 출력하세요" }
                    p class="mt-3 text-base leading-relaxed text-muted sm:text-sm" { "두 작업 공간을 오가며 문구를 구상하고, 권리를 확인한 이미지로 PNG 밈과 사전 카드를 만들 수 있습니다." }
                }
                div class="mt-8" {
                    (workspaces())
                    (ideas())
                    (artifacts())
                }
            }
        }
    };
    // A static page.
    html_cached(
        StatusCode::OK,
        PRERENDERED_PAGE_CACHE,
        document::page(site, &head, path_and_query(&request), main),
    )
}
