import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { detectMediaType, MediaValidationError, validateMedia, validateProbedMedia } from "./media";

const samples: Array<[string, number[]]> = [
  ["image/jpeg", [0xff, 0xd8, 0xff, 0xdb]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["image/webp", [...Buffer.from("RIFF0000WEBP")]],
  ["image/gif", [...Buffer.from("GIF89a")]],
  ["video/mp4", [0, 0, 0, 24, ...Buffer.from("ftypisom")]],
  ["video/webm", [0x1a, 0x45, 0xdf, 0xa3, ...Buffer.from("webm")]],
];

const exec = promisify(execFile);

describe("MPE media validation", () => {
  it("loads worker-imported TypeScript modules in plain Node strip-only mode", async () => {
    const { stderr } = await exec("node", [
      "--input-type=module",
      "-e",
      "await Promise.all([import('./lib/mpe/media.ts'), import('./lib/mpe/openrouter.server.ts')])",
    ], { cwd: process.cwd() });
    expect(stderr).not.toContain("ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX");
  });

  it.each(samples)("detects %s from magic bytes", (mimeType, bytes) => {
    expect(detectMediaType(Uint8Array.from(bytes))).toBe(mimeType);
  });

  it("hashes the accepted bytes and rejects a forged content type", () => {
    const bytes = Uint8Array.from(samples[1][1]);
    expect(validateMedia(bytes, "image/png")).toEqual({
      mimeType: "image/png",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
    });
    expect(() => validateMedia(bytes, "image/jpeg")).toThrowError(
      new MediaValidationError("mime_mismatch"),
    );
  });

  it("rejects empty and unknown files", () => {
    expect(() => validateMedia(new Uint8Array(), "")).toThrow("empty_file");
    expect(() => validateMedia(Uint8Array.from([1, 2, 3, 4]), "application/octet-stream")).toThrow(
      "unsupported_media",
    );
  });

  it("does not treat another ISO-BMFF image or generic EBML file as supported video", () => {
    expect(detectMediaType(Uint8Array.from([0, 0, 0, 24, ...Buffer.from("ftypheic")]))).toBeNull();
    expect(detectMediaType(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, ...Buffer.from("matroska")]))).toBeNull();
  });

  it("accepts matching ffprobe container, codec, dimensions, and duration", () => {
    expect(() => validateProbedMedia("video/mp4", {
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      videoCodec: "h264",
      width: 1920,
      height: 1080,
      durationMs: 60_000,
    })).not.toThrow();
  });

  it.each([
    ["container_mismatch", { formatName: "matroska,webm", videoCodec: "h264", width: 100, height: 100, durationMs: 1 }],
    ["unsupported_codec", { formatName: "mov,mp4", videoCodec: "mpeg2video", width: 100, height: 100, durationMs: 1 }],
    ["invalid_dimensions", { formatName: "mov,mp4", videoCodec: "h264", width: 0, height: 100, durationMs: 1 }],
    ["duration_too_long", { formatName: "mov,mp4", videoCodec: "h264", width: 100, height: 100, durationMs: 900_001 }],
  ])("rejects invalid deep media metadata with %s", (code, media) => {
    expect(() => validateProbedMedia("video/mp4", media)).toThrow(code);
  });
});
