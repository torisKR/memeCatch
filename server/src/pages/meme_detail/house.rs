//! A house original's media slot: `components/house-original-visual.tsx`
//! with the card `generateHouseMemeCardDataUrl` draws
//! (lib/meme-generator/image-generator.ts, the square card in the obsidian
//! coral theme). The card is an SVG data URL written here byte for byte as
//! the TypeScript writes it. The storyboard tab is a template that
//! `ui/house.js` swaps in.

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use maud::{Markup, html};

use crate::routes::js_json::number;

const WIDTH: f64 = 1080.0;
const HEIGHT: f64 = 1080.0;
const ACCENT: &str = "#ff6b4a";
/// `MemeEmbed`'s summary when the meme has none.
const DEFAULT_SUMMARY: &str = "밈캐치 자체 제작 오리지널 밈 콘텐츠입니다.";
/// The second line of the example dialogue the visual passes.
const DIALOGUE: &str = "이 밈을 센스 있게 사용해 보세요!";
const TAB_ON: &str = "bg-accent-strong text-white shadow-xs";
const TAB_OFF: &str = "text-muted hover:text-foreground";
const TAB: &str =
    "min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95";

fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// `generateHouseMemeCardSvg(meme, "square", "obsidian_coral")`.
fn card_svg(title: &str, summary: &str) -> String {
    let (w, h) = (WIDTH, HEIGHT);
    let n = |value: f64| number(value);
    let font = "-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif";
    let title = escape_xml(title);
    let summary = escape_xml(summary);
    let dialogue = escape_xml(&format!("\"{DIALOGUE}\""));
    let title_size = if w > 1100.0 { 76 } else { 64 };
    let summary_size = if w > 1100.0 { 32 } else { 28 };
    let (width, height) = (n(w), n(h));
    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#120e0d" />
      <stop offset="50%" stop-color="#26130f" />
      <stop offset="100%" stop-color="#4a1c12" />
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="{ACCENT}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="{ACCENT}" stop-opacity="0.4" />
    </linearGradient>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000" flood-opacity="0.5" />
    </filter>
  </defs>

  <!-- 배경 캔버스 -->
  <rect width="{width}" height="{height}" fill="url(#bgGrad)" />

  <!-- 장식용 기하학 그리드 라인 -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="1.5">
    <line x1="{x08}" y1="0" x2="{x08}" y2="{height}" />
    <line x1="{x92}" y1="0" x2="{x92}" y2="{height}" />
    <line x1="0" y1="{y12}" x2="{width}" y2="{y12}" />
    <line x1="0" y1="{y88}" x2="{width}" y2="{y88}" />
  </g>

  <!-- 중앙 글래스모피즘 메인 패널 -->
  <rect x="{x08}" y="{y10}" width="{w84}" height="{h80}" rx="32"
        fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2" filter="url(#cardShadow)" />

  <!-- 상단 태그 및 뱃지 -->
  <g transform="translate({x14}, {y18})">
    <rect width="180" height="42" rx="21" fill="url(#badgeGrad)" />
    <text x="90" y="27" font-family="{font}" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">
      ✨ 밈캐치 오리지널
    </text>

    <!-- 사용 안전 뱃지 -->
    <rect x="196" width="130" height="42" rx="21" fill="#22c55e" fill-opacity="0.2" stroke="#22c55e" stroke-width="1.5" />
    <text x="261" y="26" font-family="{font}" font-size="19" font-weight="700" fill="#4ade80" text-anchor="middle">
      ● 써도 됨
    </text>
  </g>

  <!-- 밈 메인 타이틀 -->
  <text x="{x14}" y="{y36}" font-family="{font}"
        font-size="{title_size}" font-weight="900" fill="#ffffff" letter-spacing="-1.5">
    {title}
  </text>

  <!-- 구분선 -->
  <line x1="{x14}" y1="{y42}" x2="{x86}" y2="{y42}" stroke="#ffffff" stroke-opacity="0.15" stroke-width="2" />

  <!-- 핵심 요약 설명 -->
  <foreignObject x="{x14}" y="{y46}" width="{w72}" height="{h20}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: {font}; font-size: {summary_size}px; font-weight: 500; color: #e4e4e7; line-height: 1.5; word-break: keep-all;">
      {summary}
    </div>
  </foreignObject>

  <!-- 실전 사용 말풍선 카드 -->
  <g transform="translate({x14}, {y66})">
    <rect width="{w72}" height="{h14}" rx="20" fill="#000000" fill-opacity="0.35" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5" />
    <text x="28" y="{h055}" font-family="{font}" font-size="20" font-weight="700" fill="{ACCENT}">
      💬 실전 톡 용례
    </text>
    <text x="28" y="{h10}" font-family="{font}" font-size="24" font-weight="600" fill="#ffffff">
      {dialogue}
    </text>
  </g>

  <!-- 하단 브랜드 로고 및 신뢰 마크 -->
  <g transform="translate({x14}, {y85})">
    <text x="0" y="0" font-family="{font}" font-size="22" font-weight="800" fill="#a1a1aa" letter-spacing="1">
      CATCHMEME · 자체 검증 데이터베이스
    </text>
    <text x="{w72}" y="0" font-family="{font}" font-size="20" font-weight="600" fill="#71717a" text-anchor="end">
      catchmeme.com
    </text>
  </g>
</svg>"##,
        x08 = n(w * 0.08),
        x92 = n(w * 0.92),
        y12 = n(h * 0.12),
        y88 = n(h * 0.88),
        y10 = n(h * 0.1),
        w84 = n(w * 0.84),
        h80 = n(h * 0.8),
        x14 = n(w * 0.14),
        y18 = n(h * 0.18),
        y36 = n(h * 0.36),
        y42 = n(h * 0.42),
        x86 = n(w * 0.86),
        y46 = n(h * 0.46),
        w72 = n(w * 0.72),
        h20 = n(h * 0.2),
        y66 = n(h * 0.66),
        h14 = n(h * 0.14),
        h055 = n(h * 0.055),
        h10 = n(h * 0.10),
        y85 = n(h * 0.85),
    )
}

