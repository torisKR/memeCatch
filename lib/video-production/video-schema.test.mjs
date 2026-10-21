import assert from "node:assert/strict";
import test from "node:test";
import { parseProducedVideoMetadata, producedVideoEmbedUrl } from "./video-schema.mjs";

const id = "abcdefghijk";
const now = Date.parse("2026-10-13T00:00:00Z");
const metadata = { name: "직접 만든 사용 예시", description: "상황과 주의점을 설명합니다.",
  thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, uploadDate: "2026-10-12T03:00:00Z" };

test("preserves actual video metadata and only projects the known public fields", () => {
  assert.deepEqual(parseProducedVideoMetadata({ ...metadata, secret: "discard" }, id, now), metadata);
  assert.equal(producedVideoEmbedUrl(id), `https://www.youtube-nocookie.com/embed/${id}`);
  assert.equal(producedVideoEmbedUrl("invalid"), null);
});

test("requires all Google-required values without inventing a thumbnail or date", () => {
  for (const key of ["name", "thumbnailUrl", "uploadDate"]) {
    for (const value of [null, undefined, ""]) {
      assert.equal(parseProducedVideoMetadata({ ...metadata, [key]: value }, id, now), null);
    }
  }
});

test("requires a real nonfuture calendar datetime and explicit timezone", () => {
  for (const uploadDate of ["2026-02-30T00:00:00Z", "2026-10-12", "2026-10-12T03:00:00",
    "2026-10-12T25:00:00Z", "2026-10-14T00:00:00Z", "2026-10-12T03:00:00+14:59"]) {
    assert.equal(parseProducedVideoMetadata({ ...metadata, uploadDate }, id, now), null);
  }
  assert.equal(parseProducedVideoMetadata({ ...metadata, uploadDate: "2026-10-12T12:00:00+09:00" }, id, now)?.uploadDate,
    "2026-10-12T12:00:00+09:00");
});

test("rejects nonvideo, private, credentialed, signed or different-video thumbnail URLs", () => {
  for (const thumbnailUrl of ["https://catchmeme.com/memes/example", "https://www.youtube.com/watch?v=abcdefghijk",
    "http://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", "https://secret@i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
    "https://i.ytimg.com/vi/otherabcdef/hqdefault.jpg", `${metadata.thumbnailUrl}?token=private`,
    `${metadata.thumbnailUrl}#fragment`, "https://localhost/private.png"]) {
    assert.equal(parseProducedVideoMetadata({ ...metadata, thumbnailUrl }, id, now), null);
  }
});

test("bounds text, handles Unicode titles, and permits a missing optional description", () => {
  assert.equal(parseProducedVideoMetadata({ ...metadata, name: "😀".repeat(100) }, id, now)?.name, "😀".repeat(100));
  assert.equal(parseProducedVideoMetadata({ ...metadata, name: "😀".repeat(101) }, id, now), null);
  assert.equal(parseProducedVideoMetadata({ ...metadata, name: "bad\u0000title" }, id, now), null);
  assert.equal(parseProducedVideoMetadata({ ...metadata, description: undefined }, id, now)?.description, null);
  assert.equal(parseProducedVideoMetadata(metadata, "wrong", now), null);
});
