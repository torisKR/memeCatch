// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { SourceIngestionForm } from "@/components/admin/source-ingestion-form";

const memes = [
  { id: "meme-1", title: "극적인 다람쥐", short_id: "chipmunk" },
  { id: "meme-2", title: "놀란 고양이", short_id: "cat" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function submit() {
  const user = userEvent.setup();
  render(<SourceIngestionForm memes={memes} />);
  await user.type(screen.getByRole("textbox", { name: "SNS URL" }), "https://youtu.be/abc123");
  await user.selectOptions(screen.getByRole("combobox", { name: "연결할 밈" }), "meme-1");
  await user.click(screen.getByRole("button", { name: "검수 후보 만들기" }));
}

describe("SourceIngestionForm", () => {
  it("submits a supported URL with the required target meme and shows the pending result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          id: "source-1",
          status: "linked",
          platform: "youtube",
          externalId: "abc123",
          canonicalUrl: "https://www.youtube.com/watch?v=abc123",
          rightsMode: "METADATA_ONLY",
          duplicate: false,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await submit();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/source-ingestions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ url: "https://youtu.be/abc123", targetMemeId: "meme-1" }),
        }),
      );
    });
    expect(await screen.findByText("검수 대기 후보를 만들었어요.")).toBeTruthy();
    expect(screen.getByText("메타데이터 전용")).toBeTruthy();
    expect(screen.getByText("검수 대기")).toBeTruthy();
    expect(screen.getByRole("link", { name: "https://www.youtube.com/watch?v=abc123" })).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a duplicate without pretending that a new review item was created", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          status: "duplicate",
          platform: "youtube",
          canonicalUrl: "https://www.youtube.com/watch?v=abc123",
          rightsMode: "METADATA_ONLY",
          duplicate: true,
        },
      }),
    }));

    await submit();

    expect(await screen.findByText("이미 등록된 출처예요.")).toBeTruthy();
    expect(screen.getByText("중복")).toBeTruthy();
    expect(screen.queryByText("검수 대기에 추가했어요.")).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the server error and does not refresh the queue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "지원하지 않는 SNS URL이에요." }),
    }));

    await submit();

    expect((await screen.findByRole("alert")).textContent).toContain("지원하지 않는 SNS URL이에요.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a retry affordance for transient failures and retries the unchanged input", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ ok: false, error: "일시적으로 확인할 수 없어요.", code: "provider_transient", retryable: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { status: "linked", platform: "youtube", canonicalUrl: "https://www.youtube.com/watch?v=abc123", rightsMode: "METADATA_ONLY", duplicate: false } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await submit();
    expect(await screen.findByRole("button", { name: "같은 입력으로 다시 확인" })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "같은 입력으로 다시 확인" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      body: JSON.stringify({ url: "https://youtu.be/abc123", targetMemeId: "meme-1", retry: true }),
    }));
    expect(await screen.findByText("검수 대기 후보를 만들었어요.")).toBeTruthy();
  });

  it("does not retry stale edited input", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "일시적으로 확인할 수 없어요.", code: "provider_transient", retryable: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<SourceIngestionForm memes={memes} />);
    await user.type(screen.getByRole("textbox", { name: "SNS URL" }), "https://youtu.be/abc123");
    await user.selectOptions(screen.getByRole("combobox", { name: "연결할 밈" }), "meme-1");
    await user.click(screen.getByRole("button", { name: "검수 후보 만들기" }));
    const retry = await screen.findByRole("button", { name: "같은 입력으로 다시 확인" });
    await user.clear(screen.getByRole("textbox", { name: "SNS URL" }));
    await user.type(screen.getByRole("textbox", { name: "SNS URL" }), "https://youtu.be/changed");
    await user.click(retry);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("입력한 URL 또는 연결할 밈이 바뀌었어요. 현재 값으로 다시 시도해 주세요.")).toBeTruthy();
  });

  it("keeps successful intake visibly pending human review and preserves duplicate state", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { status: "linked", platform: "youtube", canonicalUrl: "https://www.youtube.com/watch?v=abc123", rightsMode: "METADATA_ONLY", duplicate: false } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await submit();

    expect(await screen.findByText("운영자 검수 후에만 공개돼요.")).toBeTruthy();
    expect(screen.getByText("검수 대기")).toBeTruthy();
  });

  it("shows recovery cleanup warning as a successful intake notice", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { status: "linked", platform: "youtube", canonicalUrl: "https://www.youtube.com/watch?v=abc123", rightsMode: "METADATA_ONLY", duplicate: false, warning: "recovery_resolution_failed" } }),
    }));
    await submit();

    expect(await screen.findByText(/출처 접수는 성공했어요/)).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /다시/ })).toBeNull();
  });
});
