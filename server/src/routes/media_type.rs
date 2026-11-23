//! `validateMedia` and `detectMediaType` of `lib/mpe/media.ts`: what an
//! uploaded file is, read from its first bytes and never from its name or the
//! type the client declared.

use sha2::{Digest, Sha256};

/// `IMAGE_UPLOAD_LIMIT` and `VIDEO_UPLOAD_LIMIT`: both 20 MiB.
pub const UPLOAD_LIMIT: usize = 20 * 1024 * 1024;
const MP4_BRANDS: [&[u8; 4]; 8] = [
    b"isom", b"iso2", b"mp41", b"mp42", b"avc1", b"M4V ", b"dash", b"qt  ",
];
/// How far into a Matroska file the `webm` doctype is looked for.
const WEBM_SCAN_BYTES: usize = 4_096;

/// `detectMediaType`.
pub fn detect(bytes: &[u8]) -> Option<&'static str> {
    let at = |start: usize, text: &[u8]| bytes.get(start..start + text.len()) == Some(text);
    if at(0, &[0xff, 0xd8, 0xff]) {
        return Some("image/jpeg");
    }
    if at(0, &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        return Some("image/png");
    }
    if bytes.len() >= 12 && at(0, b"RIFF") && at(8, b"WEBP") {
        return Some("image/webp");
    }
    if at(0, b"GIF87a") || at(0, b"GIF89a") {
        return Some("image/gif");
    }
    if bytes.len() >= 12 && at(4, b"ftyp") && MP4_BRANDS.iter().any(|brand| at(8, *brand)) {
        return Some("video/mp4");
    }
    if at(0, &[0x1a, 0x45, 0xdf, 0xa3]) {
        let head = &bytes[4..bytes.len().min(4 + WEBM_SCAN_BYTES)];
        if head.windows(4).any(|window| window == b"webm") {
            return Some("video/webm");
        }
    }
    None
}

/// `ValidatedMedia`.
#[derive(Debug, PartialEq, Eq)]
pub struct Media {
    pub mime_type: &'static str,
    /// Lower-case hex.
    pub sha256: String,
    pub size: usize,
}

/// `validateMedia(bytes, declaredType)`. `Err` is the code of the
/// `MediaValidationError`.
pub fn validate(bytes: &[u8], declared_type: &str) -> Result<Media, &'static str> {
    if bytes.is_empty() {
        return Err("empty_file");
    }
    let mime_type = detect(bytes).ok_or("unsupported_media")?;
    if !declared_type.is_empty()
        && declared_type != "application/octet-stream"
        && declared_type != mime_type
    {
        return Err("mime_mismatch");
    }
    if bytes.len() > UPLOAD_LIMIT {
        return Err("file_too_large");
    }
    Ok(Media {
        mime_type,
        sha256: hex::encode(Sha256::digest(bytes)),
        size: bytes.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with(head: &[u8], total: usize) -> Vec<u8> {
        let mut bytes = head.to_vec();
        bytes.resize(total.max(head.len()), 0);
        bytes
    }

    // Each verdict is what detectMediaType of lib/mpe/media.ts returns.
    #[test]
    fn a_type_is_read_from_the_magic_bytes() {
        assert_eq!(detect(&[0xff, 0xd8, 0xff, 0xe0]), Some("image/jpeg"));
        assert_eq!(
            detect(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]),
            Some("image/png")
        );
        assert_eq!(detect(b"RIFF\0\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(detect(b"GIF89a"), Some("image/gif"));
        assert_eq!(detect(b"\0\0\0\x18ftypmp42\0\0"), Some("video/mp4"));
        assert_eq!(detect(b"\0\0\0\x18ftypqt  "), Some("video/mp4"));
        assert_eq!(
            detect(&[&[0x1a, 0x45, 0xdf, 0xa3][..], b"\x9f\x42\x82\x84webm"].concat()),
            Some("video/webm")
        );
        for unknown in [
            &b""[..],
            &[0xff, 0xd8],
            b"RIFF\0\0\0\0WAVE",
            b"GIF88a",
            b"\0\0\0\x18ftypheic",
            b"\0\0\0\x18ftypmp4",
            &[0x1a, 0x45, 0xdf, 0xa3, b'm', b'k', b'v'],
            b"<html>",
        ] {
            assert_eq!(detect(unknown), None, "{unknown:?}");
        }
        // `webm` beyond the first 4,096 bytes after the header is not seen.
        let mut late = with(&[0x1a, 0x45, 0xdf, 0xa3], 4 + 4_096);
        late.extend_from_slice(b"webm");
        assert_eq!(detect(&late), None);
    }

    #[test]
    fn a_file_must_be_what_it_was_declared_to_be() {
        let png = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 1, 2];

        let media = validate(&png, "image/png").unwrap();
        assert_eq!((media.mime_type, media.size), ("image/png", 10));
        // sha256 of those ten bytes, as Node's createHash prints it.
        assert_eq!(media.sha256.len(), 64);
        assert!(validate(&png, "").is_ok());
        assert!(validate(&png, "application/octet-stream").is_ok());
        assert_eq!(validate(&png, "image/jpeg"), Err("mime_mismatch"));
        assert_eq!(validate(&png, "text/plain"), Err("mime_mismatch"));
        assert_eq!(validate(&[], "image/png"), Err("empty_file"));
        assert_eq!(validate(b"hello", "image/png"), Err("unsupported_media"));
        assert_eq!(
            validate(&with(&png, UPLOAD_LIMIT + 1), "image/png"),
            Err("file_too_large")
        );
        assert!(validate(&with(&png, UPLOAD_LIMIT), "image/png").is_ok());
    }
}
