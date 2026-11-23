//! `generateBedrockMemeConcepts` of lib/meme-studio-bedrock.server.ts: the
//! Converse request the AWS SDK sends for three meme concepts, the budget
//! reservation before it, and the checks on the answer.
//!
//! The request body is compared with what the SDK sends
//! (`tests/fixtures/meme_studio_bedrock.json`). It goes out over HTTP/1.1,
//! signed with SigV4 (`bedrock`, the region), with the body hash signed.

use serde::Serialize;
use serde_json::{Value, json};

use super::Country;
use crate::routes::public::js;

pub const MODEL_ID: &str = "global.anthropic.claude-sonnet-5";
pub const DEFAULT_REGION: &str = "ap-northeast-2";
const MAX_OUTPUT_TOKENS: u64 = 2_048;
const RESERVED_INPUT_TOKENS: u64 = 4_096;
const DEFAULT_INPUT_RATE: u64 = 3_000;
const DEFAULT_OUTPUT_RATE: u64 = 15_000;
const MAX_RATE: f64 = 1_000_000.0;
pub const TOOL_NAME: &str = "submit_meme_concepts";

const SYSTEM_PROMPT: [&str; 12] = [
    "You create three original, culturally specific meme concepts for MemeCatch.",
    "Every concept must center on the requested topic; reject and replace topic drift before submitting.",
    "Use a concrete everyday or internet-culture anchor from the requested country and give each concept a distinct setup and punchline.",
    "Make every visual brief production-ready: specify an original subject, composition, camera or framing, expression or action, setting, lighting, color direction, and readable text placement without naming protected characters or brands.",
    "The three concepts must be visibly distinct at thumbnail size; do not reuse captions, cultural anchors, subjects, compositions, or joke beats.",
    "Write captions as short, shareable punchlines, not explanations or cultural summaries.",
    "caption must be a natural Korean adaptation of the joke, not a literal translation; local_caption must sound native in the requested local language.",
    "headline, caption, cultural_anchor, visual_brief, why_it_works, and usage_context MUST be written in Korean and MUST contain Hangul. local_caption is the only field written in the requested local language.",
    "For non-Korean countries, caption and local_caption must not be identical.",
    "Silently reject and replace any concept that would still work unchanged after swapping in another country name.",
    "Do not restate the title as the joke. Avoid stereotypes, invented facts, known meme captions or templates, brands, celebrities, copyrighted characters, protected-group targeting, and harassment.",
    "Submit exactly three concepts through the forced submit_meme_concepts tool and do not answer with prose.",
];

const QUALITY_BAR: [&str; 9] = [
    "All three concepts must stay inside the exact situation described by topic. Never introduce a different activity, setting, or audience.",
    "Use these joke mechanics in array order: expectation-versus-reality, visual before-versus-after, then deadpan escalation.",
    "Each Korean caption must be at most 120 characters with a clear setup and surprising punchline.",
    "Do not put a country name or demonym in the headline or caption merely to signal localization.",
    "Keep the cultural detail observational and topic-relevant, never a claim about all people in the country.",
    "The cultural anchor must name a concrete local behavior or artifact, not a vague idea such as time management.",
    "Make the Korean adaptation immediately usable without explaining the translation.",
    "Write each visual brief as a production-ready art direction that can be handed directly to an illustrator or image model, including subject, composition, framing, expression or action, setting, lighting, color direction, and safe text placement.",
    "Make all three concepts visually and comedically distinct; never repeat a caption, cultural anchor, primary subject, composition, or punchline structure.",
];

