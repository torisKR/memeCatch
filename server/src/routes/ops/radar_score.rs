//! What the radar does with a stored signal, from `lib/trend/radar.ts`:
//! `matchRadarEntity` (which meme a signal names, and how surely),
//! `calculateRadarSignal` (a meme's heat and confidence from its matched
//! signals) and `recommendRadarState` (the state that heat points to).
//! `radar.rs` runs them in `runRadarPulse`'s order.

use super::radar_text::{hashtags, normalize_hashtag, normalize_text};
use crate::routes::public::js;
use crate::routes::unicode_classes::{LETTER_OR_NUMBER, contains};

/// `RadarState`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum State {
    Candidate,
    Rising,
    Trending,
    Cooling,
    Archive,
}

impl State {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Candidate => "candidate",
            Self::Rising => "rising",
            Self::Trending => "trending",
            Self::Cooling => "cooling",
            Self::Archive => "archive",
        }
    }

    /// A `radar_meme_state.current_state` (the column's check allows these).
    pub fn parse(value: &str) -> Option<Self> {
        [
            Self::Candidate,
            Self::Rising,
            Self::Trending,
            Self::Cooling,
            Self::Archive,
        ]
        .into_iter()
        .find(|state| state.as_str() == value)
    }

    /// `stateFromLifecycle`.
    pub fn from_lifecycle(value: &str) -> Self {
        match value {
            "rising" => Self::Rising,
            "cooling" => Self::Cooling,
            "archived" => Self::Archive,
            _ => Self::Trending,
        }
    }
}

/// A `RadarMeme`.
pub struct Entity {
    pub id: String,
    pub canonical_name: String,
    pub aliases: Vec<String>,
    pub state: State,
}

/// A `RadarMatch` without `matchedValue`, which nothing stores.
#[derive(Debug, PartialEq)]
pub struct Match<'a> {
    pub entity_id: &'a str,
    pub method: &'static str,
    pub confidence: f64,
}

/// `normalizeMatchValue`: the radar text with every run of characters that
/// are not `[\p{L}\p{N}_]` read as one space.
fn match_value(value: &str) -> String {
    let words: String = normalize_text(value)
        .chars()
        .map(|c| {
            if c == '_' || contains(&LETTER_OR_NUMBER, c) {
                c
            } else {
                ' '
            }
        })
        .collect();
    js::trim(&js::collapse_spaces(&words)).to_owned()
}

/// `matchRadarEntity`: the most confident match over every name of every
/// meme. Equal confidences mean the same method; the smaller id wins, as
/// `localeCompare` orders lower-case UUIDs. Among one meme's names of the
/// same method the TypeScript breaks the tie on the name, which is not kept.
pub fn match_entity<'a>(text: &str, entities: &'a [Entity]) -> Option<Match<'a>> {
    let text_value = match_value(text);
    let tags = hashtags(text);
    let mut best: Option<Match<'a>> = None;
    for entity in entities {
        let names = std::iter::once(&entity.canonical_name).chain(&entity.aliases);
        for (index, name) in names.enumerate() {
            let term = match_value(name);
            if term.is_empty() {
                continue;
            }
            let canonical = index == 0;
            let (method, confidence) = if text_value == term {
                pick(canonical, ("canonical_exact", 0.99), ("alias_exact", 0.96))
            } else if tags.contains(&normalize_hashtag(name)) {
                pick(
                    canonical,
                    ("canonical_hashtag", 0.94),
                    ("alias_hashtag", 0.91),
                )
            } else if format!(" {text_value} ").contains(&format!(" {term} ")) {
                pick(
                    canonical,
                    ("canonical_phrase", 0.87),
                    ("alias_phrase", 0.83),
                )
            } else {
                continue;
            };
            let better = best.as_ref().is_none_or(|best| {
                confidence > best.confidence
                    || (confidence == best.confidence && entity.id.as_str() < best.entity_id)
            });
            if better {
                best = Some(Match {
                    entity_id: &entity.id,
                    method,
                    confidence,
                });
            }
        }
    }
    best
}

