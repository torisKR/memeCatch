//! Object storage, ported from `lib/object-storage.ts`: R2 over the S3 API when
//! all four `R2_*` values are set, otherwise a directory on local disk.
//!
//! Route code calls the methods on [`Storage`] (`state.storage`):
//!
//! | TypeScript | Rust |
//! | --- | --- |
//! | `from(bucket).upload(name, body, { contentType })` | [`Storage::put`] |
//! | `from(bucket).download(name)` | [`Storage::get`] |
//! | `from(bucket).remove([name])` | [`Storage::delete`], once per name |
//! | `from(bucket).list(prefix)` | [`Storage::list`] |
//! | `from(bucket).createSignedUrl(name, seconds)` | [`Storage::signed_object_url`] |
//! | `verifySignedObject(key, exp, sig)` | [`Storage::verify_signed_object`] |
//! | `readSignedObject(key)` | [`Storage::read_signed_object`], or [`Storage::open_signed_object`] to stream it |
//!
//! Signed URLs are interchangeable with the TypeScript ones in both directions.
//! `tests/fixtures/object-storage-ts.json` holds what the TypeScript produces and
//! `parity/storage-parity.sh` checks both directions live.
//!
//! As in the TypeScript, the local backend does not store the content type,
//! `list` on R2 reads only the first page (1000 keys), and a failed R2 delete
//! is not an error (here it is logged).
//!
//! Where this differs from the TypeScript on purpose:
//!
//! - [`Storage::read_signed_object`] reads the cleaned key. The TypeScript
//!   checks the key and then reads it as given, so a signed `../x` leaves the
//!   storage root there. Keys the application signs are already clean.
//! - [`Storage::list`] on R2 reads each `<Contents>` whatever the order of its
//!   children. The TypeScript needs `<Key>` before `<LastModified>`.

mod local;
mod r2;
mod signing;

use std::fmt;
use std::path::PathBuf;
use std::sync::Arc;

use aws_credential_types::Credentials;
use axum::body::{Body, Bytes};
use axum::http::StatusCode;
use serde::Serialize;

use self::r2::R2;
use crate::config::{Config, Secret};

const DEFAULT_CONTENT_TYPE: &str = "application/octet-stream";
// `signedObjectUrl` in lib/object-storage.ts has its own default site, not
// `Config::site_url`'s. Both compose files always set the variable.
const DEFAULT_SIGNED_URL_SITE: &str = "http://localhost:3000";

#[derive(Debug)]
pub enum StorageError {
    /// A bucket, name or key that `safe_key` rejects.
    InvalidKey,
    /// R2 answered with a status that is not a success.
    Status(StatusCode),
    /// The request to R2 could not be signed, sent or read.
    Transport(String),
    /// The local directory could not be read or written.
    Io(std::io::Error),
}

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidKey => f.write_str("invalid object key"),
            Self::Status(status) => write!(f, "object storage answered {status}"),
            Self::Transport(message) => write!(f, "object storage request failed: {message}"),
            Self::Io(error) => write!(f, "local object storage failed: {error}"),
        }
    }
}

impl std::error::Error for StorageError {}

/// The bytes of one object and its content type.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StoredObject {
    pub bytes: Bytes,
    pub content_type: String,
}

/// One object whose bytes are read as `body` is read, and its content type.
pub struct ObjectStream {
    pub body: Body,
    pub content_type: String,
}

/// One `list` entry, with the field names the TypeScript returns. A folder has
/// no `id` and no `created_at`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ListEntry {
    pub name: String,
    pub id: Option<String>,
    pub created_at: Option<String>,
}

