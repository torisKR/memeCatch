//! The enum labels of `lib/labels.ts` and `lib/safety-copy.ts` that native
//! pages show, in Korean.

use maud::{Markup, html};

use super::meme_detail::signal_trace;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SafetyLevel {
    Green,
    Yellow,
    Gray,
    Red,
}

impl SafetyLevel {
    /// The column is a Postgres enum with these four values. `yellow` is its
    /// default, and the reading "check the context" is the careful one for a
    /// value this code does not know.
    pub fn parse(value: &str) -> Self {
        Self::parse_known(value).unwrap_or(Self::Yellow)
    }

    /// `None` for a value outside the enum (`isSafety` in lib/meme-seo-copy.ts).
    pub fn parse_known(value: &str) -> Option<Self> {
        Some(match value {
            "green" => Self::Green,
            "yellow" => Self::Yellow,
            "gray" => Self::Gray,
            "red" => Self::Red,
            _ => return None,
        })
    }

    pub fn token(self) -> &'static str {
        match self {
            Self::Green => "green",
            Self::Yellow => "yellow",
            Self::Gray => "gray",
            Self::Red => "red",
        }
    }

    /// `components/safety-icon.tsx`.
    pub fn icon(self, class: &str) -> Markup {
        let level = self;
        html! {
            svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" class=(class) data-safety-icon=(level.token()) aria-hidden="true" focusable="false" {
                @match level {
                    SafetyLevel::Green => {
                        path d="M4.75 12.35 9.2 16.8 19.25 6.75" {}
                        path d="M12 2.75a9.25 9.25 0 1 1-6.54 2.71" opacity=".32" {}
                    }
                    SafetyLevel::Yellow => {
                        path d="M5.25 4.25h13.5a2 2 0 0 1 2 2v8.25a2 2 0 0 1-2 2H10l-4.75 3v-3a2 2 0 0 1-2-2V6.25a2 2 0 0 1 2-2Z" {}
                        path d="M12 7.4v4.15M12 14.1h.01" {}
                    }
                    SafetyLevel::Gray => {
                        path d="M12 3.25a8.75 8.75 0 1 1-8.75 8.75A8.75 8.75 0 0 1 12 3.25Z" {}
                        path d="M12 7.1v5.25l3.35 2.05M3.3 5.35h3.15M2.25 8h2.1" {}
                    }
                    SafetyLevel::Red => {
                        path d="m8.35 2.75-5.6 5.6v7.3l5.6 5.6h7.3l5.6-5.6v-7.3l-5.6-5.6h-7.3Z" {}
                        path d="M7.25 12h9.5" {}
                    }
                }
            }
        }
    }

    /// `TONE` in `components/safety-badge.tsx`.
    pub fn tone(self) -> &'static str {
        match self {
            Self::Green => "bg-safety-green-bg text-safety-green",
            Self::Yellow => "bg-safety-yellow-bg text-safety-yellow",
            Self::Gray => "bg-safety-gray-bg text-safety-gray",
            Self::Red => "bg-safety-red-bg text-safety-red",
        }
    }

    /// `SAFETY_LEVELS[level].user`.
    pub fn label(self) -> &'static str {
        match self {
            Self::Green => "써도 됨",
            Self::Yellow => "맥락 주의",
            Self::Gray => "이미 늦음",
            Self::Red => "쓰면 위험",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Lifecycle {
    Rising,
    Active,
    Cooling,
    Archived,
}

impl Lifecycle {
    /// A Postgres enum with these four values; `active` is its default.
    pub fn parse(value: &str) -> Self {
        match value {
            "rising" => Self::Rising,
            "cooling" => Self::Cooling,
            "archived" => Self::Archived,
            _ => Self::Active,
        }
    }

    /// `LIFECYCLE_STATUS[status].user`.
    pub fn label(self) -> &'static str {
        match self {
            Self::Rising => "급상승",
            Self::Active => "유행 중",
            Self::Cooling => "식는 중",
            Self::Archived => "추억 밈",
        }
    }

    /// `STROKE` in `components/signal-trace.tsx`.
    pub fn stroke(self) -> &'static str {
        match self {
            Self::Rising => "text-(--flame-500)",
            Self::Active => "text-(--life-active)",
            Self::Cooling => "text-(--life-cooling)",
            Self::Archived => "text-(--life-archived)",
        }
    }

    pub fn trace(self) -> &'static str {
        match self {
            Self::Rising => signal_trace::RISING,
            Self::Active => signal_trace::ACTIVE,
            Self::Cooling => signal_trace::COOLING,
            Self::Archived => signal_trace::ARCHIVED,
        }
    }

    /// The dot at the head of the trace: only while the signal is alive.
    pub fn live(self) -> bool {
        matches!(self, Self::Rising | Self::Active)
    }

    /// Only the rising trace is drawn in.
    pub fn draws(self) -> bool {
        self == Self::Rising
    }
}

/// `CategoryTag` (components/category-tag.tsx) with its glyph. `None` for a
/// value outside the enum.
pub fn category_tag(category: &str, class: &str) -> Option<Markup> {
    let label = category_label(category)?;
    let tone = match category {
        "phrase" => "bg-cat-phrase-bg text-cat-phrase-text",
        "song" => "bg-cat-song-bg text-cat-song-text",
        "image" => "bg-cat-image-bg text-cat-image-text",
        "comment" => "bg-cat-comment-bg text-cat-comment-text",
        _ => "bg-cat-dance-bg text-cat-dance-text",
    };
    Some(html! {
        span class={"hover-glow-flame inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-transparent px-2.5 py-1 text-[13px] font-semibold leading-none " (tone) " " (class)} {
            svg viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {
                @match category {
                    "phrase" => { path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15.5H10l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 14V7A1.5 1.5 0 0 1 5 5.5Z" {} }
                    "song" => { path d="M9 18V5l9-2v11" {} circle cx="6.5" cy="18" r="2.5" {} }
                    "image" => {
                        rect x="3.5" y="5" width="17" height="14" rx="2" {}
                        circle cx="8.5" cy="9.5" r="1.4" {}
                        path d="m4 17 5-4.5L14 17l3-2.5 3 2.5" {}
                    }
                    "comment" => {
                        path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15.5H10l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 14V7A1.5 1.5 0 0 1 5 5.5Z" {}
                        circle cx="8.5" cy="10.5" r=".65" fill="currentColor" stroke="none" {}
                        circle cx="12" cy="10.5" r=".65" fill="currentColor" stroke="none" {}
                        circle cx="15.5" cy="10.5" r=".65" fill="currentColor" stroke="none" {}
                    }
                    _ => {
                        path d="M9 17V6.5l9-2.5V14" {}
                        circle cx="6.5" cy="17" r="2.5" {}
                        circle cx="15.5" cy="14" r="2.5" {}
                    }
                }
            }
            (label)
        }
    })
}

/// `CATEGORIES[category].user`. `None` for a value outside the enum.
pub fn category_label(category: &str) -> Option<&'static str> {
    Some(match category {
        "phrase" => "밈 용어(유행어)",
        "dance" | "challenge" => "챌린지 댄스",
        "song" => "노래",
        "image" => "밈 영상",
        "comment" => "드라마 장면",
        _ => return None,
    })
}

/// `resolveDisplayCategory`: the `category` value of the explore link.
pub fn display_category(category: &str) -> Option<&'static str> {
    Some(match category {
        "phrase" => "meme_term",
        "dance" | "challenge" => "challenge_dance",
        "song" => "song",
        "image" => "meme_video",
        "comment" => "drama_scene",
        _ => return None,
    })
}
