//! The two form actions of `app/(default)/admin/growth/actions.ts`:
//! `saveEnglishPilotSlot` and `recordGrowthPilotInterview`. The screen's
//! forms post to them without script, and each answers as the action's
//! `redirect()` does: `303` to `/admin/growth?saved=…` or `?error=…`.
//!
//! The order is the TypeScript's: the form is parsed (zod, first issue's
//! message), then the operator is checked, then the function is called. A
//! visitor without a session or a non-operator never reaches the action: the
//! proxy turns their POST away first (`form_call`).
//!
//! `revalidatePath("/admin/growth")` names a screen rendered on every
//! request: nothing to expire.

use axum::extract::{Request, State};
use axum::response::Response;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use super::{FormFields, as_operator, db_message, form_call, see_other};
use crate::AppState;
use crate::pages::admin::growth::{STATUSES, is_uuid};
use crate::routes::public::{js, js_date};
use crate::storage::signing::js_number;

const SCREEN: &str = "/admin/growth";
/// How far ahead of now an interview may be dated.
const FUTURE_SLACK_MS: i64 = 300_000;

fn back(kind: &str, message: &str) -> Response {
    see_other(&format!(
        "{SCREEN}?{kind}={}",
        js::encode_uri_component(message)
    ))
}

/// `z.string().trim()` then `min`/`max` in UTF-16 units: the trimmed value,
/// or zod's first message.
fn text(fields: &FormFields, name: &str, min: usize, max: usize) -> Result<String, String> {
    let Some(value) = fields.get(name) else {
        return Err("Invalid input: expected string, received undefined".to_owned());
    };
    let value = js::trim(value).to_owned();
    let len = js::utf16_len(&value);
    if len < min {
        return Err(format!(
            "Too small: expected string to have >={min} characters"
        ));
    }
    if len > max {
        return Err(format!(
            "Too big: expected string to have <={max} characters"
        ));
    }
    Ok(value)
}

/// `z.union([z.literal(""), z.uuid()])`.
fn optional_uuid(fields: &FormFields, name: &str) -> Result<String, String> {
    match fields.get(name) {
        None => Err("Invalid input".to_owned()),
        Some(value) if value.is_empty() || is_uuid(value) => Ok(value.to_owned()),
        Some(_) => Err("Invalid UUID".to_owned()),
    }
}

struct SlotForm {
    slot: f64,
    meme_id: String,
    status: String,
    note: String,
}

/// `slotSchema`.
fn slot_form(fields: &FormFields) -> Result<SlotForm, String> {
    // `z.coerce.number()`: `Number(value)`, `Number(undefined)` for a field
    // that is not sent.
    let slot = fields.get("slot").and_then(js_number);
    let slot = match slot {
        None => return Err("Invalid input: expected number, received NaN".to_owned()),
        Some(slot) if !slot.is_finite() || slot.fract() != 0.0 => {
            return Err("Invalid input: expected int, received number".to_owned());
        }
        Some(slot) if slot < 1.0 => return Err("Too small: expected number to be >=1".to_owned()),
        Some(slot) if slot > 20.0 => return Err("Too big: expected number to be <=20".to_owned()),
        Some(slot) => slot,
    };
    let meme_id = optional_uuid(fields, "memeId")?;
    let status = match fields.get("status") {
        Some(status) if STATUSES.iter().any(|(known, _)| *known == status) => status.to_owned(),
        _ => {
            return Err(
                r#"Invalid option: expected one of "open"|"assigned"|"ready"|"published"|"paused""#
                    .to_owned(),
            );
        }
    };
    let note = text(fields, "operatorNote", 0, 1000)?;
    if status != "open" && meme_id.is_empty() {
        return Err("배정할 영문 랜딩을 선택해 주세요.".to_owned());
    }
    Ok(SlotForm {
        slot,
        meme_id,
        status,
        note,
    })
}