/// Drops empty, `.` and `..` segments and joins the rest with `/`. Every
/// remaining segment must match `[A-Za-z0-9_.-]+` (JavaScript `[\w.-]+`), and
/// at least one must remain.
pub fn safe_key(value: &str) -> Result<String, StorageError> {
    let parts: Vec<&str> = value
        .split('/')
        .filter(|part| !matches!(*part, "" | "." | ".."))
        .collect();
    let is_safe = |part: &&str| {
        part.bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'))
    };
    if parts.is_empty() || !parts.iter().all(is_safe) {
        return Err(StorageError::InvalidKey);
    }
    Ok(parts.join("/"))
}

/// The storage key of `name` in `bucket`: `<safe bucket>/<safe name>`.
pub fn object_key(bucket: &str, name: &str) -> Result<String, StorageError> {
    Ok(format!("{}/{}", safe_key(bucket)?, safe_key(name)?))
}

/// Held in `AppState` as `state.storage`. Cheap to clone.
#[derive(Clone)]
pub struct Storage(Arc<Inner>);

struct Inner {
    /// `OBJECT_SIGNING_SECRET`, or `BETTER_AUTH_SECRET` when that is not set.
    /// Both trimmed, as the TypeScript trims them.
    signing_secret: Secret,
    /// `NEXT_PUBLIC_SITE_URL` without trailing slashes, or
    /// `DEFAULT_SIGNED_URL_SITE` when it is unset.
    site_url: String,
    backend: Backend,
}

enum Backend {
    Local { root: PathBuf },
    R2(Box<R2>),
}

impl Storage {
    pub fn new(config: &Config) -> Result<Self, String> {
        let endpoint = config
            .r2
            .as_ref()
            .map(|r2| format!("https://{}.r2.cloudflarestorage.com", r2.account_id));
        Self::build(config, endpoint.as_deref())
    }

    /// For tests only: sends the S3 requests to `endpoint` (for example
    /// `http://127.0.0.1:9000`), not to Cloudflare. No environment variable
    /// reaches this.
    #[doc(hidden)]
    pub fn with_r2_endpoint(config: &Config, endpoint: &str) -> Result<Self, String> {
        Self::build(config, Some(endpoint.trim_end_matches('/')))
    }

    fn build(config: &Config, endpoint: Option<&str>) -> Result<Self, String> {
        let backend = match (&config.r2, endpoint) {
            (Some(r2), Some(endpoint)) => Backend::R2(Box::new(R2::new(
                Credentials::new(
                    r2.access_key_id.as_str(),
                    r2.secret_access_key.expose(),
                    None,
                    None,
                    "memecatch-config",
                ),
                format!("{endpoint}/{}", r2.bucket),
            )?)),
            _ => Backend::Local {
                root: PathBuf::from(&config.local_object_storage_dir),
            },
        };
        Ok(Self(Arc::new(Inner {
            signing_secret: config
                .object_signing_secret
                .clone()
                // `process.env.BETTER_AUTH_SECRET?.trim()` in lib/object-storage.ts.
                .unwrap_or_else(|| Secret::new(config.better_auth_secret.expose().trim())),
            site_url: config
                .site_url_env
                .as_deref()
                .unwrap_or(DEFAULT_SIGNED_URL_SITE)
                .trim_end_matches('/')
                .to_owned(),
            backend,
        })))
    }

    /// Whether objects are kept in this server's own directory, not in R2.
    /// Next in another container has a directory of its own, so an object
    /// that is not found here may still exist there.
    pub fn is_local(&self) -> bool {
        matches!(self.0.backend, Backend::Local { .. })
    }

    /// The object a signed URL names. `Ok(None)`: no such object.
    ///
    /// Reads `safe_key(key)`. For a key that is not in that form already (a
    /// leading or doubled slash, `.` or `..` segments) the TypeScript reads the
    /// key as given, and `..` walks out of the storage root there. Only the
    /// holder of the signing secret can sign such a key.
    pub async fn read_signed_object(
        &self,
        key: &str,
    ) -> Result<Option<StoredObject>, StorageError> {
        self.read(&safe_key(key)?).await
    }

