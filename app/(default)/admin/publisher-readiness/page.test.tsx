import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a>,
}));
vi.mock("@/app/(default)/admin/require-operator", () => ({ requireOperatorPage: vi.fn() }));
vi.mock("@/lib/publisher-readiness.server", () => ({ listPublisherReadinessPage: vi.fn() }));

import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import type { PublisherReadinessReport } from "@/lib/publisher-readiness";
import { listPublisherReadinessPage } from "@/lib/publisher-readiness.server";
import Page, { metadata } from "./page";

const report: PublisherReadinessReport = {
  page: 2,
  pageSize: 100,
  totalPages: 44,
  totalPublic: 4378,
  inspectedCount: 100,
  displayedCount: 1,
  focus: "source" as const,
  items: [
    {
      id: "meme-1",
      shortId: "abc12345",
      slug: "dangerous",
      title: '<script>alert("xss")</script>',
      moderationStatus: "approved",
      publishedAt: null,
      editHref: "/admin/memes/meme-1",
      publicHref: "/memes/abc12345-dangerous",
      sourceWorkflowHref: "/admin/sources",
      safeSourceUrls: [],
      fingerprint: "fingerprint",
      rights: { status: "unknown", confirmedCount: 0, unknownCount: 0, restrictedCount: 0 },
      media: { status: "absent", renderableCount: 0, uncheckedCount: 0, unavailableCount: 0 },
      safety: { status: "unknown", reviewedAt: null },
      sourceFreshness: { status: "absent", staleCount: 0, unavailableCount: 0 },
      review: { status: "unreviewed", reviewedAt: null, note: null },
      depth: {
        score: 0,
        proseChars: 2,
        isSubstantial: false,
        isThin: true,
        signals: {
          descriptionChars: 2,
          originChars: 0,
          supportingProseChars: 0,
          usageExampleCount: 0,
          usageExampleChars: 0,
          sourceCount: 0,
          mediaCount: 0,
          tagCount: 0,
        },
      },
      issueCodes: ["source", "summary", "date", "depth", "review"],
      issues: [
        {
          code: "source",
          label: "공개 출처 없음",
          explanation: "검증 가능한 공개 HTTP(S) 출처가 없습니다.",
          action: "밈 편집 또는 출처 검수에서 공개 출처를 확인하세요.",
        },
      ],
    },
  ],
};

describe("publisher readiness page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOperatorPage).mockResolvedValue({ supabase: { from: vi.fn() } } as never);
    vi.mocked(listPublisherReadinessPage).mockResolvedValue(report);
  });

  it.each(["anonymous", "non-operator"])("denies %s before any readiness query", async (kind) => {
    vi.mocked(requireOperatorPage).mockRejectedValue(new Error(kind));

    await expect(Page({ searchParams: Promise.resolve({ page: "2" }) })).rejects.toThrow(kind);
    expect(listPublisherReadinessPage).not.toHaveBeenCalled();
  });

  it("is noindex and passes bounded page-local filters after the operator guard", async () => {
    await Page({ searchParams: Promise.resolve({ page: "2", focus: "source" }) });

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(requireOperatorPage).toHaveBeenCalledWith("/admin/publisher-readiness", {
      page: "2",
      focus: "source",
    });
    expect(listPublisherReadinessPage).toHaveBeenCalledWith(expect.anything(), {
      page: 2,
      focus: "source",
    });
  });

  it("distinguishes total corpus, inspected page, and page-local focus results", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ page: "2", focus: "source" }) }),
    );

    expect(html).toContain("전체 공개 문서");
    expect(html).toContain("4,378");
    expect(html).toContain("이번 페이지 검사");
    expect(html).toContain("100");
    expect(html).toContain("현재 페이지 안에서만");
    expect(html).toContain("1건");
  });

  it("escapes record text and links every row to edit, public, and source workflows", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ page: "2", focus: "source" }) }),
    );

    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('href="/admin/memes/meme-1"');
    expect(html).toContain('href="/memes/abc12345-dangerous"');
    expect(html).toContain('href="/admin/sources"');
  });

  it("describes account checks as manual and does not assert live or approved status", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ page: "2", focus: "source" }) }),
    );

    expect(html).toContain("직접 확인");
    expect(html).toContain("실시간 계정 상태를 표시하지 않습니다");
    expect(html).not.toMatch(/승인 완료|승인되었습니다|Google-approved/i);
  });

  it("shows rights, renderability, safety, and fingerprinted human-review status as internal diagnostics", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ page: "2", focus: "source" }) }),
    );

    expect(html).toContain("권리/전달 근거");
    expect(html).toContain("공개 미디어");
    expect(html).toContain("안전 검수");
    expect(html).toContain("사람 검수 미완료");
    expect(html).toContain("광고 검수 보류 진단");
    expect(html).toContain('name="expectedFingerprint"');
    expect(html).toContain('value="fingerprint"');
    expect(html).not.toContain("공개 중단");
  });

  it("propagates a loader error rather than rendering an empty pass", async () => {
    vi.mocked(listPublisherReadinessPage).mockRejectedValue(new Error("read failed"));

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("read failed");
  });
});
