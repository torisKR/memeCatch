import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

/**
 * CSP 위반 리포트 수집 엔드포인트 — enforce 전환의 안전 롤아웃을 위해 실측 데이터를
 * 서버 로그로 남긴다. 브라우저는 두 포맷으로 보낸다:
 *  - Reporting API v1 (report-to):  application/reports+json  → 배열
 *  - 레거시 (report-uri):           application/csp-report    → { "csp-report": {...} }
 * 두 포맷 모두 파싱해 위반 지시자(blocked-uri, violated-directive)만 압축 로깅한다.
 *
 * ⚠️ 서비스 장애와 무관: 여기서 무슨 일이 있어도 사용자 페이지 렌더링에 영향 없음.
 *    수집이 실패해도 항상 204를 반환해 브라우저 재전송 폭주를 막는다.
 */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS = 20;
const MAX_FIELD_CHARS = 300;
const RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const;

type CspFields = {
  "document-uri"?: string;
  "blocked-uri"?: string;
  "violated-directive"?: string;
  "effective-directive"?: string;
  disposition?: string;
};

function safeField(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value) return fallback;
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .slice(0, MAX_FIELD_CHARS);
}

export async function POST(req: Request) {
  try {
    const limit = rateLimit(`csp-report:${getClientIp(req)}`, RATE_LIMIT);
    if (!limit.ok) {
      return new NextResponse(null, {
        status: 204,
        headers: { "retry-after": String(limit.retryAfterSec) },
      });
    }
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }
    const raw = await req.text();
    if (!raw) return new NextResponse(null, { status: 204 });
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }

    const parsed: unknown = JSON.parse(raw);
    // Reporting API v1은 배열, 레거시는 단일 객체 → 배열로 정규화
    const items = (Array.isArray(parsed) ? parsed : [parsed]).slice(0, MAX_REPORTS);

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      // v1: { type, body: {...} } / 레거시: { "csp-report": {...} }
      const candidate = rec.body ?? rec["csp-report"] ?? rec;
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const body = candidate as CspFields;
      const blocked = safeField(body["blocked-uri"], "(unknown)");
      const directive = safeField(
        body["effective-directive"] ?? body["violated-directive"],
        "(unknown)",
      );
      const disposition = safeField(body.disposition, "enforce");
      const document = safeField(body["document-uri"], "-");
      // 콘솔(Vercel 로그)로만 남긴다 — 외부 저장/전송 없음
      console.warn(
        `[CSP-VIOLATION] disposition=${disposition} directive="${directive}" blocked="${blocked}" doc="${document}"`,
      );
    }
  } catch {
    // 파싱 실패는 무시 — 리포트 수집은 best-effort
  }
  // 리포트 API는 응답 바디가 필요 없다. 항상 204로 종료.
  return new NextResponse(null, { status: 204 });
}
