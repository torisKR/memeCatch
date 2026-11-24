//! `/api/meme-cards`, `/api/meme-cards/{id}`, `/api/meme-cards/collection`
//! and `/api/meme-cards/claim`.

use serde_json::{Value, json};

use super::*;

const CATEGORIES: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];
const PRIVATE: Option<&str> = Some("private, no-store");

fn card_id(number: u32) -> String {
    format!("mc-{number:04}")
}

fn meme_id(number: u32) -> String {
    format!("00000000-0000-4000-a000-{number:012}")
}

fn title(number: u32) -> String {
    match number {
        1 => "100% 리얼 밈".to_owned(),
        2 => "under_score 밈".to_owned(),
        3 => "underXscore 밈".to_owned(),
        _ => format!("카드 밈 {number}"),
    }
}

/// Cards 1 to 26 are public. Card 27 is inactive, and the memes of 28, 29
/// and 30 are limited, yellow and unpublished: none of those may be served.
async fn seed_cards(db: &Db) {
    remove_cards(db).await;
    execute(
        db,
        "insert into public.memes (id, short_id, slug, title, summary, category, origin_year,
                                   safety_level, moderation_status, published_at)
         select ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
                'r2' || lpad(n::text, 6, '0'),
                case n when 1 then 'axum-r2-밈 1/a?' else 'axum-r2-card-' || n end,
                case n when 1 then '100% 리얼 밈' when 2 then 'under_score 밈'
                       when 3 then 'underXscore 밈' else '카드 밈 ' || n end,
                n || '번 카드의 밈을 설명하는 요약이에요.',
                (array['phrase','dance','song','image','comment','challenge'])[n % 6 + 1]::meme_category,
                case when n % 5 = 0 then null else 1995 + n end,
                (case when n = 29 then 'yellow' else 'green' end)::safety_level,
                (case when n = 28 then 'limited' else 'approved' end)::moderation_status,
                case when n = 30 then null else now() end
           from generate_series(1, 30) n;
         insert into public.meme_collectible_cards (id, card_no, meme_id, edition, art_seed, active)
         select 'mc-' || lpad(n::text, 4, '0'), n,
                ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, 1, 1000 + n, n <> 27
           from generate_series(1, 30) n;"
            .to_owned(),
    )
    .await;
}

async fn remove_cards(db: &Db) {
    execute(
        db,
        "delete from public.user_meme_cards;
         delete from public.meme_collectible_cards;
         delete from public.memes where slug like 'axum-r2-%';"
            .to_owned(),
    )
    .await;
}

/// The card the routes must send for seeded card `number`, built from the
/// seed and from the catalogue.
fn card(number: u32) -> Value {
    let catalogue: Vec<Value> =
        serde_json::from_str(include_str!("../../src/routes/cards/catalog.json")).unwrap();
    let art = &catalogue[number as usize - 1];
    let slug = if number == 1 {
        "axum-r2-밈 1/a?".to_owned()
    } else {
        format!("axum-r2-card-{number}")
    };
    let href = if number == 1 {
        "/memes/r2000001-axum-r2-%EB%B0%88%201%2Fa%3F".to_owned()
    } else {
        format!("/memes/r2{number:06}-axum-r2-card-{number}")
    };
    json!({
        "id": card_id(number),
        "cardNo": number,
        "edition": 1,
        "artSeed": 1000 + number,
        "memeId": meme_id(number),
        "title": title(number),
        "slug": slug,
        "href": href,
        "summary": art["caption"],
        "category": CATEGORIES[number as usize % 6],
        "originYear": if number.is_multiple_of(5) { Value::Null } else { json!(1995 + number) },
        "thumbnailUrl": null,
        "artMotif": art["motif"],
        "artSymbols": art["symbols"],
        "artComposition": art["composition"],
    })
}

fn cards(numbers: impl IntoIterator<Item = u32>) -> Vec<Value> {
    numbers.into_iter().map(card).collect()
}

