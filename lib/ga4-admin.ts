import "server-only";

import { createPrivateKey, sign } from "node:crypto";
import { z } from "zod";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const METRICS = ["activeUsers", "sessions", "screenPageViews", "eventCount"] as const;
const REQUIRED_ENV = [
  "GA4_PROPERTY_ID",
  "GA4_SERVICE_ACCOUNT_EMAIL",
  "GA4_SERVICE_ACCOUNT_PRIVATE_KEY",
] as const;

export type GA4Metrics = Record<(typeof METRICS)[number], number>;
export type GA4Report =
  | { status: "missing_config"; missing: string[] }
  | { status: "invalid_config" }
  | { status: "error"; reason: "authentication" | "permission" | "quota" | "unavailable" | "invalid_response" }
  | { status: "empty" }
  | {
      status: "ready";
      totals: GA4Metrics;
      daily: (GA4Metrics & { date: string })[];
      timeZone: string | null;
      thresholded: boolean;
      fetchedAt: string;
    };

const count = z.string().regex(/^\d+$/).transform(Number).refine(Number.isSafeInteger);
const reportSchema = z.object({
  metricHeaders: z.array(z.object({ name: z.string() })),
  dimensionHeaders: z.array(z.object({ name: z.string() })).optional(),
  rows: z.array(z.object({
    dimensionValues: z.array(z.object({ value: z.string() })).optional(),
    metricValues: z.array(z.object({ value: count })),
  })).optional(),
  rowCount: z.number().int().nonnegative().optional(),
  metadata: z.object({
    timeZone: z.string().optional(),
    subjectToThresholding: z.boolean().optional(),
  }).optional(),
});

class ReportFailure extends Error {
  constructor(readonly reason: Extract<GA4Report, { status: "error" }>["reason"]) {
    super(reason);
  }
}

async function googleJson(url: string, init: RequestInit, tokenRequest = false): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Never surface Google response bodies: they can contain credential details.
    throw new ReportFailure(
      response.status === 429 ? "quota"
        : response.status >= 500 ? "unavailable"
          : tokenRequest || response.status === 401 ? "authentication"
            : response.status === 403 ? "permission" : "unavailable",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ReportFailure("invalid_response");
  }
}

function parseReport(input: unknown, daily: boolean) {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) throw new ReportFailure("invalid_response");
  const report = parsed.data;
  if (report.metricHeaders.map((h) => h.name).join() !== METRICS.join()
    || (report.dimensionHeaders ?? []).map((h) => h.name).join() !== (daily ? "date" : "")) {
    throw new ReportFailure("invalid_response");
  }
  const rows = report.rows ?? [];
  if ((report.rowCount !== undefined && report.rowCount !== rows.length)
    || rows.length > (daily ? 28 : 1)) throw new ReportFailure("invalid_response");
  for (const row of rows) {
    if (row.metricValues.length !== METRICS.length
      || (daily && (row.dimensionValues?.length !== 1 || !/^\d{8}$/.test(row.dimensionValues[0].value)))) {
      throw new ReportFailure("invalid_response");
    }
  }
  return { ...report, rows };
}

function metrics(values: { value: number }[]): GA4Metrics {
  return {
    activeUsers: values[0].value,
    sessions: values[1].value,
    screenPageViews: values[2].value,
    eventCount: values[3].value,
  };
}

/** Authorized DAL; no public API, no credentials or raw upstream errors leave this module. */
export async function getAdminGA4Report(): Promise<GA4Report> {
  // Keep redirects outside the error boundary and authorization before config/network access.
  await requireOperatorPage("/admin/analytics");
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length) return { status: "missing_config", missing };

  const property = process.env.GA4_PROPERTY_ID!;
  const email = process.env.GA4_SERVICE_ACCOUNT_EMAIL!;
  const pem = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");
  if (!/^[1-9]\d*$/.test(property) || !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(email)) {
    return { status: "invalid_config" };
  }
  let key;
  try {
    key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      return { status: "invalid_config" };
    }
  } catch {
    return { status: "invalid_config" };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
      iss: email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })}`;
    const assertion = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), key).toString("base64url")}`;
    const token = z.object({ access_token: z.string().min(1) }).safeParse(await googleJson(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    }, true));
    if (!token.success) throw new ReportFailure("invalid_response");

    const run = async (daily: boolean) => parseReport(await googleJson(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.data.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
          metrics: METRICS.map((name) => ({ name })),
          dimensions: daily ? [{ name: "date" }] : [],
          ...(daily ? { orderBys: [{ dimension: { dimensionName: "date" } }] } : {}),
          limit: daily ? "28" : "1",
          keepEmptyRows: true,
        }),
      },
    ), daily);
    // A distinct undimensioned report avoids double-counting active users across dates.
    const [summary, daily] = await Promise.all([run(false), run(true)]);
    if (!summary.rows.length && !daily.rows.length) return { status: "empty" };
    if (!summary.rows.length || !daily.rows.length) throw new ReportFailure("invalid_response");
    return {
      status: "ready",
      totals: metrics(summary.rows[0].metricValues),
      daily: daily.rows.map((row) => {
        const date = row.dimensionValues![0].value;
        return { date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`, ...metrics(row.metricValues) };
      }),
      timeZone: summary.metadata?.timeZone ?? null,
      thresholded: summary.metadata?.subjectToThresholding === true || daily.metadata?.subjectToThresholding === true,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return { status: "error", reason: error instanceof ReportFailure ? error.reason : "unavailable" };
  }
}
