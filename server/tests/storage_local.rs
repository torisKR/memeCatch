//! The local-directory backend: what `lib/object-storage.ts` does when the four
//! `R2_*` values are not all set. `parity/storage-parity.sh` runs the same
//! operations against the TypeScript on one shared directory.

mod common;

use std::fs;
use std::time::{Duration, UNIX_EPOCH};

use axum::body::Bytes;
use memecatch_server::storage::{ListEntry, Storage, StorageError};
use tempfile::TempDir;

fn storage_in(root: &TempDir, extra: &[(&str, &str)]) -> Storage {
    let dir = [("LOCAL_OBJECT_STORAGE_DIR", root.path().to_str().unwrap())];
    let config = common::config(common::UNUSED_DATABASE_URL, &[&dir[..], extra].concat());
    Storage::new(&config).expect("storage")
}

fn local_storage() -> (TempDir, Storage) {
    let root = tempfile::tempdir().expect("temp dir");
    let storage = storage_in(&root, &[]);
    (root, storage)
}

fn file(name: &str, created_at: &str) -> ListEntry {
    ListEntry {
        name: name.to_owned(),
        id: Some(name.to_owned()),
        created_at: Some(created_at.to_owned()),
    }
}

fn folder(name: &str) -> ListEntry {
    ListEntry {
        name: name.to_owned(),
        id: None,
        created_at: None,
    }
}

#[tokio::test]
async fn put_then_get_returns_the_bytes_under_the_generic_content_type() {
    let (root, storage) = local_storage();
    let bytes = Bytes::from((0..=255u8).collect::<Vec<u8>>());

    storage
        .put("uploads", "2026/11/a.png", bytes.clone(), Some("image/png"))
        .await
        .unwrap();
    let stored = storage.get("uploads", "2026/11/a.png").await.unwrap();

    let stored = stored.expect("stored object");
    assert_eq!(stored.bytes, bytes);
    // The local backend keeps no content type, as in the TypeScript.
    assert_eq!(stored.content_type, "application/octet-stream");
    assert_eq!(
        fs::read(root.path().join("uploads/2026/11/a.png")).unwrap(),
        bytes
    );
}

#[tokio::test]
async fn put_replaces_an_existing_object() {
    let (_root, storage) = local_storage();
    storage
        .put(
            "uploads",
            "a.txt",
            Bytes::from_static(b"first, longer"),
            None,
        )
        .await
        .unwrap();

    storage
        .put("uploads", "a.txt", Bytes::from_static(b"second"), None)
        .await
        .unwrap();

    let stored = storage.get("uploads", "a.txt").await.unwrap().unwrap();
    assert_eq!(stored.bytes, "second");
}

#[tokio::test]
async fn get_of_a_missing_object_or_of_a_folder_is_none() {
    let (_root, storage) = local_storage();
    storage
        .put("uploads", "dir/a.txt", Bytes::from_static(b"x"), None)
        .await
        .unwrap();

    assert_eq!(storage.get("uploads", "missing.txt").await.unwrap(), None);
    assert_eq!(storage.get("no-such-bucket", "a.txt").await.unwrap(), None);
    assert_eq!(storage.get("uploads", "dir").await.unwrap(), None);
    assert_eq!(
        storage.get("uploads", "dir/a.txt/below").await.unwrap(),
        None
    );
}

#[tokio::test]
async fn delete_removes_the_object_and_accepts_a_missing_one() {
    let (root, storage) = local_storage();
    storage
        .put("uploads", "dir/a.txt", Bytes::from_static(b"x"), None)
        .await
        .unwrap();

    storage.delete("uploads", "dir/a.txt").await.unwrap();

    assert_eq!(storage.get("uploads", "dir/a.txt").await.unwrap(), None);
    assert!(!root.path().join("uploads/dir/a.txt").exists());
    storage.delete("uploads", "dir/a.txt").await.unwrap();
    storage.delete("no-such-bucket", "a.txt").await.unwrap();
    // Like `rm` without `recursive`, a folder is not removed.
    let folder = storage.delete("uploads", "dir").await;
    assert!(matches!(folder, Err(StorageError::Io(_))), "{folder:?}");
    assert!(root.path().join("uploads/dir").is_dir());
}

#[tokio::test]
async fn list_returns_files_and_folders_in_javascript_name_order() {
    let (root, storage) = local_storage();
    for name in ["a.txt", "B.txt", "_x", "10", "9", "nested/deeper/c.txt"] {
        storage
            .put("uploads", name, Bytes::from_static(b"x"), None)
            .await
            .unwrap();
    }
    storage
        .put("other", "elsewhere.txt", Bytes::from_static(b"x"), None)
        .await
        .unwrap();
    // 2025-11-24T16:00:00Z plus a fraction that rounds up to .124 in Node.
    let modified = UNIX_EPOCH + Duration::new(1_764_000_000, 123_500_000);
    for path in [
        "uploads/a.txt",
        "uploads/B.txt",
        "uploads/_x",
        "uploads/10",
        "uploads/9",
    ] {
        let file = fs::File::options().write(true).open(root.path().join(path));
        file.unwrap().set_modified(modified).unwrap();
    }
    let at = "2025-11-24T16:00:00.124Z";

    let listed = storage.list("uploads", "").await.unwrap();

    assert_eq!(
        listed,
        [
            file("10", at),
            file("9", at),
            file("B.txt", at),
            file("_x", at),
            file("a.txt", at),
            folder("nested"),
        ]
    );
    assert_eq!(
        serde_json::to_string(&listed[4..]).unwrap(),
        r#"[{"name":"a.txt","id":"a.txt","created_at":"2025-11-24T16:00:00.124Z"},{"name":"nested","id":null,"created_at":null}]"#
    );
}

