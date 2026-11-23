//! The enum labels of `lib/labels.ts` and `lib/safety-copy.ts` that native
//! pages show, in Korean.

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
