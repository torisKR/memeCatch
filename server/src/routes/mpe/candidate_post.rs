//! `POST /api/admin/mpe-candidates`: the `POST` of
//! `app/api/admin/mpe-candidates/route.ts`. Route id
//! `admin-mpe-candidates-post`.
//!
//! An operator creates a candidate from a processed ingestion, matches a
//! candidate against the catalogue, or drafts its evidence with OpenRouter.
//! Both stores at the end (`replace_mpe_candidate_matches`,
//! `replace_mpe_candidate_evidence`) fail in the TypeScript, which sends an
//! array argument as `text[]`; this port fails there too (PLAN.md section 10).

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;

use super::candidates::refused;
use super::renders::is_zod_uuid;
use super::{create, draft, failure, json, matches, no_store};
use crate::auth::{SessionUser, is_operator};
use crate::routes::openrouter::OpenRouter;
use crate::routes::public::js;
use crate::routes::request::{self, Json, SiteOrigin};
use crate::{AppState, proxy};

/// Next reads any length; this server stops at 1 MiB and answers as for
/// a body that is not JSON.
const MAX_BODY_BYTES: usize = 1024 * 1024;

/// `MEME_TYPES` of `postSchema`.
const MEME_TYPES: [&str; 9] = [
    "PHRASE",
    "REACTION_IMAGE",
    "VIDEO_SCENE",
    "SOUND",
    "CHALLENGE",
    "IMAGE_TEMPLATE",
    "CHARACTER",
    "EVENT_RECORD",
    "OTHER",
];

/// What `errorResponse` makes of a throw: an `MpeCandidateError` or
/// `EvidenceDraftError` (its status and message), or anything else (500).
#[derive(Debug, PartialEq, Eq)]
pub enum Refusal {
    Coded(StatusCode, String),
    Plain,
}

impl Refusal {
    pub fn coded(status: u16, message: String) -> Self {
        Self::Coded(StatusCode::from_u16(status).expect("a status"), message)
    }

