//! `fetchYouTubeVideoStatuses` of `lib/sources/youtube.server.ts` with the
//! checks of `youtube-response.mjs`: `videos.list` in batches of 50,
//! `cache: "no-store"`, 15 s each.
//!
//! Values are kept as the JSON the API sent (`item.snippet?.title ?? null`
//! may be any JSON type); `pg_text` turns one into the text node-pg would
//! bind for it.

use std::collections::HashMap;
use std::time::Duration;

use serde_json::Value;
use url::Url;

use crate::AppState;
use crate::routes::db_query::run::prepare_value;
use crate::routes::js_json;
use crate::routes::request::{Json, decode_text};

const API_BASE: &str = "https://www.googleapis.com/youtube/v3";
const BATCH_SIZE: usize = 50;
const TIMEOUT: Duration = Duration::from_secs(15);
const INCONCLUSIVE: &str = "youtube_video_list_inconclusive";

/// `YouTubeVideoStatus`.
#[derive(Clone, Debug, PartialEq)]
pub struct VideoStatus {
    pub title: Value,
    pub channel_id: Value,
    pub channel_title: Value,
    pub published_at: Value,
    pub thumbnail_url: Value,
    pub duration_seconds: Option<f64>,
    /// Checked to be `public`, `private` or `unlisted`.
    pub privacy_status: String,
    pub license: Value,
    /// Checked to be a boolean.
    pub embeddable: bool,
    pub made_for_kids: Value,
    pub region_blocked: Value,
    pub region_allowed: Value,
}

/// The text node-pg binds for a value (`bindValue`, then `prepareValue`).
pub fn pg_text(value: &Value) -> Option<String> {
    Json::parse(&value.to_string()).and_then(|json| prepare_value(&json))
}

/// `value?.key ?? null`: only objects have the fields read here.
fn get(value: Option<&Value>, key: &str) -> Value {
    value
        .and_then(Value::as_object)
        .and_then(|object| object.get(key))
        .cloned()
        .unwrap_or(Value::Null)
}

/// `fetchYouTubeVideoStatuses(ids)`. `Err` is the thrown message.
pub async fn fetch_statuses(
    state: &AppState,
    ids: &[String],
) -> Result<HashMap<String, VideoStatus>, String> {
    let key = state
        .config
        .youtube_api_key
        .as_ref()
        .ok_or_else(|| "YOUTUBE_API_KEY가 설정되지 않았습니다.".to_owned())?;
    let mut unique: Vec<&str> = Vec::new();
    for id in ids.iter().filter(|id| !id.is_empty()) {
        if !unique.contains(&id.as_str()) {
            unique.push(id);
        }
    }
    let mut result = HashMap::new();
    for batch in unique.chunks(BATCH_SIZE) {
        let mut url = Url::parse(&format!("{API_BASE}/videos")).expect("a fixed endpoint");
        url.query_pairs_mut()
            .append_pair("part", "snippet,status,contentDetails")
            .append_pair("id", &batch.join(","))
            .append_pair("key", key.expose());
        let fetched = state
            .oembed
            .fetch_no_store(&url, TIMEOUT)
            .await
            .map_err(|error| error.message().to_owned())?;
        if !(200..300).contains(&fetched.status) {
            return Err(format!("YouTube API HTTP {}", fetched.status));
        }
        let data: Value = fetched
            .body
            .as_deref()
            .map(decode_text)
            .and_then(|text| serde_json::from_str(&text).ok())
            .ok_or_else(|| "YouTube API invalid JSON".to_owned())?;
        for item in checked_items(&data, batch)? {
            let status = map_video(item)?;
            result.insert(item["id"].as_str().unwrap_or_default().to_owned(), status);
        }
    }
    Ok(result)
}

/// `validateYouTubeVideosListResponse` then `validateYouTubeVideoStatusItems`.
fn checked_items<'a>(data: &'a Value, batch: &[&str]) -> Result<&'a [Value], String> {
    let items = data
        .as_object()
        .and_then(|object| object.get("items"))
        .and_then(Value::as_array)
        .ok_or_else(|| INCONCLUSIVE.to_owned())?;
    let mut seen: Vec<&str> = Vec::new();
    for item in items {
        let id = item
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| item.is_object() && batch.contains(id));
        match id {
            Some(id) if !seen.contains(&id) => seen.push(id),
            _ => return Err(INCONCLUSIVE.to_owned()),
        }
    }
    for item in items {
        let status = item.get("status").filter(|status| status.is_object());
        let privacy = status
            .and_then(|status| status.get("privacyStatus"))
            .and_then(Value::as_str);
        let embeddable = status.and_then(|status| status.get("embeddable"));
        if !matches!(privacy, Some("public" | "private" | "unlisted"))
            || !embeddable.is_some_and(Value::is_boolean)
        {
            return Err(INCONCLUSIVE.to_owned());
        }
    }
    Ok(items)
}

