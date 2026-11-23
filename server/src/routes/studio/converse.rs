//! The Converse call of `generateBedrockMemeConcepts` and the checks on its
//! answer (`responseSchema` and the distinctness rules), then the checks of
//! `generateAdminMemeConcepts`.
//!
//! Credentials are the AWS SDK's environment ones only. The endpoint is the
//! SDK's: `AWS_ENDPOINT_URL_BEDROCK_RUNTIME`, else `AWS_ENDPOINT_URL`, else
//! `https://bedrock-runtime.<region>.amazonaws.com`. Like the SDK client
//! (`maxAttempts: 1`, no timeout) it tries once and waits as long as it takes.

use std::collections::HashSet;
use std::time::SystemTime;

use aws_credential_types::Credentials;
use aws_sigv4::http_request::{
    PayloadChecksumKind, SignableBody, SignableRequest, SigningSettings, sign,
};
use aws_sigv4::sign::v4;
use axum::body::Body;
use axum::http::header::{CONTENT_LENGTH, CONTENT_TYPE};
use axum::http::{Method, Request};
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use serde_json::{Map, Value};

use super::bedrock::{DEFAULT_REGION, Failure, MODEL_ID, TOOL_NAME};
use super::{Concept, Country, meme_country};
use crate::config::BedrockStudioConfig;
use crate::routes::public::js;

/// An answer larger than this is not read (the model may write 2,048 tokens).
const MAX_ANSWER_BYTES: usize = 4 * 1024 * 1024;

/// The HTTP client for Bedrock Runtime.
pub struct Bedrock {
    client: Client<HttpsConnector<HttpConnector>, Body>,
}

impl Bedrock {
    pub fn new() -> Result<Self, String> {
        let mut http = HttpConnector::new();
        http.enforce_http(false);
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .map_err(|error| format!("cannot set up TLS for Bedrock: {error}"))?
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Ok(Self {
            client: Client::builder(TokioExecutor::new()).build(connector),
        })
    }

    /// `bedrock.send(new ConverseCommand(request))`: the parsed answer of a
    /// 2xx response, `GenerationFailed` for anything else.
    pub async fn converse(
        &self,
        config: &BedrockStudioConfig,
        body: &Value,
    ) -> Result<Value, Failure> {
        let request = signed_request(config, body).ok_or(Failure::GenerationFailed)?;
        let response = self
            .client
            .request(request)
            .await
            .map_err(|_| Failure::GenerationFailed)?;
        if !response.status().is_success() {
            return Err(Failure::GenerationFailed);
        }
        let bytes = axum::body::to_bytes(Body::new(response.into_body()), MAX_ANSWER_BYTES)
            .await
            .map_err(|_| Failure::GenerationFailed)?;
        serde_json::from_slice(&bytes).map_err(|_| Failure::GenerationFailed)
    }
}

/// The POST to `/model/<id>/converse`, signed as the SDK signs it
/// (`bedrock`, the region, the body hash in `x-amz-content-sha256`).
fn signed_request(config: &BedrockStudioConfig, body: &Value) -> Option<Request<Body>> {
    let region = config.region.as_deref().unwrap_or(DEFAULT_REGION);
    let endpoint = config
        .endpoint_url
        .clone()
        .unwrap_or_else(|| format!("https://bedrock-runtime.{region}.amazonaws.com"));
    let url = format!(
        "{}/model/{}/converse",
        endpoint.trim_end_matches('/'),
        js::encode_uri_component(MODEL_ID)
    );
    let bytes = serde_json::to_vec(body).ok()?;
    let length = bytes.len().to_string();
    let credentials = Credentials::new(
        config.access_key_id.as_deref()?,
        config.secret_access_key.as_ref()?.expose(),
        config
            .session_token
            .as_ref()
            .map(|token| token.expose().to_owned()),
        None,
        "environment",
    );
    let identity = credentials.into();
    let mut settings = SigningSettings::default();
    settings.payload_checksum_kind = PayloadChecksumKind::XAmzSha256;
    let params = v4::SigningParams::builder()
        .identity(&identity)
        .region(region)
        .name("bedrock")
        .time(SystemTime::now())
        .settings(settings)
        .build()
        .ok()?
        .into();
    let headers = [
        ("content-type", "application/json"),
        ("content-length", length.as_str()),
    ];
    let signable = SignableRequest::new(
        "POST",
        &url,
        headers.into_iter(),
        SignableBody::Bytes(&bytes),
    )
    .ok()?;
    let (instructions, _) = sign(signable, &params).ok()?.into_parts();
    let mut request = Request::builder()
        .method(Method::POST)
        .uri(&url)
        .header(CONTENT_TYPE, "application/json")
        .header(CONTENT_LENGTH, length)
        .body(Body::from(bytes))
        .ok()?;
    instructions.apply_to_request_http1x(&mut request);
    Some(request)
}

/// `koreanText(max)`: trimmed, 1 to `max` UTF-16 units, with Hangul.
fn korean(value: &Value, max: usize) -> Option<String> {
    let text = plain(value, max)?;
    text.chars()
        .any(|c| ('가'..='힣').contains(&c))
        .then_some(text)
}

/// `z.string().trim().min(1).max(max)`.
fn plain(value: &Value, max: usize) -> Option<String> {
    let text = js::trim(value.as_str()?);
    (1..=max)
        .contains(&js::utf16_len(text))
        .then(|| text.to_owned())
}

