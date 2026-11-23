//! `TONE_TEMPLATES`, `buildTemplateConcepts` and `generateMemeConcepts` of
//! lib/meme-studio.server.ts. The text is the TypeScript's, byte for byte;
//! `tests/fixtures/meme_studio.json` holds the real output for many inputs.

use super::{Concept, meme_country, with_particle};
use crate::routes::public::js;

/// One template: only the caption depends on the topic.
struct Template {
    headline: &'static str,
    caption: fn(&str) -> String,
    why_it_works: &'static str,
    usage_context: &'static str,
}

const WHOLESOME: [Template; 3] = [
    Template {
        headline: "다정한 생존 자랑",
        caption: |topic| format!("{topic}? 이 시국에? 시도했다는 것만으로도 정말 잘했어."),
        why_it_works: "팍팍한 현실을 끼워 넣어 진심 어린 응원을 부담스럽지 않게 만든다.",
        usage_context: "친구가 올린 소소한 성취 글에 답글로 쓰기 좋다.",
    },
    Template {
        headline: "조용히 응원하는 조연",
        caption: |topic| {
            format!("아무도 안 물어봤지만, 나는 조용히 {topic} 배우는 모두를 응원 중.")
        },
        why_it_works: "아무도 안 물어봤다는 형식이 과한 열정을 자각하는 유머로 바꾼다.",
        usage_context: "스토리나 커뮤니티에서 응원 메시지를 보낼 때 좋다.",
    },
    Template {
        headline: "따뜻한 반전",
        caption: |topic| format!("{topic} 놀리러 왔는데 솔직히 말하면, 다들 정말 잘하고 있어."),
        why_it_works: "빈정거릴 듯 시작했다가 진심으로 응원하는 반전이 따뜻한 웃음을 만든다.",
        usage_context: "긴 대화의 마무리나 일요일 재정비 글에 어울린다.",
    },
];

const SARCASTIC: [Template; 3] = [
    Template {
        headline: "사내 공지 말투",
        caption: |topic| {
            format!(
                "기쁜 소식입니다. 이제 {} 제 성격 전부가 됐습니다. 인사팀에도 알렸습니다.",
                with_particle(topic, "이/가")
            )
        },
        why_it_works: "격식 있는 사내 공지 말투로 과몰입 자체를 웃음거리로 만든다.",
        usage_context: "새로운 관심사에 빠졌다고 인용 게시할 때 좋다.",
    },
    Template {
        headline: "마지못한 전문가",
        caption: |topic| {
            format!(
                "제가 규칙을 만든 건 아니고요, 그냥 {} 너무 많이 알아 버린 대가를 치르는 중입니다.",
                with_particle(topic, "을/를")
            )
        },
        why_it_works: "책임은 피하면서도 별난 지식을 슬쩍 자랑하는 모순이 웃음을 만든다.",
        usage_context: "단체 채팅에서 같은 설정을 세 번째 설명한 뒤 쓰기 좋다.",
    },
    Template {
        headline: "무표정 상태 보고",
        caption: |topic| {
            format!(
                "{} 잠깐의 유행인 척한 지 47일째.",
                with_particle(topic, "이/가")
            )
        },
        why_it_works: "가짜 날짜 세기가 부정을 반복되는 농담으로 바꾼다.",
        usage_context: "매일 올리는 기록이나 프로필 근처의 짧은 농담에 어울린다.",
    },
];

const ABSURD: [Template; 3] = [
    Template {
        headline: "정신없는 예언",
        caption: |topic| {
            format!(
                "고대인들은 {} 경고했다. 우리는 끝내 듣지 않았다.",
                with_particle(topic, "을/를")
            )
        },
        why_it_works: "평범한 대상을 신화처럼 무겁게 다루는 대비가 황당한 웃음을 만든다.",
        usage_context: "피드를 내리다 갑자기 던지는 혼돈의 게시물에 어울린다.",
    },
    Template {
        headline: "저주받은 후기",
        caption: |topic| format!("{topic}: 별점 5점. 또 당해도 좋습니다."),
        why_it_works: "후기 사이트 문법을 대혼란에 적용해 황당함을 바로 이해하게 만든다.",
        usage_context: "관련 영상의 댓글란에 쓰기 좋다.",
    },
    Template {
        headline: "음모론 속삭임",
        caption: |topic| {
            format!("자기야 일어나, 새 {topic} 설정이 공개됐는데 어쩐지 더 심각해졌어.")
        },
        why_it_works: "사소한 업데이트를 세상을 뒤흔드는 속보처럼 다뤄 웃음을 만든다.",
        usage_context: "팬덤의 황당한 새 소식을 인용 게시할 때 좋다.",
    },
];

