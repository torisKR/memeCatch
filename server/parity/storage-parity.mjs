#!/usr/bin/env node
// Drives the real lib/object-storage.ts so the Rust port (server/src/storage.rs)
// can be compared with it. See README.md in this directory.
//
//   node server/parity/storage-parity.mjs fixture       print the golden fixture
//   node server/parity/storage-parity.mjs seed <dir>    write objects and live signed URLs
//   node server/parity/storage-parity.mjs check <dir>   check what the Rust side wrote
//
// Nothing here reaches the network: in `fixture`, `fetch` is replaced by a
// recorder, and the other modes use a local directory.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { objectStorage, readSignedObject, signedObjectUrl, verifySignedObject } = await import(
  new URL("../../lib/object-storage.ts", import.meta.url).href
);

const STORAGE_ENV = [
  "OBJECT_SIGNING_SECRET",
  "BETTER_AUTH_SECRET",
  "NEXT_PUBLIC_SITE_URL",
  "LOCAL_OBJECT_STORAGE_DIR",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
];

// The module reads process.env on every call.
function setEnv(env) {
  for (const name of STORAGE_ENV) delete process.env[name];
  Object.assign(process.env, env);
}

const realNow = Date.now;
function setClock(now) {
  Date.now = now === undefined ? realNow : () => now;
}

function parts(url) {
  const { searchParams } = new URL(url);
  return { key: searchParams.get("key"), exp: searchParams.get("exp"), sig: searchParams.get("sig") };
}

// The formula under test, restated only to build inputs. Whether an input is
// accepted is always asked of verifySignedObject.
function hmac(env, key, exp) {
  const secret = env.OBJECT_SIGNING_SECRET?.trim() || env.BETTER_AUTH_SECRET.trim();
  return createHmac("sha256", secret).update(`${key}:${exp}`).digest("hex");
}

function invalidKeyOr(error) {
  if (error instanceof Error && error.message === "invalid object key") return null;
  throw error;
}

function changeLastDigit(sig) {
  return sig.replace(/.$/, (digit) => (digit === "0" ? "1" : "0"));
}

// ---------------------------------------------------------------- fixture

const NOW = 1764000000000; // 2025-11-24T16:00:00.000Z
const SIGNING = {
  OBJECT_SIGNING_SECRET: "fixture-object-signing-secret",
  BETTER_AUTH_SECRET: "fixture-better-auth-secret",
};
// Trailing slashes: the module strips them.
const SITE = { NEXT_PUBLIC_SITE_URL: "https://media.example//" };
const R2 = {
  R2_ACCOUNT_ID: "fixture-account",
  R2_ACCESS_KEY_ID: "fixture-access-key",
  R2_SECRET_ACCESS_KEY: "fixture-secret-key",
  R2_BUCKET: "fixture-bucket",
};

const KEY_TABLE = [
  ["plain", "uploads", "a.png"],
  ["nested", "uploads", "2026/11/clip-01_final.v2.mp4"],
  ["leading slash", "uploads", "/leading/slash.png"],
  ["empty segments", "uploads", "a//b///c.png"],
  ["dot segments", "uploads", "./a/../b.png"],
  ["trailing slash", "uploads", "trailing/"],
  ["three dots is a name", "uploads", "..."],
  ["bucket with a slash", "up/loads", "x"],
  ["bucket with dot segments", "../uploads/.", "x"],
  ["only dot-dot", "uploads", ".."],
  ["empty name", "uploads", ""],
  ["empty bucket", "", "a.png"],
  ["Hangul", "uploads", "한글.png"],
  ["Hangul segment", "uploads", "밈/a.png"],
  ["space", "uploads", "with space.png"],
  ["percent escape", "uploads", "a%20b.png"],
  ["plus", "uploads", "a+b.png"],
  ["trailing newline", "uploads", "a.png\n"],
  ["accented letter", "uploads", "é.png"],
  ["fullwidth letter", "uploads", "ａ.png"],
  ["Kelvin sign", "uploads", "K.png"],
  ["backslash", "uploads", "a\\b.png"],
  ["query characters", "uploads", "a.png?x=1&y=2"],
];

const SIGNED_KEYS = [
  "uploads/a.png",
  "/uploads/a.png",
  "uploads//a.png",
  "uploads/./a.png",
  "uploads/a.png/",
  "../../etc/passwd",
  "a",
  "..",
  "/",
  "",
  "uploads/한글.png",
  "uploads/a b.png",
  "uploads/a.png\n",
];