#[tokio::test]
async fn catalogue_db_lists_the_public_cards_in_card_number_order() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    seed_cards(&db).await;

    let first = get(app, "/api/meme-cards", &[]).await;
    let second = get(app, "/api/meme-cards?page=2", &[]).await;
    let past_the_end = get(app, "/api/meme-cards?page=3", &[]).await;
    let head = send(app, "HEAD", "/api/meme-cards", &[], Body::empty()).await;
    remove_cards(&db).await;
    let empty = get(app, "/api/meme-cards", &[]).await;

    assert_eq!(first.status, StatusCode::OK);
    assert_eq!(
        first.json(),
        json!({ "cards": cards(1..=24), "total": 26, "page": 1, "pageSize": 24, "hasMore": true })
    );
    assert_eq!(
        second.json(),
        json!({ "cards": cards(25..=26), "total": 26, "page": 2, "pageSize": 24, "hasMore": false })
    );
    assert_eq!(
        past_the_end.body,
        r#"{"cards":[],"total":26,"page":3,"pageSize":24,"hasMore":false}"#
    );
    assert_eq!(
        empty.body,
        r#"{"cards":[],"total":0,"page":1,"pageSize":24,"hasMore":false}"#
    );
    // The key order of the TypeScript objects.
    assert!(first.body.starts_with(
        r#"{"cards":[{"id":"mc-0001","cardNo":1,"edition":1,"artSeed":1001,"memeId":"00000000-0000-4000-a000-000000000001","title":"100% 리얼 밈","slug":"axum-r2-밈 1/a?","href":"/memes/r2000001-axum-r2-%EB%B0%88%201%2Fa%3F","summary":""#
    ));
    assert_eq!(
        first.header("cache-control"),
        Some("public, max-age=0, must-revalidate")
    );
    assert_eq!(first.header("content-type"), Some("application/json"));
    assert_eq!(first.header("x-content-type-options"), Some("nosniff"));
    assert_eq!(first.header("vary"), Some(NEXT_VARY));
    assert_eq!(head.status, StatusCode::OK);
    assert_eq!(head.body, "");
}

#[tokio::test]
async fn catalogue_db_filters_by_name_and_category_without_wildcards() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    seed_cards(&db).await;

    let mut found = Vec::new();
    for query in [
        "?query=100%25",
        "?query=under_",
        "?query=UNDER",
        "?query=%EC%B9%B4%EB%93%9C+%EB%B0%88+2",
        "?category=dance",
        "?category=dance&query=%EB%A6%AC%EC%96%BC",
        "?query=zzzz",
        "?query=%20&category=",
    ] {
        found.push(
            get(app, &format!("/api/meme-cards{query}"), &[])
                .await
                .json(),
        );
    }
    let invalid = get(app, "/api/meme-cards?category=meme", &[]).await;
    remove_cards(&db).await;

    let page = |numbers: Vec<u32>| json!({ "cards": cards(numbers.clone()), "total": numbers.len(), "page": 1, "pageSize": 24, "hasMore": false });
    // `%` and `_` match themselves: not card 2 for "100%", not card 3 for "under_".
    assert_eq!(found[0], page(vec![1]));
    assert_eq!(found[1], page(vec![2]));
    assert_eq!(found[2], page(vec![2, 3]));
    assert_eq!(found[3], page(vec![20, 21, 22, 23, 24, 25, 26]));
    assert_eq!(found[4], page(vec![1, 7, 13, 19, 25]));
    assert_eq!(found[5], page(vec![1]));
    assert_eq!(found[6], page(vec![]));
    assert_eq!(found[7]["total"], 26);
    assert_eq!(invalid.status, StatusCode::BAD_REQUEST);
    assert_eq!(invalid.body, r#"{"error":"invalid_input"}"#);
    assert_eq!(invalid.header("cache-control"), Some("no-store"));
}

