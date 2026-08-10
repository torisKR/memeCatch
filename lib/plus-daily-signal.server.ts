import "server-only";

import type { SafetyLevel } from "@/lib/labels";
import { DAILY_SIGNAL_COPY } from "@/lib/plus-daily-signal-copy";
import { buildPlusDailySignalPremiumPath } from "@/lib/plus-daily-signal-routing";
import { SITE_URL } from "@/lib/site";
import type { Locale } from "@/lib/i18n";
import type { UsageExample } from "@/lib/usage-examples";

export type DailySignalLocale = Extract<Locale, "ko" | "en" | "ja" | "zh" | "zh-tw">;

export type PlusDailySignalCandidate = {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string;
  usageNote: string | null;
  caution: string | null;
  shareReady: boolean;
  trendScore: number;
  safetyLevel: SafetyLevel;
  source: "saved_rising" | "interest_rising";
  usageExamples?: UsageExample[];
};

export type PlusDailySignalEmail = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
};

export function plusDailySignalSince(now = new Date()): string {
  return new Date(now.getTime() - 36 * 60 * 60 * 1_000).toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function trimText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildPremiumUrl(
  candidate: PlusDailySignalCandidate,
  locale: DailySignalLocale,
  baseUrl: string,
): string {
  return `${baseUrl.replace(/\/+$/, "")}${buildPlusDailySignalPremiumPath(candidate.id, locale)}`;
}

export function buildPlusDailySignalEmail({
  locale,
  candidates,
  baseUrl = SITE_URL,
}: {
  locale: DailySignalLocale;
  candidates: readonly PlusDailySignalCandidate[];
  baseUrl?: string;
}): PlusDailySignalEmail {
  const copy = DAILY_SIGNAL_COPY[locale];
  const items = candidates
    .map((candidate) => ({
      ...candidate,
      title: trimText(candidate.title),
      summary: trimText(candidate.summary),
      url: buildPremiumUrl(candidate, locale, baseUrl),
      reason: candidate.source === "saved_rising" ? copy.savedReason : copy.interestReason,
      safety: copy.safety(candidate.safetyLevel),
    }))
    .filter((candidate) => candidate.title.length > 0 && candidate.summary.length > 0)
    .slice(0, 3);
  const subject = copy.subject(items.length);
  const text = [
    copy.title,
    copy.intro,
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.title}`,
      item.summary,
      item.reason,
      item.safety,
      `${copy.action}: ${item.url}`,
      "",
    ]),
    copy.footer,
    copy.unsubscribe,
  ].join("\n");
  const htmlItems = items
    .map((item) => `
      <li style="margin:0 0 16px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;">
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;">${escapeHtml(item.reason)}</p>
        <h2 style="margin:0 0 8px;font-size:18px;line-height:1.35;">${escapeHtml(item.title)}</h2>
        <p style="margin:0 0 12px;line-height:1.6;">${escapeHtml(item.summary)}</p>
        <p style="margin:0 0 12px;font-size:12px;color:#64748b;">${escapeHtml(item.safety)}</p>
        <a href="${escapeHtml(item.url)}" style="color:#0f766e;font-weight:700;">${escapeHtml(copy.action)}</a>
      </li>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;">
  <main style="max-width:620px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 8px;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">MemeCatch Plus</p>
    <p style="margin:0 0 8px;color:#64748b;font-size:13px;">${escapeHtml(copy.preheader)}</p>
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">${escapeHtml(copy.title)}</h1>
    <p style="margin:0 0 24px;line-height:1.6;">${escapeHtml(copy.intro)}</p>
    <ol style="margin:0;padding:0;list-style:none;">${htmlItems}</ol>
    <p style="margin:24px 0 6px;color:#64748b;font-size:12px;line-height:1.6;">${escapeHtml(copy.footer)}</p>
    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">${escapeHtml(copy.unsubscribe)}</p>
  </main></body></html>`;

  return { subject, preheader: copy.preheader, text, html };
}
