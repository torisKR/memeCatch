//! The matches an operator approved (`reviewed`, D4-1) as evidence for a
//! later run (PLAN.md D5-3): each counts once, in the first observation of
//! its meme after the approval, which names it in `factors.reviewed_signals`.
//! A rejected match never counts. Only a signal newer than the meme's last
//! observation is read, since `record_radar_trend_observation` refuses an
//! older one (`stale_radar_observation`).

use super::radar::{Stored, service};
use crate::AppState;

/// The approved matches not yet counted: meme, signal, match confidence.
const LOAD_APPROVED: &str = "select l.meme_id::text, s.id::text, s.platform, s.text, s.hashtags, \
       to_json(s.observed_at) #>> '{}', (extract(epoch from s.observed_at) * 1000)::float8, \
       s.metrics_json::text, l.match_confidence::float8 \
  from public.meme_signal_links l \
  join public.external_signals s on s.id = l.signal_id \
  left join public.radar_meme_state st on st.meme_id = l.meme_id \
 where l.review_state = 'reviewed' \
   and s.observed_at > coalesce(st.observed_at, '-infinity') \
   and not exists (select 1 from public.radar_trend_observations o \
                    where o.meme_id = l.meme_id \
                      and o.factors -> 'reviewed_signals' ? s.id::text) \
 order by l.reviewed_at, s.id";

type ApprovedRow = (
    String,
    String,
    String,
    Option<String>,
    Vec<String>,
    String,
    f64,
    String,
    f64,
);

/// An approved match: its meme, its signal and the match's confidence.
pub struct Approved {
    pub meme_id: String,
    pub signal: Stored,
    pub confidence: f64,
}

pub async fn load(state: &AppState) -> Result<Vec<Approved>, sqlx::Error> {
    let rows: Vec<ApprovedRow> = service(state, |tx| {
        Box::pin(async move { sqlx::query_as(LOAD_APPROVED).fetch_all(tx).await })
    })
    .await?;
    Ok(rows
        .into_iter()
        .map(
            |(
                meme_id,
                id,
                platform,
                text,
                hashtags,
                observed_at,
                observed_ms,
                metrics,
                confidence,
            )| {
                Approved {
                    meme_id,
                    signal: Stored::new((
                        id,
                        platform,
                        text,
                        hashtags,
                        observed_at,
                        observed_ms,
                        metrics,
                    )),
                    confidence,
                }
            },
        )
        .collect())
}