#[tokio::test]
async fn card_db_reveals_a_public_card_and_no_other() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    seed_cards(&db).await;

    let public = get(app, "/api/meme-cards/mc-0005?x=1", &[]).await;
    let mut hidden = Vec::new();
    for id in ["mc-0027", "mc-0028", "mc-0029", "mc-0030", "mc-0999"] {
        hidden.push(get(app, &format!("/api/meme-cards/{id}"), &[]).await);
    }
    let invalid = get(app, "/api/meme-cards/mc-1001", &[]).await;
    remove_cards(&db).await;

    assert_eq!(public.status, StatusCode::OK);
    assert_eq!(public.json(), json!({ "card": card(5) }));
    assert!(
        public
            .body
            .contains(r#""originYear":null,"thumbnailUrl":null,"#)
    );
    assert_eq!(public.header("cache-control"), Some("no-store"));
    assert_eq!(public.header("x-content-type-options"), Some("nosniff"));
    for reply in hidden {
        assert_eq!(reply.status, StatusCode::NOT_FOUND);
        assert_eq!(reply.body, r#"{"error":"card_unavailable"}"#);
        assert_eq!(reply.header("cache-control"), Some("no-store"));
    }
    assert_eq!(invalid.status, StatusCode::BAD_REQUEST);
    assert_eq!(invalid.body, r#"{"error":"invalid_input"}"#);
    assert_eq!(invalid.header("cache-control"), Some("no-store"));
}

#[tokio::test]
async fn collection_db_shows_a_user_their_own_cards_newest_first() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    seed_cards(&db).await;
    let (owner, stranger) = (sign_in(&db).await, sign_in(&db).await);
    // Cards 2 and 7 were claimed at the same instant; 27 has since been hidden.
    execute(
        &db,
        format!(
            "insert into public.user_meme_cards (user_id, card_id, created_at) values
             ('{0}', 'mc-0001', '2026-01-01 00:00:01.123456+00'),
             ('{0}', 'mc-0007', '2026-01-01 00:00:02+00'),
             ('{0}', 'mc-0002', '2026-01-01 00:00:02+00'),
             ('{0}', 'mc-0027', '2026-01-01 00:00:03.5+00')",
            owner.id
        ),
    )
    .await;
    let as_owner = [("cookie", owner.cookie.as_str())];

    let signed_out = get(app, "/api/meme-cards/collection", &[]).await;
    let forged = get(
        app,
        "/api/meme-cards/collection",
        &[("cookie", "better-auth.session_token=forged.token")],
    )
    .await;
    let page = get(app, "/api/meme-cards/collection", &as_owner).await;
    let by_category = get(app, "/api/meme-cards/collection?category=dance", &as_owner).await;
    let hidden_category = get(app, "/api/meme-cards/collection?category=image", &as_owner).await;
    let by_name = get(app, "/api/meme-cards/collection?query=under", &as_owner).await;
    let owned = get(
        app,
        "/api/meme-cards/collection?cardIds=mc-0005,mc-0027,mc-0001,mc-0001",
        &as_owner,
    )
    .await;
    let invalid = get(
        app,
        "/api/meme-cards/collection?cardIds=mc-0001&page=1",
        &as_owner,
    )
    .await;
    let others = get(
        app,
        "/api/meme-cards/collection",
        &[("cookie", stranger.cookie.as_str())],
    )
    .await;
    remove_cards(&db).await;

    for reply in [&signed_out, &forged] {
        assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
        assert_eq!(reply.body, r#"{"error":"signed_out"}"#);
        assert_eq!(reply.header("cache-control"), PRIVATE);
    }
    let owned_card = |number: u32, claimed_at: &str| {
        let mut owned = card(number);
        owned["available"] = json!(true);
        owned["claimedAt"] = json!(claimed_at);
        owned
    };
    assert_eq!(page.status, StatusCode::OK);
    assert_eq!(
        page.json(),
        json!({
            "cards": [
                { "id": "mc-0027", "available": false, "claimedAt": "2026-01-01T00:00:03.5+00:00" },
                owned_card(2, "2026-01-01T00:00:02+00:00"),
                owned_card(7, "2026-01-01T00:00:02+00:00"),
                owned_card(1, "2026-01-01T00:00:01.123456+00:00"),
            ],
            "total": 4, "page": 1, "pageSize": 24, "hasMore": false,
        })
    );
    assert!(page.body.contains(
        r#"{"id":"mc-0027","available":false,"claimedAt":"2026-01-01T00:00:03.5+00:00"}"#
    ));
    assert!(page.body.contains(r#""artComposition":"#));
    assert!(page.body.ends_with(
        r#","available":true,"claimedAt":"2026-01-01T00:00:01.123456+00:00"}],"total":4,"page":1,"pageSize":24,"hasMore":false}"#
    ));
    assert_eq!(page.header("cache-control"), PRIVATE);
    assert_eq!(
        by_category.json()["cards"],
        json!([
            owned_card(7, "2026-01-01T00:00:02+00:00"),
            owned_card(1, "2026-01-01T00:00:01.123456+00:00")
        ])
    );
    assert_eq!(by_category.json()["total"], 2);
    // Card 27 is an image card, but a filter lists only cards still public.
    assert_eq!(
        hidden_category.body,
        r#"{"cards":[],"total":0,"page":1,"pageSize":24,"hasMore":false}"#
    );
    assert_eq!(
        by_name.json()["cards"],
        json!([owned_card(2, "2026-01-01T00:00:02+00:00")])
    );
    let mut owned_ids: Vec<String> =
        serde_json::from_value(owned.json()["ownedCardIds"].clone()).expect("ids");
    owned_ids.sort();
    assert_eq!(owned_ids, ["mc-0001", "mc-0027"]);
    assert_eq!(invalid.status, StatusCode::BAD_REQUEST);
    assert_eq!(invalid.header("cache-control"), PRIVATE);
    assert_eq!(
        others.body,
        r#"{"cards":[],"total":0,"page":1,"pageSize":24,"hasMore":false}"#
    );
}

#[tokio::test]
async fn claim_db_adds_one_row_for_the_signed_in_user_and_repeats_change_nothing() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    seed_cards(&db).await;
    // A user without an auth.users row cannot own a card (foreign key).
    let (user, orphan) = (sign_in(&db).await, sign_in_without_auth_user(&db).await);
    let claim = |cookie: Option<&str>, card: &str| {
        let body = format!(r#"{{"cardId":"{card}"}}"#);
        let cookie = cookie.map(str::to_owned);
        async move {
            let mut headers = vec![("origin", SITE_URL)];
            if let Some(cookie) = &cookie {
                headers.push(("cookie", cookie.as_str()));
            }
            post(app, "/api/meme-cards/claim", &headers, &body).await
        }
    };
    let owned_rows = || {
        rows::<(String, String, bool)>(
            &db,
            "select user_id::text, card_id, created_at > now() - interval '1 minute'
               from public.user_meme_cards order by card_id"
                .to_owned(),
        )
    };

    let signed_out = claim(None, "mc-0001").await;
    let mut unavailable = Vec::new();
    for card in ["mc-0027", "mc-0028", "mc-0029", "mc-0030", "mc-0999"] {
        unavailable.push(claim(Some(&user.cookie), card).await);
    }
    let refused = claim(Some(&orphan.cookie), "mc-0002").await;
    let before = owned_rows().await;
    let first = claim(Some(&user.cookie), "mc-0001").await;
    let again = claim(Some(&user.cookie), "mc-0001").await;
    let same_origin = post(
        app,
        "/api/meme-cards/claim",
        &[
            ("sec-fetch-site", "same-origin"),
            ("cookie", user.cookie.as_str()),
        ],
        r#"{"cardId":"mc-0001"}"#,
    )
    .await;
    let after = owned_rows().await;
    let claimed_at: Vec<(String,)> = rows(
        &db,
        "select to_json(created_at) #>> '{}' from public.user_meme_cards".to_owned(),
    )
    .await;
    remove_cards(&db).await;

    assert_eq!(signed_out.status, StatusCode::UNAUTHORIZED);
    assert_eq!(signed_out.body, r#"{"error":"signed_out"}"#);
    for reply in unavailable {
        assert_eq!(reply.status, StatusCode::NOT_FOUND);
        assert_eq!(reply.body, r#"{"error":"card_unavailable"}"#);
        assert_eq!(reply.header("cache-control"), PRIVATE);
    }
    assert_eq!(refused.status, StatusCode::CONFLICT);
    assert_eq!(refused.body, r#"{"error":"card_unavailable"}"#);
    assert_eq!(before, Vec::new(), "a refused claim writes nothing");
    assert_eq!(first.status, StatusCode::OK);
    assert_eq!(
        first.body,
        format!(
            r#"{{"cardId":"mc-0001","owned":true,"claimedAt":"{}"}}"#,
            claimed_at[0].0
        )
    );
    assert_eq!(first.header("cache-control"), PRIVATE);
    assert_eq!(first.header("x-content-type-options"), Some("nosniff"));
    // The second and third claims answer with the first one's row.
    assert_eq!(again.body, first.body);
    assert_eq!(same_origin.body, first.body);
    assert_eq!(after, vec![(user.id.clone(), "mc-0001".to_owned(), true)]);
}