/// `saveEnglishPilotSlot(formData)`.
pub async fn save_slot(State(state): State<AppState>, request: Request) -> Response {
    let (actor, fields) = match form_call(&state, request, SCREEN).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let form = match slot_form(&fields) {
        Ok(form) => form,
        Err(message) => return back("error", &message),
    };
    let SlotForm {
        slot,
        meme_id,
        status,
        note,
    } = form;
    let meme_id = (!meme_id.is_empty()).then_some(meme_id);
    let saved = as_operator(
        &state,
        &actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    "select public.set_growth_english_pilot_slot(p_slot => $1::smallint, p_meme_id => $2::uuid, p_status => $3, p_operator_note => $4)",
                )
                .bind(slot as i16)
                .bind(meme_id)
                .bind(status)
                .bind(note)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await;
    if let Err(error) = saved {
        let message = if db_message(&error) == "current_reviewed_english_translation_required" {
            "최신 원문 기준으로 검수 완료된 영문 번역만 배정할 수 있어요."
        } else {
            "영문 파일럿 슬롯을 저장하지 못했어요."
        };
        return back("error", message);
    }
    back("saved", &format!("{slot}번 슬롯을 저장했어요."))
}

/// `new Date(text)` for what a `datetime-local` field and Postgres send: a
/// local time without a zone is read in the server's time zone, UTC in the
/// production image.
fn interview_time(text: &str) -> Option<i64> {
    if let Some(ms) = js_date::parse_ms(text) {
        return Some(ms);
    }
    let bytes = text.as_bytes();
    let local = bytes.len() >= 16
        && bytes.get(10) == Some(&b'T')
        && !text.ends_with('Z')
        && !text[10..].contains(['+', '-']);
    if !local {
        return None;
    }
    let with_seconds = if bytes.len() == 16 {
        format!("{text}:00Z")
    } else {
        format!("{text}Z")
    };
    OffsetDateTime::parse(&with_seconds, &Rfc3339)
        .ok()
        .map(|time| i64::try_from(time.unix_timestamp_nanos() / 1_000_000).unwrap_or(i64::MAX))
}

struct InterviewForm {
    reference: String,
    at: String,
    market: String,
    segment: String,
    summary: String,
    evidence: Option<String>,
}

/// `interviewSchema`, then the date.
fn interview_form(fields: &FormFields, now_ms: i64) -> Result<InterviewForm, String> {
    let reference = text(fields, "participantReference", 2, 100)?;
    let at = match fields.get("interviewedAt") {
        None => return Err("Invalid input: expected string, received undefined".to_owned()),
        Some("") => return Err("Too small: expected string to have >=1 characters".to_owned()),
        Some(at) => at.to_owned(),
    };
    let market = text(fields, "market", 2, 100)?;
    let segment = text(fields, "segment", 2, 100)?;
    let summary = text(fields, "summary", 20, 4000)?;
    let evidence = match fields.get("evidenceUrl") {
        None => return Err("Invalid input".to_owned()),
        Some("") => None,
        Some(url) if url::Url::parse(url).is_err() => return Err("Invalid URL".to_owned()),
        Some(url) if !url.starts_with("https://") => return Err("Invalid input".to_owned()),
        Some(url) => Some(url.to_owned()),
    };
    let ms = interview_time(&at)
        .filter(|ms| *ms <= now_ms + FUTURE_SLACK_MS)
        .ok_or_else(|| "실제로 진행한 인터뷰 시각을 확인해 주세요.".to_owned())?;
    Ok(InterviewForm {
        reference,
        at: js_date_iso(ms),
        market,
        segment,
        summary,
        evidence,
    })
}

/// `toISOString()`.
fn js_date_iso(ms: i64) -> String {
    let time = OffsetDateTime::from_unix_timestamp_nanos(i128::from(ms) * 1_000_000)
        .unwrap_or(OffsetDateTime::UNIX_EPOCH);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        time.year(),
        u8::from(time.month()),
        time.day(),
        time.hour(),
        time.minute(),
        time.second(),
        time.millisecond()
    )
}

