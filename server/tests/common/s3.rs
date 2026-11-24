//! Versity S3 Gateway in Docker with keys made up for each run, bound to
//! localhost and removed on drop. It checks the SigV4 signature of every
//! request, so a wrong signature fails a test. Nothing here contacts
//! Cloudflare.

use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use memecatch_server::config::Config;
use memecatch_server::storage::Storage;

pub const IMAGE: &str = "versity/versitygw:v1.11.0";
/// `R2_BUCKET`. What the storage API calls a bucket is a key prefix inside it.
pub const S3_BUCKET: &str = "memecatch-test";
pub const GATEWAY_PORT: &str = "7070";

pub struct S3Server {
    pub container: String,
    pub endpoint: String,
    pub access_key: String,
    pub secret_key: String,
}

impl Drop for S3Server {
    fn drop(&mut self) {
        let _ = Command::new("docker")
            .args(["rm", "-f", "-v", &self.container])
            .output();
    }
}

pub fn docker(args: &[&str]) -> String {
    let output = Command::new("docker")
        .args(args)
        .output()
        .expect("the S3 tests need Docker");
    assert!(
        output.status.success(),
        "docker {args:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout)
        .expect("utf-8")
        .trim()
        .to_owned()
}

pub fn throwaway(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{prefix}{:x}{nanos:x}", std::process::id())
}

impl S3Server {
    pub async fn start() -> Self {
        let access_key = throwaway("access");
        let secret_key = throwaway("secret");
        // The posix backend serves each directory under /data as a bucket.
        let run = format!(
            "mkdir -p /data/{S3_BUCKET} && exec versitygw --port :{GATEWAY_PORT} posix /data"
        );
        let container = docker(&[
            "run",
            "-d",
            "-p",
            &format!("127.0.0.1::{GATEWAY_PORT}"),
            "-e",
            &format!("ROOT_ACCESS_KEY={access_key}"),
            "-e",
            &format!("ROOT_SECRET_KEY={secret_key}"),
            // The region R2 uses. The gateway refuses any other in a signature.
            "-e",
            "VGW_REGION=auto",
            "--entrypoint",
            "sh",
            IMAGE,
            "-c",
            &run,
        ]);
        let mut server = Self {
            container,
            endpoint: String::new(),
            access_key,
            secret_key,
        };
        let published = docker(&["port", &server.container, &format!("{GATEWAY_PORT}/tcp")]);
        server.endpoint = format!("http://{}", published.lines().next().expect("port"));

        let storage = server.storage();
        for _ in 0..150 {
            if storage.list("ready", "").await.is_ok() {
                return server;
            }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
        panic!(
            "the S3 server did not become ready: {}",
            docker(&["logs", "--tail", "40", &server.container])
        );
    }

    pub fn config(&self, secret_key: &str) -> Config {
        self.app_config(super::UNUSED_DATABASE_URL, secret_key, &[])
    }

    /// A configuration with R2 set, for an app with this database.
    pub fn app_config(
        &self,
        database_url: &str,
        secret_key: &str,
        extra: &[(&str, &str)],
    ) -> Config {
        let r2 = [
            ("R2_ACCOUNT_ID", "account-is-not-used-with-a-test-endpoint"),
            ("R2_ACCESS_KEY_ID", &self.access_key),
            ("R2_SECRET_ACCESS_KEY", secret_key),
            ("R2_BUCKET", S3_BUCKET),
        ];
        super::config(database_url, &[&r2[..], extra].concat())
    }

    pub fn storage(&self) -> Storage {
        Storage::with_r2_endpoint(&self.config(&self.secret_key), &self.endpoint).expect("storage")
    }
}
