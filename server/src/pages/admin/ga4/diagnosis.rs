//! Compare session segments to the same period's overall bounce rate.

pub(super) const MIN_SESSIONS: u64 = 30;
pub(super) const MIN_PAGE_VIEWS: u64 = 30;
const BOUNCE_GAP: f64 = 0.12;
const SHORT_ENGAGEMENT_SECONDS: f64 = 10.0;
const MAX_FINDINGS: usize = 6;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Kind {
    Landing,
    Source,
    Device,
    OperatingSystem,
    Browser,
    Environment,
}

impl Kind {
    pub(super) const fn label(self) -> &'static str {
        match self {
            Self::Landing => "착지 페이지",
            Self::Source => "유입 소스",
            Self::Device => "기기",
            Self::OperatingSystem => "운영체제",
            Self::Browser => "브라우저",
            Self::Environment => "기기·브라우저",
        }
    }

    pub(super) const fn action(self) -> &'static str {
        match self {
            Self::Landing => {
                "첫 화면의 내용이 방문 의도와 맞는지, 다음 링크가 쉽게 보이는지 점검하세요."
            }
            Self::Source => "유입 링크가 약속하는 내용과 연결된 착지 페이지를 점검하세요.",
            Self::Device | Self::OperatingSystem | Self::Browser | Self::Environment => {
                "해당 환경에서 첫 화면 표시 속도와 메뉴·버튼 동작을 확인하세요."
            }
        }
    }
}

pub(super) struct Segment {
    pub(super) name: String,
    pub(super) kind: Kind,
    pub(super) sessions: u64,
    pub(super) bounce: f64,
    pub(super) engagement_seconds: Option<f64>,
}

impl Segment {
    pub(super) fn lost(&self) -> u64 {
        lost(self.sessions, self.bounce)
    }
}

pub(super) fn lost(sessions: u64, bounce: f64) -> u64 {
    (sessions as f64 * bounce).round() as u64
}

pub(super) struct Finding {
    pub(super) segment: Segment,
    pub(super) short_engagement: bool,
}

pub(super) fn diagnose(
    site_bounce: f64,
    segments: impl IntoIterator<Item = Segment>,
) -> Vec<Finding> {
    let mut findings: Vec<_> = segments
        .into_iter()
        .filter(|segment| segment.sessions >= MIN_SESSIONS)
        .filter_map(|segment| {
            let short_engagement = segment.kind == Kind::Landing
                && segment
                    .engagement_seconds
                    .is_some_and(|seconds| seconds < SHORT_ENGAGEMENT_SECONDS)
                && segment.bounce > site_bounce;
            let high = segment.bounce - site_bounce >= BOUNCE_GAP - f64::EPSILON;
            (high || short_engagement).then_some(Finding {
                segment,
                short_engagement,
            })
        })
        .collect();
    findings.sort_by(|a, b| {
        b.segment
            .lost()
            .cmp(&a.segment.lost())
            .then_with(|| a.segment.name.cmp(&b.segment.name))
    });
    findings.truncate(MAX_FINDINGS);
    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(name: &str, kind: Kind, sessions: u64, bounce: f64, seconds: f64) -> Segment {
        Segment {
            name: name.to_owned(),
            kind,
            sessions,
            bounce,
            engagement_seconds: Some(seconds),
        }
    }

    #[test]
    fn applies_volume_bounce_gap_and_strict_short_time_threshold() {
        let findings = diagnose(
            0.50,
            [
                segment("too small", Kind::Browser, MIN_SESSIONS - 1, 1.0, 9.0),
                segment(
                    "exact volume and gap",
                    Kind::Browser,
                    MIN_SESSIONS,
                    0.62,
                    15.0,
                ),
                segment("under gap", Kind::Source, 80, 0.619, 9.0),
                segment("short landing", Kind::Landing, 100, 0.55, 9.99),
                segment("exact time", Kind::Landing, 100, 0.55, 10.0),
                segment("short but normal bounce", Kind::Landing, 120, 0.50, 1.0),
            ],
        );
        assert_eq!(findings.len(), 2);
        assert_eq!(findings[0].segment.name, "short landing");
        assert!(findings[0].short_engagement);
        assert_eq!(findings[0].segment.lost(), 55);
        assert_eq!(findings[1].segment.lost(), 19);
        assert!(!findings[1].short_engagement);
    }

    #[test]
    fn limits_findings_in_order_of_lost_sessions() {
        let findings = diagnose(
            0.50,
            (30..=40).map(|count| {
                let name = count.to_string();
                segment(&name, Kind::Device, count, 0.90, 20.0)
            }),
        );
        assert_eq!(findings.len(), MAX_FINDINGS);
        assert_eq!(findings[0].segment.name, "40");
        assert_eq!(findings[0].segment.lost(), 36);
    }
}
