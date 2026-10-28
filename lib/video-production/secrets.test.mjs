import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret } from "./secrets.mjs";

const key = Buffer.alloc(32, 8).toString("base64");

test("AES-GCM secret envelopes bind ciphertext to contextual AAD", () => {
  const encrypted = encryptSecret("refresh-token", "youtube-channel:UCtest", key, () => Buffer.alloc(12, 1));
  assert.equal(decryptSecret(encrypted, "youtube-channel:UCtest", key), "refresh-token");
  assert.throws(() => decryptSecret(encrypted, "youtube-channel:UCother", key), { code: "invalid_encrypted_secret" });
  assert.ok(!encrypted.includes("refresh-token"));
});

test("secret envelopes require an exact 32-byte base64 key", () => {
  assert.throws(() => encryptSecret("secret", "context", "not-base64"), { code: "invalid_encryption_key" });
  assert.throws(() => encryptSecret("secret", "context", Buffer.alloc(31).toString("base64")), { code: "invalid_encryption_key" });
});