/// `recordGrowthPilotInterview(formData)`.
pub async fn record_interview(State(state): State<AppState>, request: Request) -> Response {
    let (actor, fields) = match form_call(&state, request, SCREEN).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let form = match interview_form(&fields, crate::auth::now_ms()) {
        Ok(form) => form,
        Err(message) => return back("error", &message),
    };
    let saved = as_operator(
        &state,
        &actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    "select public.record_growth_pilot_interview(p_participant_reference => $1, p_interviewed_at => $2::timestamptz, p_market => $3, p_segment => $4, p_summary => $5, p_evidence_url => $6)",
                )
                .bind(form.reference)
                .bind(form.at)
                .bind(form.market)
                .bind(form.segment)
                .bind(form.summary)
                .bind(form.evidence)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await;
    if saved.is_err() {
        return back("error", "인터뷰 기록을 저장하지 못했어요.");
    }
    back("saved", "실제 인터뷰 기록을 저장했어요.")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fields(pairs: &[(&str, &str)]) -> FormFields {
        FormFields::from_pairs(
            pairs
                .iter()
                .map(|(k, v)| ((*k).to_owned(), (*v).to_owned())),
        )
    }

    // The messages are what zod 4 printed for the same values.
    #[test]
    fn slot_forms_fail_with_zods_first_message() {
        let ok = [
            ("slot", "1"),
            ("memeId", ""),
            ("status", "open"),
            ("operatorNote", ""),
        ];
        let with = |name: &str, value: &str| {
            let mut pairs: Vec<(&str, &str)> =
                ok.iter().copied().filter(|(key, _)| *key != name).collect();
            pairs.push((name, value));
            slot_form(&fields(&pairs)).err()
        };
        assert_eq!(
            slot_form(&fields(&[])).err().as_deref(),
            Some("Invalid input: expected number, received NaN")
        );
        assert_eq!(
            with("slot", "1.5").as_deref(),
            Some("Invalid input: expected int, received number")
        );
        assert_eq!(
            with("slot", "").as_deref(),
            Some("Too small: expected number to be >=1")
        );
        assert_eq!(
            with("slot", "21").as_deref(),
            Some("Too big: expected number to be <=20")
        );
        assert_eq!(with("slot", " 2 "), None);
        assert_eq!(with("slot", "0x3"), None);
        assert_eq!(with("memeId", "x").as_deref(), Some("Invalid UUID"));
        assert_eq!(
            with("status", "x").as_deref(),
            Some(
                r#"Invalid option: expected one of "open"|"assigned"|"ready"|"published"|"paused""#
            )
        );
        assert_eq!(
            with("operatorNote", &"a".repeat(1001)).as_deref(),
            Some("Too big: expected string to have <=1000 characters")
        );
        assert_eq!(
            with("status", "ready").as_deref(),
            Some("배정할 영문 랜딩을 선택해 주세요.")
        );
        assert_eq!(with("memeId", "00000000-0000-0000-0000-000000000000"), None);
    }

    #[test]
    fn interview_forms_check_text_url_and_time() {
        let now = 1_800_000_000_000;
        let base = [
            ("participantReference", "ab"),
            ("interviewedAt", "2026-01-01T10:00"),
            ("market", "US"),
            ("segment", "cr"),
            ("summary", "aaaaaaaaaaaaaaaaaaaa"),
            ("evidenceUrl", ""),
        ];
        let with = |name: &str, value: &str| {
            let mut pairs: Vec<(&str, &str)> = base
                .iter()
                .copied()
                .filter(|(key, _)| *key != name)
                .collect();
            pairs.push((name, value));
            interview_form(&fields(&pairs), now).err()
        };
        let form = interview_form(&fields(&base), now).expect("valid");
        assert_eq!(form.at, "2026-01-01T10:00:00.000Z");
        assert_eq!(
            interview_form(&fields(&[]), now).err().as_deref(),
            Some("Invalid input: expected string, received undefined")
        );
        assert_eq!(
            with("participantReference", " a ").as_deref(),
            Some("Too small: expected string to have >=2 characters")
        );
        assert_eq!(
            with("interviewedAt", "").as_deref(),
            Some("Too small: expected string to have >=1 characters")
        );
        assert_eq!(
            with("summary", "short").as_deref(),
            Some("Too small: expected string to have >=20 characters")
        );
        assert_eq!(
            with("evidenceUrl", "http://x.com").as_deref(),
            Some("Invalid input")
        );
        assert_eq!(with("evidenceUrl", "nope").as_deref(), Some("Invalid URL"));
        assert_eq!(
            with("interviewedAt", "2099-01-01T00:00").as_deref(),
            Some("실제로 진행한 인터뷰 시각을 확인해 주세요.")
        );
        assert_eq!(
            with("interviewedAt", "soon").as_deref(),
            Some("실제로 진행한 인터뷰 시각을 확인해 주세요.")
        );
    }
}