async function fixture() {
  setClock(NOW);

  // Signed URLs for the key table.
  setEnv({ ...SIGNING, ...SITE });
  const urls = KEY_TABLE.map(([note, bucket, name]) => {
    let url;
    try {
      url = signedObjectUrl(bucket, name, 60);
    } catch (error) {
      url = invalidKeyOr(error);
    }
    return { note, bucket, name, url };
  });

  // The site a signed URL starts with when NEXT_PUBLIC_SITE_URL is not a URL.
  const siteUrls = [
    ["NEXT_PUBLIC_SITE_URL unset", SIGNING],
    ["NEXT_PUBLIC_SITE_URL empty", { ...SIGNING, NEXT_PUBLIC_SITE_URL: "" }],
  ].map(([note, env]) => {
    setEnv(env);
    return { note, env, url: signedObjectUrl("uploads", "a.png", 60) };
  });

  // The requests the R2 backend makes, recorded in place of `fetch`.
  setEnv({ ...SIGNING, ...R2 });
  const recorded = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    const { pathname, search, host } = new URL(request.url);
    const [, scope, signedHeaders] =
      /^AWS4-HMAC-SHA256 Credential=[^/]+\/\d{8}\/([^,]+), SignedHeaders=([^,]+), Signature=[0-9a-f]{64}$/.exec(
        request.headers.get("authorization"),
      );
    recorded.push({
      method: request.method,
      host,
      target: pathname + search,
      contentType: request.headers.get("content-type"),
      credentialScope: scope,
      signedHeaders,
      contentSha256: request.headers.get("x-amz-content-sha256"),
    });
    return new Response("<ListBucketResult></ListBucketResult>", { status: 200 });
  };
  const record = async (call) => {
    recorded.length = 0;
    const { error } = await call();
    if (error) assert.equal(error.message, "invalid object key");
    assert.ok(recorded.length <= 1);
    return recorded[0] ?? null;
  };
  for (const row of urls) {
    const bucket = objectStorage().from(row.bucket);
    row.r2Get = (await record(() => bucket.download(row.name)))?.target ?? null;
    // The same text used as a list prefix.
    row.r2List = (await record(() => bucket.list(row.name)))?.target ?? null;
  }
  const bucket = objectStorage().from("uploads");
  const r2 = {
    env: R2,
    get: await record(() => bucket.download("a.png")),
    put: await record(() => bucket.upload("a.png", new Uint8Array([1, 2, 3]), { contentType: "image/png" })),
    putDefaultType: await record(() => bucket.upload("a.bin", new Uint8Array([1, 2, 3]))),
    delete: await record(() => bucket.remove(["a.png"])),
    list: await record(() => bucket.list("2026")),
    listBucket: await record(() => bucket.list()),
  };
  globalThis.fetch = realFetch;

  // Which whole keys readSignedObject lets through to the backend.
  const emptyDir = mkdtempSync(path.join(tmpdir(), "storage-parity-"));
  setEnv({ ...SIGNING, LOCAL_OBJECT_STORAGE_DIR: emptyDir });
  const signedKeys = [];
  for (const key of SIGNED_KEYS) {
    const accepted = await readSignedObject(key).then(
      () => true,
      (error) => invalidKeyOr(error) ?? false,
    );
    signedKeys.push({ key, accepted });
  }
  rmSync(emptyDir, { recursive: true });

  // verifySignedObject at NOW. `expected` is what this script's author
  // believes; the fixture records what the module answered, and the two must
  // agree or the fixture is not written.
  const verify = [];
  const check = (name, env, { key, exp, sig }, expected) => {
    setEnv(env);
    setClock(NOW);
    const accepted = verifySignedObject(key, exp, sig);
    assert.equal(accepted, expected, name);
    verify.push({ name, env, key, exp, sig, accepted });
  };
  const mint = (env, expiresIn, at = NOW) => {
    setEnv(env);
    setClock(at);
    return parts(signedObjectUrl("uploads", "2026/a.png", expiresIn));
  };

  const valid = mint(SIGNING, 600);
  check("minted by the module", SIGNING, valid, true);
  check("last signature digit changed", SIGNING, { ...valid, sig: changeLastDigit(valid.sig) }, false);
  check("first signature digit changed", SIGNING, { ...valid, sig: (valid.sig[0] === "0" ? "1" : "0") + valid.sig.slice(1) }, false);
  check("signature in upper case", SIGNING, { ...valid, sig: valid.sig.toUpperCase() }, false);
  check("signature one digit short", SIGNING, { ...valid, sig: valid.sig.slice(0, -1) }, false);
  check("signature one digit long", SIGNING, { ...valid, sig: `${valid.sig}0` }, false);
  check("signature with a space after it", SIGNING, { ...valid, sig: `${valid.sig} ` }, false);
  check("empty signature", SIGNING, { ...valid, sig: "" }, false);
  check("signature that is not hex", SIGNING, { ...valid, sig: "z".repeat(64) }, false);
  check("signature of 64 non-ASCII letters", SIGNING, { ...valid, sig: "é".repeat(64) }, false);
  check("another key under the same signature", SIGNING, { ...valid, key: "uploads/2026/b.png" }, false);
  check("the key with a leading slash", SIGNING, { ...valid, key: `/${valid.key}` }, false);
  check("a later expiry under the same signature", SIGNING, { ...valid, exp: String(Number(valid.exp) + 1) }, false);
  check("expired two minutes ago", SIGNING, mint(SIGNING, 60, NOW - 180_000), false);
  check("expired one millisecond ago", SIGNING, mint(SIGNING, 0, NOW - 1), false);
  check("expires at this very millisecond", SIGNING, mint(SIGNING, 0), true);

  const otherSecret = { ...SIGNING, OBJECT_SIGNING_SECRET: "another-object-signing-secret" };
  check("minted under a different secret", SIGNING, mint(otherSecret, 600), false);
  const authOnly = { BETTER_AUTH_SECRET: SIGNING.BETTER_AUTH_SECRET };
  check("no object secret: the auth secret signs", authOnly, mint(authOnly, 600), true);
  check("object secret set: the auth secret no longer signs", SIGNING, mint(authOnly, 600), false);
  check("blank object secret falls back to the auth secret", { ...SIGNING, OBJECT_SIGNING_SECRET: "  " }, mint(authOnly, 600), true);
  check("object secret is trimmed", { ...SIGNING, OBJECT_SIGNING_SECRET: ` ${SIGNING.OBJECT_SIGNING_SECRET}\n` }, valid, true);
  check("auth secret is trimmed", { BETTER_AUTH_SECRET: ` ${SIGNING.BETTER_AUTH_SECRET} ` }, mint(authOnly, 600), true);

  // `exp` goes through Number(), and the number printed back is what is signed.
  const { key } = valid;
  const E = Number(valid.exp); // 1764000600000
  // Signed over the number JavaScript reads. Where that is not a number, signed
  // over E, so a reader more lenient than Number() would accept it.
  const spelled = (name, exp, expected) => {
    const read = Number(exp);
    check(`exp ${name}`, SIGNING, { key, exp, sig: hmac(SIGNING, key, Number.isFinite(read) ? read : E) }, expected);
  };
  spelled("with spaces around it", ` ${E} `, true);
  spelled("with a tab and a newline", `\t${E}\n`, true);
  spelled("with no-break spaces", ` ${E} `, true);
  spelled("with a byte order mark", `﻿${E}`, true);
  spelled("with a line separator", `${E} `, true);
  spelled("with U+0085, which is not JavaScript whitespace", `\u0085${E}`, false);
  spelled("with a plus sign", `+${E}`, true);
  spelled("with a decimal point", `${E}.0`, true);
  spelled("ending in a point", `${E}.`, true);
  spelled("in exponent form", "1.7640006e12", true);
  spelled("in exponent form, upper case", "17640006E5", true);
  spelled("in hex", `0x${E.toString(16)}`, true);
  spelled("in hex, upper case", `0X${E.toString(16).toUpperCase()}`, true);
  spelled("in octal", `0o${E.toString(8)}`, true);
  spelled("in binary", `0b${E.toString(2)}`, true);
  spelled("in hex with a sign", `+0x${E.toString(16)}`, false);
  spelled("in hex with a sign after the prefix", `0x+${E.toString(16)}`, false);
  spelled("hex prefix only", "0x", false);
  spelled("with a digit separator", "1_764_000_600_000", false);
  spelled("followed by letters", `${E}abc`, false);
  spelled("negative", `-${E}`, false);
  spelled("empty", "", false);
  spelled("blank", "   ", false);
  spelled("a word", "soon", false);
  spelled("Infinity", "Infinity", false);
  spelled("infinity as Rust spells it", "inf", false);
  spelled("NaN", "NaN", false);
  spelled("overflowing to Infinity", "1e400", false);
  spelled("with half a millisecond", `${E}.5`, true);
  spelled("beyond 2^53", "12345678901234567890", true);
  spelled("printed in exponent form", "1e21", true);
  spelled("printed in exponent form with a fraction", "1500000000000000000000", true);
  spelled("hex beyond 2^64", "0x10000000000000000000", true);
  // Signed over the text as sent, which is not what the module signs.
  check("exp signed as text, not as a number", SIGNING, { key, exp: `${E}.0`, sig: hmac(SIGNING, key, `${E}.0`) }, false);

  setClock();
  const body = JSON.stringify({ now: NOW, env: { ...SIGNING, ...SITE }, urls, siteUrls, r2, signedKeys, verify }, null, 2);
  // Escaped so invisible characters in the cases stay visible in the file.
  const ascii = body.replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  process.stdout.write(`${ascii}\n`);
}

