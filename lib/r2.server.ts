import "server-only";

import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 서버 전용 클라이언트 (S3 호환 API, sigv4).
 * 자격증명은 서버 환경변수로만 읽는다 — NEXT_PUBLIC_ 금지, 클라이언트 번들에 절대 노출되지 않음.
 *
 * 필요 환경변수 (없으면 Supabase Storage 폴백):
 *   R2_ACCOUNT_ID        — Cloudflare 계정 ID
 *   R2_ACCESS_KEY_ID     — R2 API 토큰의 Access Key ID
 *   R2_SECRET_ACCESS_KEY — R2 API 토큰의 Secret Access Key
 *   R2_BUCKET            — 버킷 이름 (memecatch-uploads)
 */

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

function r2Endpoint(key: string): string {
  const account = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET!;
  // 경로 세그먼트별 인코딩 (키에 한글·공백이 와도 서명 일치)
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `https://${account}.r2.cloudflarestorage.com/${bucket}/${encoded}`;
}

function r2Client(): AwsClient {
  return new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
}

/** R2에 객체 저장. 성공 시 true. */
export async function r2Put(
  key: string,
  body: ArrayBuffer,
  contentType: string
): Promise<boolean> {
  const res = await r2Client().fetch(r2Endpoint(key), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  return res.ok;
}

/** R2에서 객체 조회. 원본 Response를 그대로 반환(스트리밍). */
export async function r2Get(key: string): Promise<Response> {
  return r2Client().fetch(r2Endpoint(key), { method: "GET" });
}
