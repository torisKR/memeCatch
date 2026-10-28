// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { MemeHarvestButton } from "./meme-harvest-button";

describe("MemeHarvestButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the bulk harvest button correctly", () => {
    render(<MemeHarvestButton />);
    expect(screen.getByRole("button", { name: "시대별 밈 대량 자동 수집·적재 (최대 1,000건)" })).toBeDefined();
  });

  it("calls /api/admin/harvest-memes in chained chunks and displays summary", async () => {
    const mockResponse = {
      ok: true,
      summary: { total: 15, created: 10, skipped: 5, nextOffset: null },
      results: [
        { title: "오구오구 챌린지 (AI 펫)", year: 2026, status: "created" },
        { title: "너 T발 C야?", year: 2026, status: "skipped_duplicate" },
      ],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(mockResponse),
    });

    render(<MemeHarvestButton />);
    const button = screen.getByRole("button", { name: "시대별 밈 대량 자동 수집·적재 (최대 1,000건)" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/후보 저장 완료: 검수 대기 10건 \/ 중복 건너뜀 5건/)).toBeDefined();
    });

    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("does not call API if user cancels confirm dialog", () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    global.fetch = vi.fn();

    render(<MemeHarvestButton />);
    const button = screen.getByRole("button", { name: "시대별 밈 대량 자동 수집·적재 (최대 1,000건)" });
    fireEvent.click(button);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
