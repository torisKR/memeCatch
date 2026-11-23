//! The local-directory backend, used when R2 is not configured:
//! `uploadLocal`, `downloadLocal`, `removeLocal` and `listLocal` of
//! `lib/object-storage.ts`.

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use axum::body::{Body, Bytes};
use time::OffsetDateTime;
use tokio::io::AsyncReadExt;

use super::{DEFAULT_CONTENT_TYPE, ListEntry, ObjectStream, StorageError, StoredObject};

/// How much of a file [`open`] holds at a time.
const STREAM_CHUNK_BYTES: usize = 64 * 1024;

pub(super) async fn put(root: &Path, key: &str, bytes: Bytes) -> Result<(), StorageError> {
    let file = root.join(key);
    if let Some(parent) = file.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(StorageError::Io)?;
    }
    tokio::fs::write(file, bytes)
        .await
        .map_err(StorageError::Io)
}

pub(super) async fn delete(root: &Path, key: &str) -> Result<(), StorageError> {
    match tokio::fs::remove_file(root.join(key)).await {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(StorageError::Io(error)),
        _ => Ok(()),
    }
}

/// As in the TypeScript, a file that cannot be read for any reason counts as
/// missing.
pub(super) async fn read(root: &Path, key: &str) -> Option<StoredObject> {
    tokio::fs::read(root.join(key))
        .await
        .ok()
        .map(|bytes| StoredObject {
            bytes: bytes.into(),
            content_type: DEFAULT_CONTENT_TYPE.to_owned(),
        })
}

/// [`read`] without holding the file: the body reads it a chunk at a time.
/// A file that cannot be opened, or is not a regular file, counts as missing.
/// A failure after that ends the body early.
pub(super) async fn open(root: &Path, key: &str) -> Option<ObjectStream> {
    let file = tokio::fs::File::open(root.join(key)).await.ok()?;
    // A directory opens too; only reading it fails.
    if !file.metadata().await.ok()?.is_file() {
        return None;
    }
    let chunks = futures_util::stream::try_unfold(file, |mut file| async move {
        let mut chunk = vec![0; STREAM_CHUNK_BYTES];
        let read = file.read(&mut chunk).await?;
        chunk.truncate(read);
        Ok::<_, std::io::Error>((read > 0).then(|| (Bytes::from(chunk), file)))
    });
    Some(ObjectStream {
        body: Body::from_stream(chunks),
        content_type: DEFAULT_CONTENT_TYPE.to_owned(),
    })
}

/// The entries directly under the directory `base`.
pub(super) async fn list(base: PathBuf) -> Result<Vec<ListEntry>, StorageError> {
    // A directory that cannot be read lists as empty, as in the TypeScript.
    let Ok(mut dir) = tokio::fs::read_dir(&base).await else {
        return Ok(Vec::new());
    };
    let mut names = Vec::new();
    loop {
        match dir.next_entry().await {
            Ok(Some(entry)) => names.push(entry.file_name().to_string_lossy().into_owned()),
            Ok(None) => break,
            Err(_) => return Ok(Vec::new()),
        }
    }
    // JavaScript sorts strings by UTF-16 code unit.
    names.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    let mut entries = Vec::with_capacity(names.len());
    for name in names {
        let info = tokio::fs::metadata(base.join(&name))
            .await
            .map_err(StorageError::Io)?;
        let is_file = info.is_file();
        entries.push(ListEntry {
            id: is_file.then(|| name.clone()),
            created_at: if is_file {
                info.modified().ok().and_then(js_mtime_iso)
            } else {
                None
            },
            name,
        });
    }
    Ok(entries)
}

/// Node's `stats.mtime.toISOString()`.
fn js_mtime_iso(modified: SystemTime) -> Option<String> {
    // Node computes `sec * 1e3 + nsec / 1e6` in doubles and rounds to a whole
    // millisecond with `Math.round`. The same arithmetic gives the same result.
    let as_ms = |d: Duration| d.as_secs() as f64 * 1e3 + f64::from(d.subsec_nanos()) / 1e6;
    let ms = match modified.duration_since(UNIX_EPOCH) {
        Ok(after) => as_ms(after),
        Err(before) => -as_ms(before.duration()),
    };
    let ms = (ms + 0.5).floor() as i128;
    let format = time::format_description::parse_borrowed::<3>(
        "[year]-[month]-[day]T[hour]:[minute]:[second].[subsecond digits:3]Z",
    )
    .ok()?;
    OffsetDateTime::from_unix_timestamp_nanos(ms * 1_000_000)
        .ok()?
        .format(&format)
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn js_mtime_iso_rounds_to_the_millisecond_like_node() {
        let at = |secs, nanos| UNIX_EPOCH + Duration::new(secs, nanos);

        for (modified, expected) in [
            (at(1_764_000_000, 0), "2025-11-24T16:00:00.000Z"),
            (at(1_764_000_000, 123_456_789), "2025-11-24T16:00:00.123Z"),
            (at(1_764_000_000, 123_500_000), "2025-11-24T16:00:00.124Z"),
            (at(1_764_000_000, 999_500_000), "2025-11-24T16:00:01.000Z"),
            (at(0, 0), "1970-01-01T00:00:00.000Z"),
        ] {
            assert_eq!(js_mtime_iso(modified).as_deref(), Some(expected));
        }
    }

    #[tokio::test]
    async fn open_reads_a_file_a_chunk_at_a_time() {
        use http_body_util::BodyExt;

        let root = tempfile::tempdir().unwrap();
        // Three and a bit chunks, every byte different from its neighbours.
        let content: Vec<u8> = (0..STREAM_CHUNK_BYTES * 3 + 1000)
            .map(|i| (i % 251) as u8)
            .collect();
        tokio::fs::create_dir(root.path().join("dir"))
            .await
            .unwrap();
        tokio::fs::write(root.path().join("dir/big.bin"), &content)
            .await
            .unwrap();

        let mut object = open(root.path(), "dir/big.bin").await.expect("object");
        let mut frame_sizes = Vec::new();
        let mut read = Vec::new();
        while let Some(frame) = object.body.frame().await {
            let data = frame.unwrap().into_data().unwrap();
            frame_sizes.push(data.len());
            read.extend_from_slice(&data);
        }

        assert_eq!(read, content);
        assert!(frame_sizes.len() >= 4, "{frame_sizes:?}");
        assert!(
            frame_sizes.iter().all(|size| *size <= STREAM_CHUNK_BYTES),
            "{frame_sizes:?}"
        );
        assert_eq!(object.content_type, DEFAULT_CONTENT_TYPE);
        // As for `read`: a folder and a missing file are both "no such object".
        assert!(open(root.path(), "dir").await.is_none());
        assert!(open(root.path(), "dir/missing.bin").await.is_none());
        assert!(open(root.path(), "dir/big.bin/below").await.is_none());
    }
}