/// `mapVideo(item)` for a checked item.
fn map_video(item: &Value) -> Result<VideoStatus, String> {
    let snippet = item.get("snippet");
    let thumbnails = get(snippet, "thumbnails");
    let thumbnail_url = ["high", "medium", "default"]
        .iter()
        .map(|size| get(Some(&get(Some(&thumbnails), size)), "url"))
        .find(|url| !url.is_null())
        .unwrap_or(Value::Null);
    let details = item.get("contentDetails");
    let restriction = get(details, "regionRestriction");
    let status = item.get("status");
    Ok(VideoStatus {
        title: get(snippet, "title"),
        channel_id: get(snippet, "channelId"),
        channel_title: get(snippet, "channelTitle"),
        published_at: get(snippet, "publishedAt"),
        thumbnail_url,
        duration_seconds: duration_seconds(&get(details, "duration"))?,
        privacy_status: get(status, "privacyStatus")
            .as_str()
            .unwrap_or_default()
            .to_owned(),
        license: get(status, "license"),
        embeddable: get(status, "embeddable").as_bool().unwrap_or_default(),
        made_for_kids: get(status, "madeForKids"),
        region_blocked: get(Some(&restriction), "blocked"),
        region_allowed: get(Some(&restriction), "allowed"),
    })
}

/// `parseIso8601Duration(value)`: `PT1H2M3S` in seconds. A value that is
/// truthy but not a string throws, as `value.match` does.
fn duration_seconds(value: &Value) -> Result<Option<f64>, String> {
    let text = match value {
        Value::Null | Value::Bool(false) => return Ok(None),
        Value::Number(number) if number.as_f64() == Some(0.0) => return Ok(None),
        Value::String(text) if text.is_empty() => return Ok(None),
        Value::String(text) => text,
        _ => return Err("value.match is not a function".to_owned()),
    };
    let Some(mut rest) = text.strip_prefix("PT") else {
        return Ok(None);
    };
    let mut total = 0.0;
    for (unit, seconds) in [('H', 3_600.0), ('M', 60.0), ('S', 1.0)] {
        let digits = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        if digits > 0 && rest[digits..].starts_with(unit) {
            total += rest[..digits].parse::<f64>().unwrap_or(f64::INFINITY) * seconds;
            rest = &rest[digits + 1..];
        }
    }
    Ok(rest.is_empty().then_some(total))
}

/// `isYouTubeRegionBlocked({ allowed, blocked }, "KR")`.
pub fn region_blocked(status: &VideoStatus) -> bool {
    let has_kr = |list: &Value| {
        list.as_array()
            .map(|items| items.iter().any(|item| item == "KR"))
    };
    has_kr(&status.region_allowed) == Some(false) || has_kr(&status.region_blocked) == Some(true)
}

/// `String(n)` of a number this module wrote.
pub fn number_text(value: f64) -> String {
    js_json::number(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn durations_read_as_the_typescript_reads_them() {
        let seconds = |value: Value| duration_seconds(&value);
        assert_eq!(seconds(json!("PT1H2M3S")), Ok(Some(3_723.0)));
        assert_eq!(seconds(json!("PT")), Ok(Some(0.0)));
        assert_eq!(seconds(json!("PT3S2M")), Ok(None));
        assert_eq!(seconds(json!("P1DT1S")), Ok(None));
        assert_eq!(seconds(json!("")), Ok(None));
        assert_eq!(seconds(json!(0)), Ok(None));
        assert_eq!(
            seconds(json!(5)),
            Err("value.match is not a function".into())
        );
    }

    #[test]
    fn a_batch_answer_must_be_exact_before_absence_means_removal() {
        let batch = ["aaaaaaaaaaa", "bbbbbbbbbbb"];
        let item =
            |id: &str| json!({"id": id, "status": {"privacyStatus": "public", "embeddable": true}});
        assert!(checked_items(&json!({"items": []}), &batch).is_ok());
        assert!(checked_items(&json!({"items": [item("aaaaaaaaaaa")]}), &batch).is_ok());
        for bad in [
            json!({}),
            json!([]),
            json!({"items": [item("ccccccccccc")]}),
            json!({"items": [item("aaaaaaaaaaa"), item("aaaaaaaaaaa")]}),
            json!({"items": [{"id": "aaaaaaaaaaa", "status": {"privacyStatus": "public"}}]}),
            json!({"items": [{"id": "aaaaaaaaaaa", "status": {"privacyStatus": "x", "embeddable": true}}]}),
        ] {
            assert_eq!(
                checked_items(&bad, &batch).err().as_deref(),
                Some(INCONCLUSIVE),
                "{bad}"
            );
        }
        let status = map_video(&json!({
            "id": "aaaaaaaaaaa",
            "snippet": {"title": 5, "thumbnails": {"high": null, "medium": {"url": ""}}},
            "contentDetails": {"regionRestriction": {"allowed": []}},
            "status": {"privacyStatus": "public", "embeddable": false}
        }))
        .expect("mapped");
        assert_eq!(pg_text(&status.title).as_deref(), Some("5"));
        assert_eq!(status.thumbnail_url, json!(""));
        assert!(
            region_blocked(&status),
            "an empty allow list blocks every region"
        );
    }
}