fn pick(
    canonical: bool,
    canonical_match: (&'static str, f64),
    alias_match: (&'static str, f64),
) -> (&'static str, f64) {
    if canonical {
        canonical_match
    } else {
        alias_match
    }
}

/// A `RadarObservation`; `observed_ms` is `Date.parse` of its `observedAt`
/// (`NaN` when it is not a time).
pub struct Observation<'a> {
    pub platform: &'a str,
    pub observed_ms: f64,
    pub volume: f64,
    pub velocity: f64,
    pub engagement: f64,
    pub reliability: f64,
}

/// The parts of `RadarSignalScore` the radar keeps.
#[derive(Debug, PartialEq)]
pub struct Score {
    pub heat: f64,
    pub confidence: f64,
    pub aggregated_platforms: Vec<String>,
    pub excluded_platforms: Vec<String>,
}

const FRESHNESS_WINDOW_HOURS: f64 = 48.0;
const CONFIDENCE_PLATFORM_TARGET: f64 = 3.0;
const EXCLUDED_PLATFORMS: [&str; 2] = ["youtube", "youtube_shorts"];

/// `isRadarAggregationPlatform`.
pub fn is_aggregation_platform(platform: &str) -> bool {
    !EXCLUDED_PLATFORMS.contains(&platform.to_lowercase().as_str())
}

fn clamp(value: f64, minimum: f64, maximum: f64) -> f64 {
    if value.is_finite() {
        value.max(minimum).min(maximum)
    } else {
        minimum
    }
}

/// `round`: `Math.round((value + Number.EPSILON) * 10 ** decimals) / 10 ** decimals`.
/// The values are never negative, where `f64::round` and `Math.round` agree.
fn round(value: f64, decimals: i32) -> f64 {
    let scale = 10_f64.powi(decimals);
    ((value + f64::EPSILON) * scale).round() / scale
}

#[derive(Default)]
struct PlatformScore {
    weighted_heat: f64,
    weighted_reliability: f64,
    weight: f64,
}

/// `calculateRadarSignal` with the default 48-hour window and three-platform
/// confidence target. Platforms are summed in the order they first appear,
/// as the TypeScript's `Map` does.
pub fn score(observations: &[Observation<'_>], reference_ms: f64) -> Score {
    let mut platforms: Vec<(String, PlatformScore)> = Vec::new();
    let mut excluded = Vec::new();
    for observation in observations {
        if !is_aggregation_platform(observation.platform) {
            excluded.push(observation.platform.to_owned());
            continue;
        }
        let age_hours = if observation.observed_ms.is_finite() {
            (reference_ms - observation.observed_ms).max(0.0) / 3_600_000.0
        } else {
            FRESHNESS_WINDOW_HOURS
        };
        let freshness = clamp(1.0 - age_hours / FRESHNESS_WINDOW_HOURS, 0.0, 1.0);
        let heat = clamp(observation.velocity, 0.0, 100.0) * 0.5
            + clamp(observation.engagement, 0.0, 100.0) * 0.3
            + clamp(observation.volume, 0.0, 100.0) * 0.2;
        let reliability = clamp(observation.reliability, 0.0, 1.0);
        let weight = freshness.max(0.05) * reliability.max(0.05);
        let key = observation.platform.to_lowercase();
        let index = match platforms.iter().position(|(name, _)| *name == key) {
            Some(index) => index,
            None => {
                platforms.push((key, PlatformScore::default()));
                platforms.len() - 1
            }
        };
        let current = &mut platforms[index].1;
        current.weighted_heat += heat * freshness * weight;
        current.weighted_reliability += reliability * weight;
        current.weight += weight;
    }
    let count = platforms.len() as f64;
    let mean = |part: fn(&PlatformScore) -> f64| {
        if platforms.is_empty() {
            0.0
        } else {
            platforms
                .iter()
                .fold(0.0, |sum, (_, score)| sum + part(score) / score.weight)
                / count
        }
    };
    let heat = mean(|score| score.weighted_heat);
    let reliability = mean(|score| score.weighted_reliability);
    let coverage = clamp(count / CONFIDENCE_PLATFORM_TARGET, 0.0, 1.0);
    let mut aggregated: Vec<String> = platforms.into_iter().map(|(name, _)| name).collect();
    aggregated.sort();
    Score {
        heat: round(clamp(heat, 0.0, 100.0), 2),
        confidence: round(clamp(reliability * 0.65 + coverage * 0.35, 0.0, 1.0), 4),
        aggregated_platforms: aggregated,
        excluded_platforms: excluded,
    }
}

const RISING_HEAT: f64 = 45.0;
const RISING_CONFIDENCE: f64 = 0.45;
const TRENDING_HEAT: f64 = 70.0;
const TRENDING_CONFIDENCE: f64 = 0.6;
const COOLING_HEAT: f64 = 50.0;
const ARCHIVE_HEAT: f64 = 25.0;

/// `recommendRadarState` with `DEFAULT_RADAR_STATE_THRESHOLDS`.
pub fn recommend(state: State, heat: f64, confidence: f64) -> State {
    let rising = heat >= RISING_HEAT && confidence >= RISING_CONFIDENCE;
    let trending = heat >= TRENDING_HEAT && confidence >= TRENDING_CONFIDENCE;
    match state {
        State::Candidate if rising => State::Rising,
        State::Candidate => State::Candidate,
        State::Rising if trending => State::Trending,
        State::Rising if heat < ARCHIVE_HEAT => State::Candidate,
        State::Rising => State::Rising,
        State::Trending if heat < COOLING_HEAT => State::Cooling,
        State::Trending => State::Trending,
        State::Cooling if trending => State::Trending,
        State::Cooling if heat < ARCHIVE_HEAT => State::Archive,
        State::Cooling => State::Cooling,
        State::Archive if rising => State::Rising,
        State::Archive => State::Archive,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entity(id: &str, name: &str, aliases: &[&str]) -> Entity {
        Entity {
            id: id.to_owned(),
            canonical_name: name.to_owned(),
            aliases: aliases.iter().map(|alias| (*alias).to_owned()).collect(),
            state: State::Trending,
        }
    }

    fn found<'a>(entity_id: &'a str, method: &'static str, confidence: f64) -> Option<Match<'a>> {
        Some(Match {
            entity_id,
            method,
            confidence,
        })
    }

    /// `radar.test.ts` "uses deterministic match methods, confidence, and
    /// tie-breaking", and what `matchRadarEntity` answers for the rest
    /// (Node).
    #[test]
    fn matches_like_match_radar_entity() {
        let entities = [
            entity("alpha", "고양이 밈", &["냥밈"]),
            entity("beta", "다른 밈", &["냥밈"]),
        ];
        assert_eq!(
            match_entity("냥밈", &entities),
            found("alpha", "alias_exact", 0.96)
        );
        assert_eq!(
            match_entity("오늘의 #고양이밈 반응", &entities),
            found("alpha", "canonical_hashtag", 0.94)
        );
        assert_eq!(match_entity("관련 없음", &entities), None);
        assert_eq!(
            match_entity("  고양이, 밈!! ", &entities),
            found("alpha", "canonical_exact", 0.99)
        );
        assert_eq!(
            match_entity("요즘 다른 밈 유행 https://x.test/고양이", &entities),
            found("beta", "canonical_phrase", 0.87)
        );
        assert_eq!(
            match_entity("이건 냥밈 이야기", &entities),
            found("alpha", "alias_phrase", 0.83)
        );
        // `\p{L}` is V8's: U+02B0 (a modifier letter) is a letter, so the
        // phrase is not split there.
        assert_eq!(match_entity("다른 밈ʰ", &entities), None);
    }

    fn observation(platform: &str, ms: f64) -> Observation<'_> {
        Observation {
            platform,
            observed_ms: ms,
            volume: 60.0,
            velocity: 80.0,
            engagement: 70.0,
            reliability: 0.8,
        }
    }

    /// `radar.test.ts` "excludes YouTube variants from every aggregate", and
    /// what `calculateRadarSignal` answers for a mixed input (Node).
    #[test]
    fn scores_like_calculate_radar_signal() {
        let at = 1_786_492_800_000.0; // 2026-08-12T00:00:00Z
        let base = score(&[observation("threads", at)], at);
        assert_eq!(base.heat, 73.0);
        assert_eq!(base.confidence, 0.6367);
        let mut youtube = observation("youtube", at);
        youtube.volume = 100.0;
        let with_youtube = score(
            &[
                observation("threads", at),
                youtube,
                observation("youtube_shorts", at),
            ],
            at,
        );
        assert_eq!(with_youtube.heat, base.heat);
        assert_eq!(with_youtube.confidence, base.confidence);
        assert_eq!(with_youtube.aggregated_platforms, ["threads"]);
        assert_eq!(
            with_youtube.excluded_platforms,
            ["youtube", "youtube_shorts"]
        );

        // Half a day old on X, fresh on two more, and a time that is not one.
        let mut old = observation("x", at - 12.0 * 3_600_000.0);
        old.reliability = 0.83;
        let mixed = score(
            &[
                old,
                observation("x", at),
                observation("instagram", at),
                observation("threads", f64::NAN),
            ],
            at,
        );
        assert_eq!(mixed.heat, 46.0);
        assert_eq!(mixed.confidence, 0.8728);
        assert_eq!(mixed.aggregated_platforms, ["instagram", "threads", "x"]);
        assert_eq!(score(&[], at).heat, 0.0);
        assert_eq!(score(&[], at).confidence, 0.0);
    }

    /// `radar.test.ts` "recommends the next threshold state".
    #[test]
    fn recommends_like_recommend_radar_state() {
        assert_eq!(recommend(State::Candidate, 60.0, 0.8), State::Rising);
        assert_eq!(recommend(State::Rising, 80.0, 0.8), State::Trending);
        assert_eq!(recommend(State::Trending, 30.0, 0.8), State::Cooling);
        assert_eq!(recommend(State::Archive, 10.0, 0.9), State::Archive);
        assert_eq!(recommend(State::Rising, 20.0, 0.9), State::Candidate);
        assert_eq!(recommend(State::Cooling, 20.0, 0.9), State::Archive);
        assert_eq!(recommend(State::Cooling, 75.0, 0.5), State::Cooling);
        assert_eq!(State::from_lifecycle("archived"), State::Archive);
        assert_eq!(State::from_lifecycle("active"), State::Trending);
    }
}
