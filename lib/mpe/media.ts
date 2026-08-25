import { createHash } from "node:crypto";

export const IMAGE_UPLOAD_LIMIT = 20 * 1024 * 1024;
export const VIDEO_UPLOAD_LIMIT = 20 * 1024 * 1024;

export type SupportedMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "video/mp4"
  | "video/webm";

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

export function detectMediaType(bytes: Uint8Array): SupportedMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) {
    return "image/gif";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "dash", "qt  "].includes(brand)) {
      return "video/mp4";
    }
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3 &&
    ascii(bytes, 4, Math.min(bytes.length - 4, 4_096)).includes("webm")
  ) {
    return "video/webm";
  }
  return null;
}

export type ValidatedMedia = {
  mimeType: SupportedMediaType;
  sha256: string;
  size: number;
};

export const MEDIA_DURATION_LIMIT_MS = 15 * 60 * 1_000;
export const MEDIA_DIMENSION_LIMIT = 8_192;

export type ProbedMedia = {
  formatName: string;
  videoCodec: string | null;
  width: number | null;
  height: number | null;
  durationMs: number;
};

type MediaValidationErrorCode =
  | "empty_file"
  | "unsupported_media"
  | "mime_mismatch"
  | "file_too_large"
  | "container_mismatch"
  | "unsupported_codec"
  | "invalid_dimensions"
  | "invalid_duration"
  | "duration_too_long";

export class MediaValidationError extends Error {
  readonly code: MediaValidationErrorCode;

  constructor(code: MediaValidationErrorCode) {
    super(code);
    this.name = "MediaValidationError";
    this.code = code;
  }
}

const PROBE_RULES: Record<SupportedMediaType, { formats: string[]; codecs: string[] }> = {
  "image/jpeg": { formats: ["image2", "jpeg_pipe"], codecs: ["mjpeg"] },
  "image/png": { formats: ["image2", "png_pipe"], codecs: ["png"] },
  "image/webp": { formats: ["image2", "webp_pipe"], codecs: ["webp"] },
  "image/gif": { formats: ["gif"], codecs: ["gif"] },
  "video/mp4": { formats: ["mov", "mp4", "m4a", "3gp", "3g2", "mj2"], codecs: ["h264", "hevc", "av1", "vp9"] },
  "video/webm": { formats: ["matroska", "webm"], codecs: ["vp8", "vp9", "av1"] },
};

export function validateProbedMedia(mimeType: SupportedMediaType, media: ProbedMedia): void {
  const rules = PROBE_RULES[mimeType];
  const formats = media.formatName.split(",");
  if (!formats.some((format) => rules.formats.includes(format))) {
    throw new MediaValidationError("container_mismatch");
  }
  if (!media.videoCodec || !rules.codecs.includes(media.videoCodec)) {
    throw new MediaValidationError("unsupported_codec");
  }
  if (
    !media.width || !media.height ||
    media.width > MEDIA_DIMENSION_LIMIT || media.height > MEDIA_DIMENSION_LIMIT
  ) {
    throw new MediaValidationError("invalid_dimensions");
  }
  if (!Number.isFinite(media.durationMs) || media.durationMs < 0) {
    throw new MediaValidationError("invalid_duration");
  }
  if (media.durationMs > MEDIA_DURATION_LIMIT_MS) {
    throw new MediaValidationError("duration_too_long");
  }
}

export function validateMedia(bytes: Uint8Array, declaredType: string): ValidatedMedia {
  if (bytes.length === 0) throw new MediaValidationError("empty_file");
  const mimeType = detectMediaType(bytes);
  if (!mimeType) throw new MediaValidationError("unsupported_media");
  if (declaredType && declaredType !== "application/octet-stream" && declaredType !== mimeType) {
    throw new MediaValidationError("mime_mismatch");
  }
  const limit = mimeType.startsWith("image/") ? IMAGE_UPLOAD_LIMIT : VIDEO_UPLOAD_LIMIT;
  if (bytes.length > limit) throw new MediaValidationError("file_too_large");
  return {
    mimeType,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
  };
}