/// `COUNTRY_BRIEFS`.
fn country_brief(code: &str) -> &'static str {
    match code {
        "KR" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete Korean detail such as KakaoTalk timing, delivery apps, subway timing, or convenience-store routines."
        }
        "US" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete U.S. detail such as time-zone overlap, Slack status, calendar holds, or after-hours work boundaries. Do not add sports, school, road trips, or coffee unless the topic asks for them."
        }
        "JP" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete Japanese detail such as LINE timing, last-train pressure, convenience-store routines, or office etiquette."
        }
        "GB" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete British detail such as rail timing, queues, weather understatement, or dry group-chat phrasing."
        }
        "BR" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete Brazilian detail such as WhatsApp group dynamics, Pix timing, bus commuting, or expressive reaction style. Do not add football unless the topic asks for it."
        }
        "MX" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete Mexican detail such as family WhatsApp timing, commuting, or weekend group plans. Do not add food unless the topic asks for it."
        }
        "CN" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete Chinese digital-life detail such as WeChat group timing, delivery apps, or online-shopping routines."
        }
        "TW" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete Taiwanese detail such as LINE timing, scooter commuting, or convenience-store routines."
        }
        "DE" => {
            "Keep the exact topic. Only when it naturally fits, use one concrete German detail such as calendar booking, rail timing, appointment punctuality, or work-chat boundaries."
        }
        _ => {
            "Keep the exact topic. Only when it naturally fits, use one concrete French detail such as group-chat timing, commuting, or lunch-break boundaries. Do not add cafes or bakeries unless the topic asks for them."
        }
    }
}

/// `BedrockMemeStudioInput` after `normalizedInput`.
#[derive(Clone, Debug)]
pub struct Input {
    pub topic: String,
    pub tone: &'static str,
    pub format: &'static str,
    pub country: Country,
}

/// Why no concepts came back. Every one is answered alike (503); the names
/// are the TypeScript's error codes, for the log.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Failure {
    Disabled,
    InvalidInput,
    InvalidRate,
    BudgetRejected,
    GenerationFailed,
    InvalidResponse,
}

/// `input.topic.trim().replace(/\s+/g, " ")`, refused when empty or longer
/// than 120 UTF-16 units.
pub fn normalized_topic(topic: &str) -> Result<String, Failure> {
    let topic = js::collapse_spaces(js::trim(topic));
    if topic.is_empty() || js::utf16_len(&topic) > 120 {
        return Err(Failure::InvalidInput);
    }
    Ok(topic)
}

/// `rate(env, name, fallback)`: unset or blank is the fallback; otherwise
/// `Number(raw)` must be a safe integer from the fallback to 1,000,000.
pub fn rate(raw: Option<&str>, fallback: u64) -> Result<u64, Failure> {
    let raw = raw.map(js::trim).unwrap_or_default();
    if raw.is_empty() {
        return Ok(fallback);
    }
    match crate::storage::js_number(raw) {
        Some(value) if value.fract() == 0.0 && value >= fallback as f64 && value <= MAX_RATE => {
            Ok(value as u64)
        }
        _ => Err(Failure::InvalidRate),
    }
}

/// The nano-USD reserved before the call: the largest input and output.
pub fn reserved_nano_usd(
    input_rate: Option<&str>,
    output_rate: Option<&str>,
) -> Result<u64, Failure> {
    let input = rate(input_rate, DEFAULT_INPUT_RATE)?;
    let output = rate(output_rate, DEFAULT_OUTPUT_RATE)?;
    Ok(RESERVED_INPUT_TOKENS * input + MAX_OUTPUT_TOKENS * output)
}

/// The user message, as `JSON.stringify` writes the object.
#[derive(Serialize)]
struct UserText<'a> {
    topic: &'a str,
    tone: &'a str,
    format: &'a str,
    country_code: &'a str,
    country_name_ko: &'a str,
    local_language: &'a str,
    country_brief: &'a str,
    quality_bar: [&'a str; 9],
    count: u8,
}

/// The Korean field of the tool's schema: its description and length.
fn korean_field(max: u64, description: &str) -> Value {
    json!({ "type": "string", "minLength": 1, "maxLength": max, "description": description })
}

fn concept_schema(country: &Country) -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": [
            "country_code", "headline", "caption", "local_caption",
            "cultural_anchor", "visual_brief", "why_it_works", "usage_context",
        ],
        "properties": {
            "country_code": { "type": "string", "enum": [country.code] },
            "headline": korean_field(80, "Korean headline containing Hangul."),
            "caption": korean_field(220, "Natural Korean adaptation containing Hangul, with a clear setup and punchline."),
            "local_caption": korean_field(220, &format!("Native {} version of the joke. For non-Korean countries it must differ from caption.", country.local_language)),
            "cultural_anchor": korean_field(220, "Korean explanation of the specific local cultural anchor, containing Hangul."),
            "visual_brief": korean_field(220, "Production-ready Korean art direction for an original, brand-free visual: subject, composition, framing, action, setting, lighting, color, and text placement; must contain Hangul."),
            "why_it_works": korean_field(220, "Korean explanation of why the joke works, containing Hangul."),
            "usage_context": korean_field(220, "Korean usage context containing Hangul."),
        },
    })
}