    /// [`Self::read_signed_object`] for an object of any size: nothing is
    /// read until the body is, and never more than a chunk is held. The route
    /// uses this, because a render video can be larger than this server's
    /// memory.
    pub async fn open_signed_object(
        &self,
        key: &str,
    ) -> Result<Option<ObjectStream>, StorageError> {
        let key = safe_key(key)?;
        match &self.0.backend {
            Backend::R2(r2) => r2.open(&key).await,
            Backend::Local { root } => Ok(local::open(root, &key).await),
        }
    }

    /// The object `name` in `bucket`. `Ok(None)`: no such object.
    pub async fn get(
        &self,
        bucket: &str,
        name: &str,
    ) -> Result<Option<StoredObject>, StorageError> {
        self.read(&object_key(bucket, name)?).await
    }

    /// Stores `bytes` as `name` in `bucket`, replacing what is there.
    /// `content_type` defaults to `application/octet-stream`; only R2 keeps it.
    pub async fn put(
        &self,
        bucket: &str,
        name: &str,
        bytes: Bytes,
        content_type: Option<&str>,
    ) -> Result<(), StorageError> {
        let key = object_key(bucket, name)?;
        match &self.0.backend {
            Backend::R2(r2) => r2.put(&key, bytes, content_type).await,
            Backend::Local { root } => local::put(root, &key, bytes).await,
        }
    }

    /// Removes `name` from `bucket`. A missing object is not an error.
    pub async fn delete(&self, bucket: &str, name: &str) -> Result<(), StorageError> {
        let key = object_key(bucket, name)?;
        match &self.0.backend {
            Backend::R2(r2) => r2.delete(&key).await,
            Backend::Local { root } => local::delete(root, &key).await,
        }
    }

    /// The objects and folders directly under `prefix` in `bucket` (`""`: the
    /// bucket itself). Folders have no `id` and no `created_at`.
    pub async fn list(&self, bucket: &str, prefix: &str) -> Result<Vec<ListEntry>, StorageError> {
        let mut key = safe_key(bucket)?;
        if !prefix.is_empty() {
            key = format!("{key}/{}", safe_key(prefix)?);
        }
        match &self.0.backend {
            Backend::R2(r2) => r2.list(&key).await,
            Backend::Local { root } => local::list(root.join(key)).await,
        }
    }

    async fn read(&self, key: &str) -> Result<Option<StoredObject>, StorageError> {
        match &self.0.backend {
            Backend::R2(r2) => r2.read(key).await,
            Backend::Local { root } => Ok(local::read(root, key).await),
        }
    }
}

/// `URLSearchParams` encoding of a key that passed `safe_key`: of the
/// characters such a key can hold, only `/` is escaped.
fn form_encode_key(key: &str) -> String {
    key.replace('/', "%2F")
}

#[cfg(test)]
fn test_config(extra: &[(&str, &str)]) -> Config {
    Config::from_lookup(|name| {
        [
            ("DATABASE_URL", "postgresql://u:p@127.0.0.1/db"),
            ("BETTER_AUTH_SECRET", "s"),
        ]
        .iter()
        .chain(extra)
        .find(|(key, _)| *key == name)
        .map(|(_, value)| (*value).to_owned())
    })
    .expect("valid config")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn without_r2_values_the_local_directory_is_used() {
        let default = Storage::new(&test_config(&[])).unwrap();
        let chosen = Storage::new(&test_config(&[(
            "LOCAL_OBJECT_STORAGE_DIR",
            "/srv/objects",
        )]))
        .unwrap();

        let root = |storage: &Storage| match &storage.0.backend {
            Backend::Local { root } => root.clone(),
            Backend::R2(_) => panic!("no R2 values are set"),
        };
        assert_eq!(root(&default), PathBuf::from("/tmp/memecatch-objects"));
        assert_eq!(root(&chosen), PathBuf::from("/srv/objects"));
    }
}