const HYPE: [Template; 3] = [
    Template {
        headline: "경기장 아나운서",
        caption: |topic| {
            format!(
                "여러분, 드디어 {} 등장했습니다!",
                with_particle(&topic.to_uppercase(), "이/가")
            )
        },
        why_it_works: "힘찬 중계 말투가 작은 소식도 주인공의 등장처럼 느끼게 한다.",
        usage_context: "출시일, 승리 인증, 스포츠 반응 글에 어울린다.",
    },
    Template {
        headline: "올해의 순간",
        caption: |topic| {
            format!(
                "지금 이 순간, {} 공식적으로 올해의 장면이 됐고 우리는 그 안에 살고 있다.",
                with_particle(topic, "이/가")
            )
        },
        why_it_works: "현장 시점과 최상급 표현을 결합해 유행의 중심에 있다는 느낌을 준다.",
        usage_context: "인기 음원과 함께 올리는 스토리에 어울린다.",
    },
    Template {
        headline: "유행 예언 인증",
        caption: |topic| {
            format!(
                "이건 캡처해 둬. {} 뜨기 전에 먼저 알아봤으니까.",
                with_particle(topic, "이/가")
            )
        },
        why_it_works: "미리 알았다는 선언이 나중에 돌아볼 수 있는 유쾌한 증거가 된다.",
        usage_context: "마침내 유행이 커졌을 때 인용 게시하기 좋다.",
    },
];

fn templates(tone: &str) -> &'static [Template; 3] {
    match tone {
        "wholesome" => &WHOLESOME,
        "sarcastic" => &SARCASTIC,
        "absurd" => &ABSURD,
        _ => &HYPE,
    }
}

/// The headline, caption and usage context `format` gives a template.
fn formatted(template: &Template, topic: &str, format: &str) -> (String, String, String) {
    let caption = (template.caption)(topic);
    match format {
        "image-macro" => (
            format!("이미지 매크로 · {}", template.headline),
            format!("{}\n{caption}", topic.to_uppercase()),
            format!("이미지 상·하단 문구 · {}", template.usage_context),
        ),
        "reaction" => (
            format!("리액션 · {}", template.headline),
            format!("내 반응: {caption}"),
            format!("리액션 이미지/영상 · {}", template.usage_context),
        ),
        _ => (
            format!("게시물 캡션 · {}", template.headline),
            caption,
            format!("게시물 본문 · {}", template.usage_context),
        ),
    }
}

/// `buildTemplateConcepts`, then `generateMemeConcepts` (country `KR`):
/// the start rotates with the topic's length in UTF-16 units.
pub fn concepts(topic: &str, tone: &str, format: &str) -> Vec<Concept> {
    let templates = templates(tone);
    let start = js::utf16_len(topic) % templates.len();
    let korea = meme_country("KR").expect("KR is a meme country");
    templates
        .iter()
        .cycle()
        .skip(start)
        .take(templates.len())
        .map(|template| {
            let (headline, caption, usage_context) = formatted(template, topic, format);
            Concept {
                country_code: korea.code.to_owned(),
                headline,
                local_caption: caption.clone(),
                caption,
                cultural_anchor: format!("{} 현지 맥락은 게시 전에 확인해 주세요.", korea.label),
                visual_brief: "텍스트 중심의 단순한 자체 제작 카드".to_owned(),
                why_it_works: template.why_it_works.to_owned(),
                usage_context,
            }
            .normalized()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Case {
        topic: String,
        tone: String,
        format: String,
        result: serde_json::Value,
    }

    #[test]
    fn every_case_is_what_generate_meme_concepts_returned() {
        let cases: Vec<Case> =
            serde_json::from_str(include_str!("../../../tests/fixtures/meme_studio.json"))
                .expect("fixture");
        assert_eq!(cases.len(), 228);

        for case in cases {
            let concepts = concepts(&case.topic, &case.tone, &case.format);
            let ported = serde_json::json!({ "mode": "template", "concepts": concepts });
            assert_eq!(
                ported, case.result,
                "{} / {} / {}",
                case.topic, case.tone, case.format
            );
        }
    }
}
