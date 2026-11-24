//! Live cross-check with the real `lib/object-storage.ts` on one shared object
//! directory. `parity/storage-parity.sh` runs it between the two halves of
//! `parity/storage-parity.mjs`. A plain `cargo test` reports it as ignored,
//! because it needs Node; `storage_signing.rs` covers the same ground from the
//! committed fixture.

mod common;

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::Bytes;
use memecatch_server::storage::Storage;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const VALID_SECONDS: u64 = 3600;
const OTHER_SECRET: &str = "live-parity-another-secret";

/// `ts.json`, written by `storage-parity.mjs seed`.
#[derive(Deserialize)]
struct TypeScriptSide {
    env: BTreeMap<String, String>,
    bucket: String,
    objects: Vec<Object>,
    /// Prefix to what `list(prefix)` returned.
    lists: BTreeMap<String, Value>,
}

#[derive(Serialize, Deserialize)]
struct Object {
    name: String,
    hex: String,
    url: String,
}

/// `(key, exp, sig)` of a signed URL. Keys here hold no escape but `%2F`.
fn parts(url: &str) -> (String, String, String) {
    let query = url.split_once('?').expect("query").1;
    let value = |name: &str| {
        let pair = query.split('&').find(|pair| pair.starts_with(name));
        pair.expect(name)[name.len()..].to_owned()
    };
    (
        value("key=").replace("%2F", "/"),
        value("exp="),
        value("sig="),
    )
}

fn storage(env: &BTreeMap<String, String>, extra: &[(&str, &str)]) -> Storage {
    let vars: Vec<(&str, &str)> = extra
        .iter()
        .copied()
        .chain(
            env.iter()
                .map(|(name, value)| (name.as_str(), value.as_str())),
        )
        .collect();
    let config = common::config(common::UNUSED_DATABASE_URL, &vars);
    Storage::new(&config).expect("storage")
}

#[tokio::test]
#[ignore = "needs Node: run parity/storage-parity.sh"]
async fn rust_and_typescript_agree_on_one_shared_directory() {
    let dir = std::env::var("STORAGE_PARITY_DIR").expect("run parity/storage-parity.sh");
    let dir = PathBuf::from(dir);
    let ts: TypeScriptSide =
        serde_json::from_str(&fs::read_to_string(dir.join("ts.json")).expect("ts.json"))
            .expect("ts.json");
    let storage = storage(&ts.env, &[]);
    let bucket = ts.bucket.as_str();

    // What the TypeScript minted and wrote.
    for object in &ts.objects {
        let (key, exp, sig) = parts(&object.url);
        let bytes = hex::decode(&object.hex).unwrap();
        assert!(storage.verify_signed_object(&key, &exp, &sig), "{key}");
        println!(
            "ok    Rust accepts the URL TypeScript minted for {}",
            object.name
        );
        let last = if sig.ends_with('0') { "1" } else { "0" };
        let changed = format!("{}{last}", &sig[..sig.len() - 1]);
        assert!(!storage.verify_signed_object(&key, &exp, &changed), "{key}");
        let later = (exp.parse::<u64>().unwrap() + 1).to_string();
        assert!(!storage.verify_signed_object(&key, &later, &sig), "{key}");
        println!("ok      changed signature and changed expiry: rejected");
        let by_key = storage.read_signed_object(&key).await.unwrap().unwrap();
        assert_eq!(by_key.bytes, bytes, "{key}");
        let by_name = storage.get(bucket, &object.name).await.unwrap().unwrap();
        assert_eq!(by_name.bytes, bytes, "{key}");
        println!("ok      Rust reads the bytes TypeScript wrote");
    }
    for (prefix, entries) in &ts.lists {
        let listed = storage.list(bucket, prefix).await.unwrap();
        assert_eq!(
            &serde_json::to_value(&listed).unwrap(),
            entries,
            "{prefix:?}"
        );
        println!("ok    list({prefix:?}) equals what TypeScript listed");
    }

    // What Rust writes and mints, for the TypeScript to check.
    let mut objects = Vec::new();
    for (name, bytes) in [
        ("rust/a.txt", b"written by Rust\n".to_vec()),
        ("rust/nested/b.bin", (0..=255u8).rev().collect()),
        ("rust/nested/deeper/c.txt", b"three levels down".to_vec()),
    ] {
        let hex = hex::encode(&bytes);
        storage
            .put(bucket, name, Bytes::from(bytes), Some("text/plain"))
            .await
            .unwrap();
        let url = storage
            .signed_object_url(bucket, name, VALID_SECONDS)
            .unwrap();
        objects.push(Object {
            name: name.to_owned(),
            hex,
            url,
        });
    }
    let deleted = "ts/delete-me.txt";
    storage.delete(bucket, deleted).await.unwrap();

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    let expired_url = storage
        .signed_object_url_at(bucket, "rust/a.txt", 60, now_ms - 600_000)
        .unwrap();
    let other_secret_url = self::storage(&ts.env, &[("OBJECT_SIGNING_SECRET", OTHER_SECRET)])
        .signed_object_url(bucket, "rust/a.txt", VALID_SECONDS)
        .unwrap();
    let mut lists = BTreeMap::new();
    for prefix in [
        "",
        "ts",
        "rust",
        "rust/nested",
        "rust/nested/deeper",
        "rust/missing",
    ] {
        lists.insert(prefix, storage.list(bucket, prefix).await.unwrap());
    }

    let rust_side = json!({
        "objects": objects,
        "expiredUrl": expired_url,
        "otherSecretUrl": other_secret_url,
        "otherSecret": OTHER_SECRET,
        "deleted": deleted,
        "lists": lists,
    });
    fs::write(
        dir.join("rust.json"),
        serde_json::to_string_pretty(&rust_side).unwrap(),
    )
    .unwrap();
    println!("ok    Rust wrote {} objects and rust.json", objects.len());
}
