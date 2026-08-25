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
    expect(await screen.findByText("검수 대기에 추가했어요.")).toBeTruthy();
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
});
