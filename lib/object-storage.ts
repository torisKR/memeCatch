import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

type StoredObject = { name: string; id: string | null; created_at: string | null };

function rootDir(): string {
  return process.env.LOCAL_OBJECT_STORAGE_DIR?.trim() || "/tmp/memecatch-objects";
}

function r2Ready(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function signingSecret(): string {
  const secret = process.env.OBJECT_SIGNING_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new Error("OBJECT_SIGNING_SECRET is required");
  return secret;
}

function safeKey(value: string): string {
  const parts = value.split("/").filter((part) => part && part !== "." && part !== "..");
  if (parts.length === 0 || parts.some((part) => !/^[\w.-]+$/.test(part))) throw new Error("invalid object key");
  return parts.join("/");
}

function objectKey(bucket: string, name: string): string {
  return `${safeKey(bucket)}/${safeKey(name)}`;
}

function r2Url(key: string): string {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${encoded}`;
}

function r2Client(): AwsClient {
  return new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
}

async function bodyBytes(body: unknown): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof Blob !== "undefined" && body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  throw new Error("unsupported object body");
}

export function signedObjectUrl(bucket: string, objectPath: string, expiresIn: number): string {
  const exp = Date.now() + expiresIn * 1000;
  const key = objectKey(bucket, objectPath);
  const sig = createHmac("sha256", signingSecret()).update(`${key}:${exp}`).digest("hex");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const params = new URLSearchParams({ key, exp: String(exp), sig });
  return `${site}/api/media/signed?${params.toString()}`;
}

export function verifySignedObject(key: string, exp: string, sig: string): boolean {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = createHmac("sha256", signingSecret()).update(`${key}:${expires}`).digest("hex");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readObject(key: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (r2Ready()) {
    const response = await r2Client().fetch(r2Url(key));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("object read failed");
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      type: response.headers.get("content-type") ?? "application/octet-stream",
    };
  }
  const file = path.join(rootDir(), key);
  try {
    const bytes = await readFile(file);
    return { bytes, type: "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function readSignedObject(key: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  safeKey(key);
  return readObject(key);
}

function bucketApi(bucket: string) {
  return {
    async upload(name: string, body: unknown, options?: { contentType?: string; upsert?: boolean }) {
      try {
        const key = objectKey(bucket, name);
        const bytes = await bodyBytes(body);
        if (r2Ready()) {
          const response = await r2Client().fetch(r2Url(key), {
            method: "PUT",
            headers: { "content-type": options?.contentType ?? "application/octet-stream" },
            body: Buffer.from(bytes),
          });
          if (!response.ok) return { data: null, error: { message: "upload failed", status: response.status } };
        } else {
          const file = path.join(rootDir(), key);
          await mkdir(path.dirname(file), { recursive: true });
          await writeFile(file, bytes);
        }
        return { data: { path: name }, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : "upload failed" } };
      }
    },
    async download(name: string) {
      try {
        const stored = await readObject(objectKey(bucket, name));
        if (!stored) return { data: null, error: { message: "not found", status: 404 } };
        const blob = new Blob([Buffer.from(stored.bytes)], { type: stored.type });
        return { data: blob, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : "download failed" } };
      }
    },
    async remove(names: string[]) {
      try {
        for (const name of names) {
          const key = objectKey(bucket, name);
          if (r2Ready()) {
            await r2Client().fetch(r2Url(key), { method: "DELETE" });
          } else {
            await rm(path.join(rootDir(), key), { force: true });
          }
        }
        return { data: names.map((name) => ({ name })), error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : "remove failed" } };
      }
    },
    async list(prefix = "") {
      try {
        const entries = r2Ready() ? await listR2(bucket, prefix) : await listLocal(bucket, prefix);
        return { data: entries, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : "list failed" } };
      }
    },
    async createSignedUrl(name: string, expiresIn = 60) {
      try {
        return { data: { signedUrl: signedObjectUrl(bucket, name, expiresIn) }, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : "sign failed" } };
      }
    },
  };
}

async function listLocal(bucket: string, prefix: string): Promise<StoredObject[]> {
  const base = path.join(rootDir(), safeKey(bucket), prefix ? safeKey(prefix) : "");
  let names: string[] = [];
  try {
    names = await readdir(base);
  } catch {
    return [];
  }
  const entries: StoredObject[] = [];
  for (const name of names.sort()) {
    const info = await stat(path.join(base, name));
    entries.push({
      name,
      id: info.isFile() ? name : null,
      created_at: info.isFile() ? info.mtime.toISOString() : null,
    });
  }
  return entries;
}

async function listR2(bucket: string, prefix: string): Promise<StoredObject[]> {
  const keyPrefix = prefix ? `${safeKey(bucket)}/${safeKey(prefix)}/` : `${safeKey(bucket)}/`;
  const url = new URL(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}`);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", keyPrefix);
  url.searchParams.set("delimiter", "/");
  const response = await r2Client().fetch(url);
  if (!response.ok) throw new Error("list failed");
  const xml = await response.text();
  const entries: StoredObject[] = [];
  for (const match of xml.matchAll(/<CommonPrefixes><Prefix>[^<]*\/([^/<]+)\//g)) {
    entries.push({ name: match[1] ?? "", id: null, created_at: null });
  }
  for (const match of xml.matchAll(/<Key>[^<]*\/([^/<]+)<\/Key>[\s\S]*?<LastModified>([^<]+)<\/LastModified>/g)) {
    entries.push({ name: match[1] ?? "", id: match[1] ?? null, created_at: match[2] ?? null });
  }
  return entries;
}

export function objectStorage() {
  return {
    from(bucket: string) {
      return bucketApi(bucket);
    },
  };
}