// ------------------------------------------------------------------- live

const LIVE = {
  OBJECT_SIGNING_SECRET: "live-parity-object-secret",
  BETTER_AUTH_SECRET: "live-parity-auth-secret",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3001",
};
const BUCKET = "parity";
const LIVE_SECONDS = 3600;
const TS_OBJECTS = [
  ["ts/a.txt", Buffer.from("written by TypeScript\n")],
  ["ts/nested/b.bin", Buffer.from(Array.from({ length: 256 }, (_, byte) => byte))],
  ["ts/nested/deeper/c.txt", Buffer.from("three levels down")],
  ["ts/delete-me.txt", Buffer.from("the Rust side deletes this")],
];
const TS_PREFIXES = ["", "ts", "ts/nested", "ts/nested/deeper", "ts/missing"];

function liveEnv(dir) {
  return { ...LIVE, LOCAL_OBJECT_STORAGE_DIR: path.join(dir, "objects") };
}

async function list(prefix) {
  const { data, error } = await objectStorage().from(BUCKET).list(prefix);
  assert.equal(error, null);
  return data;
}

async function seed(dir) {
  const env = liveEnv(dir);
  setEnv(env);
  const bucket = objectStorage().from(BUCKET);
  const objects = [];
  for (const [name, bytes] of TS_OBJECTS) {
    const { error } = await bucket.upload(name, bytes, { contentType: "text/plain" });
    assert.equal(error, null);
    objects.push({ name, hex: bytes.toString("hex"), url: signedObjectUrl(BUCKET, name, LIVE_SECONDS) });
  }
  const lists = {};
  for (const prefix of TS_PREFIXES) lists[prefix] = await list(prefix);

  writeFileSync(path.join(dir, "ts.json"), JSON.stringify({ env, bucket: BUCKET, objects, lists }, null, 2));
  console.log(`seeded ${objects.length} objects under ${env.LOCAL_OBJECT_STORAGE_DIR}`);
}

