// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const previewMissingMemeTranslationWithGpt = vi.fn();
const saveMissingMemeTranslationDraft = vi.fn();
const claimTranslationPriority = vi.fn();
const { refresh, push } = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

vi.mock("@/lib/actions/admin-translations", () => ({
  previewMissingMemeTranslationWithGpt: (...args: unknown[]) =>
    previewMissingMemeTranslationWithGpt(...args),
  saveMissingMemeTranslationDraft: (...args: unknown[]) => saveMissingMemeTranslationDraft(...args),
  claimTranslationPriority: (...args: unknown[]) => claimTranslationPriority(...args),
}));

import {
  MissingTranslationDraftPreview,
  type MissingTranslationSourceRow,
} from "./missing-translation-draft-preview";
import { TranslationPriorityQueue } from "./translation-priority-queue";
import type { TranslationPriorityQueueRow } from "@/lib/actions/admin-translations";

const ROWS: MissingTranslationSourceRow[] = [
  {
    memeId: "meme-1",
    shortId: "MC-0001",
    title: "원영적 사고",
    updatedAt: "2026-08-09T01:00:00.000Z",
    routeUnlockCandidate: true,
  },
  {
    memeId: "meme-2",
    shortId: "MC-0002",
    title: "럭키비키",
    updatedAt: "2026-08-09T02:00:00.000Z",
    routeUnlockCandidate: false,
  },
];

const SUCCESS = {
  ok: true as const,
  data: {
    sourceUpdatedAt: "2026-08-09T01:00:00.000Z",
    draft: {
      title: "Wonyoung-style thinking",
      summary: "An intentionally optimistic reframing.",
      description: "A phrase used to turn an inconvenience into a positive outcome.",
      origin: "It spread from online comments about Jang Wonyoung.",
      usage_note: "Use it for lighthearted reframing.",
      caution: "Do not dismiss another person's serious concern.",
      aliases: ["Lucky Vicky"],
      recommendation: "edit" as const,
      confidence: "high" as const,
      review_notes: ["Verify the proper noun before publishing."],
    },
  },
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  previewMissingMemeTranslationWithGpt.mockResolvedValue(SUCCESS);
  saveMissingMemeTranslationDraft.mockResolvedValue({ ok: true });
  claimTranslationPriority.mockResolvedValue({ ok: true });
});