#[tokio::test]
async fn list_of_a_nested_prefix_a_file_or_a_missing_folder() {
    let (_root, storage) = local_storage();
    storage
        .put(
            "uploads",
            "nested/deeper/c.txt",
            Bytes::from_static(b"x"),
            None,
        )
        .await
        .unwrap();

    assert_eq!(
        storage.list("uploads", "nested").await.unwrap(),
        [folder("deeper")]
    );
    let deeper = storage.list("uploads", "/nested//deeper/").await.unwrap();
    assert_eq!(deeper.len(), 1);
    assert_eq!(deeper[0].name, "c.txt");
    assert_eq!(deeper[0].id.as_deref(), Some("c.txt"));
    let created_at = deeper[0].created_at.as_deref().expect("created_at");
    // toISOString: 2026-11-23T08:02:11.123Z
    assert_eq!(created_at.len(), 24, "{created_at}");
    assert!(created_at.ends_with('Z') && created_at.as_bytes()[10] == b'T');

    assert_eq!(storage.list("uploads", "missing").await.unwrap(), []);
    assert_eq!(storage.list("no-such-bucket", "").await.unwrap(), []);
    assert_eq!(
        storage
            .list("uploads", "nested/deeper/c.txt")
            .await
            .unwrap(),
        []
    );
}

#[tokio::test]
async fn every_operation_refuses_a_name_outside_the_safe_alphabet() {
    let (root, storage) = local_storage();

    for (bucket, name) in [
        ("uploads", "한글.png"),
        ("uploads", "with space.png"),
        ("uploads", ".."),
        ("uploads", ""),
        ("", "a.png"),
        ("up loads", "a.png"),
    ] {
        let put = storage
            .put(bucket, name, Bytes::from_static(b"x"), None)
            .await;
        assert!(matches!(put, Err(StorageError::InvalidKey)), "{name:?}");
        let got = storage.get(bucket, name).await;
        assert!(matches!(got, Err(StorageError::InvalidKey)), "{name:?}");
        let deleted = storage.delete(bucket, name).await;
        assert!(matches!(deleted, Err(StorageError::InvalidKey)), "{name:?}");
    }
    for (bucket, prefix) in [("uploads", "한글"), ("uploads", ".."), ("", "")] {
        let listed = storage.list(bucket, prefix).await;
        assert!(
            matches!(listed, Err(StorageError::InvalidKey)),
            "{prefix:?}"
        );
    }
    assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0);
}

#[tokio::test]
async fn dot_segments_cannot_reach_outside_the_storage_root() {
    let outer = tempfile::tempdir().unwrap();
    fs::create_dir(outer.path().join("objects")).unwrap();
    fs::write(outer.path().join("outside.txt"), "not an object").unwrap();
    let dir = outer.path().join("objects");
    let config = common::config(
        common::UNUSED_DATABASE_URL,
        &[("LOCAL_OBJECT_STORAGE_DIR", dir.to_str().unwrap())],
    );
    let storage = Storage::new(&config).unwrap();

    // `safe_key` accepts these (it drops the dot segments). The TypeScript then
    // reads the key as given and would return outside.txt for the first two.
    for key in [
        "../outside.txt",
        "uploads/../../outside.txt",
        "/../outside.txt",
    ] {
        assert_eq!(
            storage.read_signed_object(key).await.unwrap(),
            None,
            "{key}"
        );
    }
    let dot_bucket = storage.get("..", "outside.txt").await;
    assert!(matches!(dot_bucket, Err(StorageError::InvalidKey)));
    let dot_name = storage.get("uploads", "../../outside.txt").await;
    assert_eq!(dot_name.unwrap(), None);
    storage
        .put(
            "uploads",
            "../../escaped.txt",
            Bytes::from_static(b"x"),
            None,
        )
        .await
        .unwrap();
    assert!(!outer.path().join("escaped.txt").exists());
    assert!(dir.join("uploads/escaped.txt").is_file());
}

#[tokio::test]
async fn r2_values_that_are_not_all_set_leave_the_local_directory_in_use() {
    let root = tempfile::tempdir().unwrap();
    let storage = storage_in(
        &root,
        &[
            ("R2_ACCOUNT_ID", "account"),
            ("R2_ACCESS_KEY_ID", "access-key"),
            ("R2_SECRET_ACCESS_KEY", ""),
            ("R2_BUCKET", "bucket"),
        ],
    );

    storage
        .put("uploads", "a.txt", Bytes::from_static(b"local"), None)
        .await
        .unwrap();

    assert_eq!(
        fs::read(root.path().join("uploads/a.txt")).unwrap(),
        b"local"
    );
}