    fn response(self) -> Response {
        match self {
            Self::Coded(status, message) => {
                let message = serde_json::to_string(&message).expect("a string serializes");
                json(status, format!(r#"{{"ok":false,"error":{message}}}"#))
            }
            Self::Plain => failure(StatusCode::INTERNAL_SERVER_ERROR, "mpe_candidate_failed"),
        }
    }
}

/// `requireOperator(client)`: the session is the route's; `is_operator` is
/// asked again, and an error counts as no.
pub async fn require_operator(state: &AppState, user: &SessionUser) -> Result<(), Refusal> {
    match is_operator(state, user).await {
        Ok(true) => Ok(()),
        _ => Err(Refusal::coded(403, "operator_required".to_owned())),
    }
}

/// `postSchema`, a union: the first branch that fits.
#[derive(Debug, PartialEq, Eq)]
pub enum Input {
    Create {
        ingestion: String,
        title: String,
        meme_type: String,
    },
    Matches(String),
    Draft(String),
}

fn uuid(entries: &[(String, Json)], key: &str) -> Option<String> {
    request::property(entries, key)?
        .as_str()
        .filter(|value| is_zod_uuid(value))
        .map(str::to_owned)
}

fn create_input(entries: &[(String, Json)]) -> Option<Input> {
    if request::property(entries, "action")?.as_str()? != "create" {
        return None;
    }
    let ingestion = uuid(entries, "ingestionId")?;
    let title = js::trim(request::property(entries, "title")?.as_str()?);
    let meme_type = request::property(entries, "memeType")?.as_str()?;
    ((1..=200).contains(&js::utf16_len(title)) && MEME_TYPES.contains(&meme_type)).then(|| {
        Input::Create {
            ingestion,
            title: title.to_owned(),
            meme_type: meme_type.to_owned(),
        }
    })
}

fn candidate_input(entries: &[(String, Json)]) -> Option<Input> {
    let candidate = uuid(entries, "candidateId")?;
    match request::property(entries, "action") {
        None => Some(Input::Matches(candidate)),
        Some(action) => match action.as_str()? {
            "matches" => Some(Input::Matches(candidate)),
            "evidence_draft" => Some(Input::Draft(candidate)),
            _ => None,
        },
    }
}

/// `postSchema.safeParse(await request.json().catch(() => null))`.
pub fn parse(text: Option<&str>) -> Option<Input> {
    let payload = Json::parse(text?)?;
    let entries = payload.as_object()?;
    create_input(entries).or_else(|| candidate_input(entries))
}

async fn body_text(body: Body) -> Option<String> {
    let bytes = request::read_at_most(body, MAX_BODY_BYTES).await.ok()?;
    Some(request::decode_text(&bytes))
}

pub async fn post(
    State(state): State<AppState>,
    site: SiteOrigin,
    client: OpenRouter,
    request: Request,
) -> Response {
    let trusted = request::trusted_origin(request.headers(), &site);
    let (true, Some(trusted)) = (request::has_ascii_target(request.uri()), trusted) else {
        return proxy::forward(State(state), request).await;
    };
    if !trusted {
        return failure(StatusCode::FORBIDDEN, "invalid_origin");
    }
    let (mut parts, body) = request.into_parts();
    let user = match refused(&state, &mut parts).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let Some(input) = parse(body_text(body).await.as_deref()) else {
        return failure(StatusCode::BAD_REQUEST, "invalid_input");
    };
    let answer = match input {
        Input::Create {
            ingestion,
            title,
            meme_type,
        } => create_and_match(&state, &client, &user, &ingestion, &title, &meme_type).await,
        Input::Matches(candidate) => {
            matches::generate(&state, &user, &candidate)
                .await
                .map(|rows| {
                    format!(
                        "[{}]",
                        rows.iter()
                            .map(|row| stringified(row))
                            .collect::<Vec<_>>()
                            .join(",")
                    )
                })
        }
        Input::Draft(candidate) => draft::generate(&state, &client, &user, &candidate).await,
    };
    match answer {
        Ok(data) => no_store(StatusCode::OK, format!(r#"{{"ok":true,"data":{data}}}"#)),
        Err(refusal) => refusal.response(),
    }
}

/// A row as Next passes it on: `JSON.stringify(JSON.parse(row))`.
fn stringified(row: &str) -> String {
    Json::parse(row).map_or_else(
        || "null".to_owned(),
        |row| crate::routes::js_json::stringify_parsed(&row),
    )
}

/// The `create` action: the candidate, then its matches and its draft. A
/// candidate this call created is deleted again when either fails.
async fn create_and_match(
    state: &AppState,
    client: &OpenRouter,
    user: &SessionUser,
    ingestion: &str,
    title: &str,
    meme_type: &str,
) -> Result<String, Refusal> {
    let created = create::create(state, user, ingestion, title, meme_type).await?;
    let outcome = async {
        let matches = matches::generate(state, user, &created.id).await?;
        let draft = draft::generate(state, client, user, &created.id).await?;
        Ok::<_, Refusal>((matches, draft))
    }
    .await;
    match outcome {
        Ok((matches, draft)) => {
            let matches: Vec<String> = matches.iter().map(|row| stringified(row)).collect();
            Ok(format!(
                r#"{{"candidate":{},"created":{},"matches":[{}],"draft":{draft}}}"#,
                stringified(&created.row),
                created.created,
                matches.join(",")
            ))
        }
        Err(refusal) => {
            if created.created {
                create::discard(state, user, &created.id).await?;
            }
            Err(refusal)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "c5c00000-0000-4000-8000-000000000001";

    #[test]
    fn the_union_takes_the_first_branch_that_fits() {
        let create = format!(
            r#"{{"action":"create","ingestionId":"{ID}","title":"  제목 ","memeType":"OTHER","x":1}}"#
        );
        assert_eq!(
            parse(Some(&create)),
            Some(Input::Create {
                ingestion: ID.to_owned(),
                title: "제목".to_owned(),
                meme_type: "OTHER".to_owned()
            })
        );
        assert_eq!(
            parse(Some(&format!(r#"{{"candidateId":"{ID}"}}"#))),
            Some(Input::Matches(ID.to_owned()))
        );
        let draft = format!(r#"{{"candidateId":"{ID}","action":"evidence_draft"}}"#);
        assert_eq!(parse(Some(&draft)), Some(Input::Draft(ID.to_owned())));
        // A create that does not fit is not a candidate action either.
        let half = format!(r#"{{"action":"create","candidateId":"{ID}"}}"#);
        assert_eq!(parse(Some(&half)), None);
        // `create` with a candidate id and a valid create body: the first branch.
        let both = format!(
            r#"{{"action":"create","ingestionId":"{ID}","title":"t","memeType":"SOUND","candidateId":"{ID}"}}"#
        );
        assert!(matches!(parse(Some(&both)), Some(Input::Create { .. })));
        for refused in [
            format!(r#"{{"candidateId":"{ID}","action":null}}"#),
            format!(
                r#"{{"action":"create","ingestionId":"{ID}","title":"   ","memeType":"OTHER"}}"#
            ),
            format!(r#"{{"action":"create","ingestionId":"{ID}","title":"t","memeType":"other"}}"#),
            r#"{"candidateId":"not-a-uuid"}"#.to_owned(),
            "[]".to_owned(),
            "{".to_owned(),
        ] {
            assert_eq!(parse(Some(&refused)), None, "{refused}");
        }
        assert_eq!(parse(None), None);
    }
}