/// `generateHouseMemeCardDataUrl`: the SVG as base64 of its UTF-8.
pub fn card_data_url(title: &str, summary: &str) -> String {
    format!(
        "data:image/svg+xml;base64,{}",
        STANDARD.encode(card_svg(title, summary))
    )
}

fn scene(time: &str, label: &str, line: &str, note: &str) -> Markup {
    html! {
        div class="rounded-xl border border-border bg-surface p-3.5" {
            div class="flex items-center justify-between" {
                span class="text-xs font-bold text-accent" { (time) }
                span class="text-xs text-muted" { (label) }
            }
            p class="mt-1 text-sm font-semibold" { (line) }
            p class="text-xs text-muted mt-0.5" { (note) }
        }
    }
}

/// `MemeEmbed` for a house original: the visual in a figure, on its card tab.
pub fn visual(title: &str, summary: &str) -> Markup {
    let summary = if summary.is_empty() {
        DEFAULT_SUMMARY
    } else {
        summary
    };
    html! {
        figure {
            div class="overflow-hidden rounded-2xl border border-border bg-surface-2 p-4 sm:p-6" data-house-visual data-tab-on=(TAB_ON) data-tab-off=(TAB_OFF) {
                div class="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3" {
                    div class="flex items-center gap-2" {
                        span class="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent" { "✨ 밈캐치 자체 제작" }
                        span class="text-xs text-muted" { "타 SNS 의존 없는 오리지널 콘텐츠" }
                    }
                    div class="flex gap-1.5 rounded-xl bg-surface p-1 border border-border/60" {
                        button type="button" class={(TAB) " " (TAB_ON)} data-house-tab="card" { "🎨 밈 카드" }
                        button type="button" class={(TAB) " " (TAB_OFF)} data-house-tab="storyboard" { "🎬 숏폼 스토리보드" }
                    }
                }
                div class="mt-4" {
                    div class="flex flex-col items-center" data-house-panel="card" {
                        div class="relative w-full max-w-md overflow-hidden rounded-xl shadow-lg border border-border" {
                            img src=(card_data_url(title, summary)) alt=(format!("{title} 자체 밈 카드")) class="w-full h-auto object-cover" loading="lazy";
                        }
                        p class="mt-2.5 text-xs text-muted" { "외부 플랫폼 링크 유실 걱정 없이 밈캐치 엔진으로 자체 렌더링된 공식 카드입니다." }
                    }
                    template data-house-storyboard {
                        div class="space-y-2.5" data-house-panel="storyboard" {
                            (scene("Scene 1 (00:00 - 00:03)", "타이틀 인트로", &format!("\"{title}\" 요즘 대세 밈 30초 완성"), "화면 중앙 볼드 타이포그래피 + 다이내믹 사운드"))
                            (scene("Scene 2 (00:03 - 00:08)", "핵심 뜻과 유래", summary, "상황을 직관적으로 보여주는 키 비주얼 및 요약 자막"))
                            (scene("Scene 3 (00:08 - 00:12)", "실전 톡 예시", "\"대화에서 실제로 어떻게 쓰는지 보여주기\"", "메신저 말풍선 인터랙션 애니메이션"))
                            (scene("Scene 4 (00:12 - 00:15)", "안전 사용 아웃트로", "초록불 — 일상에서 안전하게 써도 됨", "밈캐치 오리지널 검증 마크 노출"))
                        }
                    }
                }
            }
        }
    }
}
