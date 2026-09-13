// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceRecoveryPanel } from "./source-recovery-panel";

const entry = {
  sourceKey: "youtube:abc",
  sourceId: null,
  platform: "youtube" as const,
  externalId: "abc",
  canonicalUrl: "https://www.youtube.com/watch?v=abc",
  attemptCount: 2,
  nextRetryAt: "2026-09-12T00:00:00.000Z",
  lastErrorCode: "provider_transient" as const,
  lastErrorRetryable: true,
  lastAttemptedAt: "2026-09-11T23:00:00.000Z",
  resolvedAt: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SourceRecoveryPanel", () => {
  it("renders due recovery DTO details and requires an explicit target meme", async () => {
    render(<SourceRecoveryPanel entries={[entry]} memes={[{ id: "meme-1", title: "강아지 밈", short_id: "abc1" }]} now={new Date("2026-09-12T01:00:00.000Z").getTime()} />);

    expect(screen.getByText("재시도 시점 도래")).toBeTruthy();
    expect(screen.getByText("시도 횟수").parentElement?.textContent).toContain("2회");
    expect(screen.getByText("source_id 연결").parentElement?.textContent).toContain("없음");
    expect(screen.getByRole("button", { name: "수동 재시도" })).toBeTruthy();

    await userEvent.setup().click(screen.getByRole("button", { name: "수동 재시도" }));
    expect(screen.getByRole("alert").textContent).toContain("연결할 밈을 모두 선택");
  });

  it("reuses the authorized ingestion endpoint after selecting a target", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }));
    const user = userEvent.setup();
    render(<SourceRecoveryPanel entries={[entry]} memes={[{ id: "meme-1", title: "강아지 밈", short_id: "abc1" }]} now={new Date("2026-09-12T01:00:00.000Z").getTime()} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "재시도 후 연결할 밈" }), "meme-1");
    await user.click(screen.getByRole("button", { name: "수동 재시도" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/source-ingestions", expect.objectContaining({ method: "POST" })));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ url: entry.canonicalUrl, targetMemeId: "meme-1", retry: true });
  });

  it("allows explicit manual reconsideration for permanent or uncertain records", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }));
    const user = userEvent.setup();
    render(<SourceRecoveryPanel entries={[{ ...entry, sourceKey: "uncertain", lastErrorCode: "provider_uncertain", lastErrorRetryable: false, nextRetryAt: null }]} memes={[{ id: "meme-1", title: "강아지 밈", short_id: "abc1" }]} now={new Date("2026-09-12T01:00:00.000Z").getTime()} />);
    expect(screen.getByRole("button", { name: "수동 재검토" })).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "재시도 후 연결할 밈" }), "meme-1");
    await user.click(screen.getByRole("button", { name: "수동 재검토" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("keeps a successful manual retry successful when recovery cleanup returns a warning", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, data: {}, warning: "recovery_resolution_failed" }), { status: 200 }));
    const user = userEvent.setup();
    render(<SourceRecoveryPanel entries={[{ ...entry, sourceKey: "uncertain", lastErrorRetryable: false, nextRetryAt: null }]} memes={[{ id: "meme-1", title: "강아지 밈", short_id: "abc1" }]} now={new Date("2026-09-12T01:00:00.000Z").getTime()} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "재시도 후 연결할 밈" }), "meme-1");
    await user.click(screen.getByRole("button", { name: "수동 재검토" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole("status")).textContent).toContain("재확인은 성공했어요");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows deferred, permanent, and load failure states without inventing metrics", () => {
    render(<SourceRecoveryPanel entries={[{ ...entry, nextRetryAt: "2026-09-12T02:00:00.000Z" }, { ...entry, sourceKey: "x", lastErrorRetryable: false, nextRetryAt: null }]} memes={[]} now={new Date("2026-09-12T00:00:00.000Z").getTime()} loadError={null} />);
    expect(screen.getByText("재시도 예약됨")).toBeTruthy();
    expect(screen.getByText("자동 재시도 없음")).toBeTruthy();
    cleanup();
    render(<SourceRecoveryPanel entries={[]} memes={[]} now={new Date("2026-09-12T00:00:00.000Z").getTime()} loadError="source_recovery_query_failed" />);
    expect(screen.getByRole("alert").textContent).toContain("source_recovery_query_failed");
  });
});