describe("MissingTranslationDraftPreview", () => {
  it("prompts for a locale without invoking the server action", () => {
    render(<MissingTranslationDraftPreview locale={null} rows={ROWS} />);

    expect(screen.getByText(/로케일을 먼저 선택해 주세요/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(previewMissingMemeTranslationWithGpt).not.toHaveBeenCalled();
  });

  it("shows source rows and explicit GPT-5.6 Sol high buttons", () => {
    render(<MissingTranslationDraftPreview locale="en" rows={ROWS} />);

    expect(screen.getByText("원영적 사고")).toBeTruthy();
    expect(screen.getByText("MC-0001")).toBeTruthy();
    expect(screen.getByText("럭키비키")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /GPT-5.6 Sol high/ })).toHaveLength(2);
    expect(screen.getByText("번역 후 글로벌 공개 후보")).toBeTruthy();
    expect(screen.getByText("원문 보강 필요")).toBeTruthy();
    expect(previewMissingMemeTranslationWithGpt).not.toHaveBeenCalled();
  });

  it("shows loading only after a click and sends the selected source revision", async () => {
    let resolvePreview: ((value: typeof SUCCESS) => void) | undefined;
    previewMissingMemeTranslationWithGpt.mockReturnValue(
      new Promise<typeof SUCCESS>((resolve) => {
        resolvePreview = resolve;
      }),
    );
    render(<MissingTranslationDraftPreview locale="ja" rows={ROWS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "원영적 사고 GPT-5.6 Sol high 번역 초안 미리보기" }),
    );

    expect((await screen.findByRole("status")).textContent).toContain("만들고 있어요");
    expect(previewMissingMemeTranslationWithGpt).toHaveBeenCalledWith({
      memeId: "meme-1",
      locale: "ja",
      expectedSourceUpdatedAt: ROWS[0].updatedAt,
    });

    resolvePreview?.(SUCCESS);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("renders every preview field and waits for an explicit edited draft save", async () => {
    render(<MissingTranslationDraftPreview locale="en" rows={ROWS} />);

    fireEvent.click(
      screen.getByRole("button", { name: "원영적 사고 GPT-5.6 Sol high 번역 초안 미리보기" }),
    );

    expect(await screen.findByText(SUCCESS.data.draft.title)).toBeTruthy();
    for (const label of [
      "title",
      "summary",
      "description",
      "origin",
      "usage_note",
      "caution",
      "aliases",
      "recommendation",
      "confidence",
      "review_notes",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(SUCCESS.data.draft.review_notes[0])).toBeTruthy();
    expect(screen.getByText(/저장되거나 발행되지 않았습니다/)).toBeTruthy();
    expect(screen.getByText(/반드시 사람이 검토해야 합니다/)).toBeTruthy();
    expect(saveMissingMemeTranslationDraft).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("title"), { target: { value: "Edited title" } });
    fireEvent.click(screen.getByRole("button", { name: "검수 대기 초안 저장" }));

    await waitFor(() =>
      expect(saveMissingMemeTranslationDraft).toHaveBeenCalledWith({
        memeId: "meme-1",
        locale: "en",
        expectedSourceUpdatedAt: SUCCESS.data.sourceUpdatedAt,
        title: "Edited title",
        summary: SUCCESS.data.draft.summary,
        description: SUCCESS.data.draft.description,
        origin: SUCCESS.data.draft.origin,
        usageNote: SUCCESS.data.draft.usage_note,
        caution: SUCCESS.data.draft.caution,
        aliases: SUCCESS.data.draft.aliases,
      }),
    );
    expect(await screen.findByText(/machine 초안을 검수 큐에 저장했어요/)).toBeTruthy();
  });

  it("runs the zh route-unlock lane and selects the next candidate after saving", async () => {
    const priorityRow: TranslationPriorityQueueRow = {
      memeId: "meme-1",
      locale: "zh",
      requestCount: 4,
      latestRequestedAt: "2026-08-09T01:00:00.000Z",
      status: "requested",
      memeTitle: "원영적 사고",
      memeShortId: "MC-0001",
      memeSlug: "wonyoung-thinking",
      translationStatus: null,
      translationUpdatedAt: null,
      sourceUpdatedAt: ROWS[0].updatedAt,
      routeUnlockCandidate: true,
    };
    render(<MissingTranslationDraftPreview locale="zh" rows={ROWS} priorityRows={[priorityRow]} />);

    expect(screen.getByText("ZH ROUTE-UNLOCK OPERATOR LANE")).toBeTruthy();
    expect(screen.getByText("Plus 4건 요청")).toBeTruthy();
    expect(screen.getByRole("list", { name: "中文(简体) Route-Unlock 운영 큐" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "원영적 사고 GPT-5.6 Sol high 번역 초안 미리보기" }),
    );
    expect(await screen.findByText(SUCCESS.data.draft.title)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "검수 대기 초안 저장" }));

    expect(await screen.findByText(/다음 후보: 럭키비키/)).toBeTruthy();
    expect(screen.queryByText(SUCCESS.data.draft.title)).toBeNull();
    expect(screen.getByText("럭키비키").closest("li")?.getAttribute("data-translation-operator-active")).toBe(
      "true",
    );
  });

  it("shows initial and action errors as alerts", async () => {
    const { rerender } = render(
      <MissingTranslationDraftPreview locale="zh" rows={ROWS} initialError="목록 오류" />,
    );
    expect(screen.getByRole("alert").textContent).toContain("목록 오류");

    previewMissingMemeTranslationWithGpt.mockResolvedValue({ ok: false, error: "GPT 호출 오류" });
    rerender(<MissingTranslationDraftPreview locale="zh" rows={ROWS} />);
    fireEvent.click(
      screen.getByRole("button", { name: "원영적 사고 GPT-5.6 Sol high 번역 초안 미리보기" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain("GPT 호출 오류");
  });

  it("claims a missing translation before opening the focused GPT draft route", async () => {
    const row: TranslationPriorityQueueRow = {
      memeId: "meme-1",
      locale: "en",
      requestCount: 3,
      latestRequestedAt: "2026-08-09T01:00:00.000Z",
      status: "requested",
      memeTitle: "원영적 사고",
      memeShortId: "MC-0001",
      memeSlug: "wonyoung-thinking",
      translationStatus: null,
      translationUpdatedAt: null,
      sourceUpdatedAt: "2026-08-09T01:00:00.000Z",
      routeUnlockCandidate: false,
    };
    render(<TranslationPriorityQueue rows={[row]} />);

    fireEvent.click(screen.getByRole("button", { name: "초안 만들기" }));

    await waitFor(() => {
      expect(claimTranslationPriority).toHaveBeenCalledWith({ memeId: "meme-1", locale: "en" });
      expect(push).toHaveBeenCalledWith("/admin/translations?locale=en&focus=meme-1");
    });
  });

  it("keeps the operator on the queue when the missing translation claim fails", async () => {
    claimTranslationPriority.mockResolvedValue({ ok: false, error: "이미 다른 운영자가 검수 중이에요." });
    const row: TranslationPriorityQueueRow = {
      memeId: "meme-1",
      locale: "en",
      requestCount: 3,
      latestRequestedAt: "2026-08-09T01:00:00.000Z",
      status: "requested",
      memeTitle: "원영적 사고",
      memeShortId: "MC-0001",
      memeSlug: "wonyoung-thinking",
      translationStatus: null,
      translationUpdatedAt: null,
      sourceUpdatedAt: "2026-08-09T01:00:00.000Z",
      routeUnlockCandidate: false,
    };
    render(<TranslationPriorityQueue rows={[row]} />);

    fireEvent.click(screen.getByRole("button", { name: "초안 만들기" }));

    expect((await screen.findByRole("alert")).textContent).toContain("이미 다른 운영자가 검수 중이에요.");
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps an unavailable Plus queue distinct from an empty queue", () => {
    render(<TranslationPriorityQueue rows={[]} error="rpc unavailable" />);

    expect(screen.getByRole("alert").textContent).toContain("0건으로 간주하지 않았습니다");
    expect(screen.queryByText("현재 대기 중인 Plus 번역 요청이 없어요.")).toBeNull();
  });
});