/// The body of `ConverseCommand(requestFor(input))` as the SDK sends it.
/// `modelId` goes in the path.
pub fn request_body(input: &Input) -> Value {
    let user = UserText {
        topic: &input.topic,
        tone: input.tone,
        format: input.format,
        country_code: input.country.code,
        country_name_ko: input.country.label,
        local_language: input.country.local_language,
        country_brief: country_brief(input.country.code),
        quality_bar: QUALITY_BAR,
        count: 3,
    };
    let text = serde_json::to_string(&user).expect("strings serialize");
    json!({
        "messages": [{ "role": "user", "content": [{ "text": text }] }],
        "system": [{ "text": SYSTEM_PROMPT.join(" ") }],
        "inferenceConfig": { "maxTokens": MAX_OUTPUT_TOKENS, "temperature": 0.4 },
        "toolConfig": {
            "tools": [{
                "toolSpec": {
                    "name": TOOL_NAME,
                    "description": "Submit exactly three original meme concepts for the requested country.",
                    "inputSchema": { "json": {
                        "type": "object",
                        "required": ["concepts"],
                        "properties": { "concepts": {
                            "type": "array", "minItems": 3, "maxItems": 3,
                            "items": concept_schema(&input.country),
                        } },
                    } },
                },
            }],
            "toolChoice": { "tool": { "name": TOOL_NAME } },
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::routes::studio::meme_country;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct FixtureInput {
        topic: String,
        tone: String,
        format: String,
        country: String,
    }

    #[derive(Deserialize)]
    struct Case {
        input: FixtureInput,
        path: String,
        body: Value,
    }

    fn known<const N: usize>(value: &str, list: [&'static str; N]) -> &'static str {
        list.into_iter()
            .find(|item| *item == value)
            .expect("a known value")
    }

    #[test]
    fn the_body_is_what_the_sdk_sent_for_each_input() {
        let cases: Vec<Case> = serde_json::from_str(include_str!(
            "../../../tests/fixtures/meme_studio_bedrock.json"
        ))
        .expect("fixture");
        assert_eq!(cases.len(), 10);

        for case in cases {
            let input = Input {
                topic: normalized_topic(&case.input.topic).unwrap(),
                tone: known(&case.input.tone, super::super::TONES),
                format: known(&case.input.format, super::super::FORMATS),
                country: meme_country(&case.input.country).unwrap(),
            };
            assert_eq!(case.path, format!("/model/{MODEL_ID}/converse"));
            assert_eq!(request_body(&input), case.body, "{}", case.input.topic);
            // The prompt text itself, byte for byte.
            let text = &case.body["messages"][0]["content"][0]["text"];
            assert_eq!(
                request_body(&input)["messages"][0]["content"][0]["text"],
                *text
            );
        }
    }

    // Each verdict is what rate() of the TypeScript does with the value.
    #[test]
    fn a_rate_is_a_safe_integer_from_the_default_to_one_million() {
        assert_eq!(rate(None, 3_000), Ok(3_000));
        assert_eq!(rate(Some("  "), 3_000), Ok(3_000));
        assert_eq!(rate(Some(" 4000 "), 3_000), Ok(4_000));
        assert_eq!(rate(Some("1e4"), 3_000), Ok(10_000));
        assert_eq!(rate(Some("0x1000"), 3_000), Ok(4_096));
        assert_eq!(rate(Some("1000000"), 3_000), Ok(1_000_000));
        for refused in ["2999", "1000001", "3000.5", "abc", "Infinity", "-5000"] {
            assert_eq!(
                rate(Some(refused), 3_000),
                Err(Failure::InvalidRate),
                "{refused}"
            );
        }
        assert_eq!(reserved_nano_usd(None, None), Ok(43_008_000));
    }

    #[test]
    fn the_topic_is_trimmed_and_its_spaces_collapsed() {
        assert_eq!(normalized_topic("  a \t b  ").unwrap(), "a b");
        assert_eq!(normalized_topic(" \u{feff} "), Err(Failure::InvalidInput));
        assert!(normalized_topic(&"가".repeat(121)).is_err());
    }
}