/// `conceptSchema` (strict): exactly its eight keys.
fn concept(value: &Value) -> Option<Concept> {
    let map: &Map<String, Value> = value.as_object().filter(|map| map.len() == 8)?;
    let code = map
        .get("country_code")?
        .as_str()
        .filter(|code| meme_country(code).is_some())?;
    Some(Concept {
        country_code: code.to_owned(),
        headline: korean(map.get("headline")?, 80)?,
        caption: korean(map.get("caption")?, 220)?,
        local_caption: plain(map.get("local_caption")?, 220)?,
        cultural_anchor: korean(map.get("cultural_anchor")?, 220)?,
        visual_brief: korean(map.get("visual_brief")?, 220)?,
        why_it_works: korean(map.get("why_it_works")?, 220)?,
        usage_context: korean(map.get("usage_context")?, 220)?,
    })
}

/// The one `toolUse` block of the answer, by name.
fn tool_input(answer: &Value) -> Option<&Value> {
    let blocks = answer["output"]["message"]["content"].as_array()?;
    let uses: Vec<&Value> = blocks
        .iter()
        .filter_map(|block| block.get("toolUse").filter(|tool| tool.is_object()))
        .collect();
    match uses.as_slice() {
        [tool] if tool["name"] == TOOL_NAME => tool.get("input"),
        _ => None,
    }
}

/// `new Set(values.map(trim, collapse, toLocaleLowerCase)).size === values.length`.
fn distinct<'a>(values: impl Iterator<Item = &'a str> + Clone) -> bool {
    let normalized: HashSet<String> = values
        .clone()
        .map(|value| js::collapse_spaces(js::trim(value)).to_lowercase())
        .collect();
    normalized.len() == values.count()
}

/// The concepts of a valid answer for `country`, normalized.
pub fn concepts(answer: &Value, country: &Country) -> Result<Vec<Concept>, Failure> {
    let invalid = Failure::InvalidResponse;
    let input = tool_input(answer)
        .and_then(Value::as_object)
        .ok_or(invalid)?;
    let list = match (input.len(), input.get("concepts")) {
        (1, Some(Value::Array(list))) if list.len() == 3 => list,
        _ => return Err(invalid),
    };
    let concepts = list
        .iter()
        .map(concept)
        .collect::<Option<Vec<_>>>()
        .ok_or(invalid)?;
    let wrong_country = concepts.iter().any(|concept| {
        concept.country_code != country.code
            || (country.code != "KR" && concept.caption == concept.local_caption)
    });
    if wrong_country
        || !distinct(concepts.iter().map(|concept| concept.caption.as_str()))
        || !distinct(
            concepts
                .iter()
                .map(|concept| concept.cultural_anchor.as_str()),
        )
    {
        return Err(invalid);
    }
    Ok(concepts.into_iter().map(Concept::normalized).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn concept_json(caption: &str, anchor: &str, local: &str) -> Value {
        json!({
            "country_code": "JP", "headline": " 제목 ", "caption": caption,
            "local_caption": local, "cultural_anchor": anchor, "visual_brief": "그림 — 설명",
            "why_it_works": "이유", "usage_context": "상황",
        })
    }

    fn answer(concepts: Value) -> Value {
        json!({ "output": { "message": { "role": "assistant", "content": [
            { "toolUse": { "toolUseId": "t", "name": TOOL_NAME, "input": { "concepts": concepts } } },
        ] } } })
    }

    fn three() -> Value {
        json!([
            concept_json("캡션 하나", "앵커 하나", "一"),
            concept_json("캡션 둘", "앵커 둘", "二"),
            concept_json("캡션 셋", "앵커 셋", "三"),
        ])
    }

    #[test]
    fn a_valid_answer_gives_three_trimmed_normalized_concepts() {
        let japan = meme_country("JP").unwrap();
        let concepts = concepts(&answer(three()), &japan).unwrap();

        assert_eq!(concepts.len(), 3);
        assert_eq!(concepts[0].headline, "제목");
        assert_eq!(concepts[0].visual_brief, "그림 - 설명");
    }

    #[test]
    fn each_broken_rule_refuses_the_answer() {
        let japan = meme_country("JP").unwrap();
        let mut duplicate = three();
        duplicate[1]["caption"] = json!(" 캡션   하나 ");
        let mut extra = three();
        extra[0]["x"] = json!(1);
        let mut latin = three();
        latin[2]["why_it_works"] = json!("because");
        let mut same = three();
        same[0]["local_caption"] = json!("캡션 하나");
        let mut korea = three();
        korea[0]["country_code"] = json!("KR");
        for (name, value) in [
            ("duplicate captions", answer(duplicate)),
            ("an extra key", answer(extra)),
            ("no Hangul", answer(latin)),
            ("caption equals local caption", answer(same)),
            ("another country", answer(korea)),
            (
                "two concepts",
                answer(json!([
                    concept_json("가", "나", "a"),
                    concept_json("다", "라", "b")
                ])),
            ),
            (
                "no tool",
                json!({ "output": { "message": { "content": [{ "text": "hi" }] } } }),
            ),
        ] {
            assert_eq!(
                concepts(&value, &japan),
                Err(Failure::InvalidResponse),
                "{name}"
            );
        }
    }
}