async function check(dir) {
  const env = liveEnv(dir);
  setEnv(env);
  const rust = JSON.parse(readFileSync(path.join(dir, "rust.json"), "utf8"));
  const bucket = objectStorage().from(BUCKET);
  let failed = 0;
  const expect = (label, actual, expected) => {
    try {
      assert.deepEqual(actual, expected);
      console.log(`ok    ${label}`);
    } catch {
      failed += 1;
      console.log(`DIFF  ${label}\n  typescript: ${JSON.stringify(actual)}\n  expected:   ${JSON.stringify(expected)}`);
    }
  };
  const accepts = (url) => {
    const { key, exp, sig } = parts(url);
    return verifySignedObject(key, exp, sig);
  };

  for (const { name, hex, url } of rust.objects) {
    const { key, exp, sig } = parts(url);
    expect(`verifySignedObject accepts the URL Rust minted for ${name}`, accepts(url), true);
    expect(`  its key is ${BUCKET}/${name}`, key, `${BUCKET}/${name}`);
    expect("  last signature digit changed: rejected", verifySignedObject(key, exp, changeLastDigit(sig)), false);
    expect("  later expiry under the same signature: rejected", verifySignedObject(key, String(Number(exp) + 1), sig), false);
    const stored = await readSignedObject(key);
    expect("  readSignedObject returns the bytes Rust wrote", stored && Buffer.from(stored.bytes).toString("hex"), hex);
    const { data } = await bucket.download(name);
    expect("  download returns the bytes Rust wrote", data && Buffer.from(await data.arrayBuffer()).toString("hex"), hex);
  }
  expect("verifySignedObject rejects the URL Rust minted already expired", accepts(rust.expiredUrl), false);
  expect("verifySignedObject rejects the URL Rust minted under a different secret", accepts(rust.otherSecretUrl), false);
  setEnv({ ...env, OBJECT_SIGNING_SECRET: rust.otherSecret });
  expect("  and accepts it under that secret", accepts(rust.otherSecretUrl), true);
  setEnv(env);

  for (const [prefix, entries] of Object.entries(rust.lists)) {
    expect(`list(${JSON.stringify(prefix)}) equals what Rust listed`, await list(prefix), entries);
  }
  const { data, error } = await bucket.download(rust.deleted);
  expect(`${rust.deleted}, deleted by Rust, is gone`, [data, error?.status], [null, 404]);

  console.log(failed ? `\n${failed} checks failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}

const [mode, dir] = process.argv.slice(2);
if (mode === "fixture") await fixture();
else if (mode === "seed" && dir) await seed(dir);
else if (mode === "check" && dir) await check(dir);
else {
  console.error("usage: storage-parity.mjs fixture | seed <dir> | check <dir>");
  process.exit(2);
}
