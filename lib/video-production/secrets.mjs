import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class SecretEnvelopeError extends Error {
  constructor(code) { super(code); this.name = "SecretEnvelopeError"; this.code = code; }
}

function fail(code) { throw new SecretEnvelopeError(code); }

export function decodeEncryptionKey(encodedKey) {
  if (typeof encodedKey !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey)) fail("invalid_encryption_key");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) fail("invalid_encryption_key");
  return key;
}

function aad(context) {
  if (typeof context !== "string" || !context || context.length > 256 || /[\r\n\0]/.test(context)) fail("invalid_secret_context");
  return Buffer.from(context, "utf8");
}

export function encryptSecret(secret, context, encodedKey, random = randomBytes) {
  if (typeof secret !== "string" || !secret || /[\r\n\0]/.test(secret)) fail("invalid_secret");
  const iv = random(12);
  if (!Buffer.isBuffer(iv) || iv.length !== 12) fail("invalid_initialization_vector");
  const cipher = createCipheriv("aes-256-gcm", decodeEncryptionKey(encodedKey), iv);
  cipher.setAAD(aad(context));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export function decryptSecret(value, context, encodedKey) {
  const match = /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{22})$/.exec(value ?? "");
  if (!match) fail("invalid_encrypted_secret");
  try {
    const decipher = createDecipheriv("aes-256-gcm", decodeEncryptionKey(encodedKey), Buffer.from(match[1], "base64url"));
    decipher.setAAD(aad(context));
    decipher.setAuthTag(Buffer.from(match[3], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(match[2], "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof SecretEnvelopeError) throw error;
    fail("invalid_encrypted_secret");
  }
}
