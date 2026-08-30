// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const transitionMemeStatus = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions/admin", () => ({
  transitionMemeStatus: (...args: unknown[]) => transitionMemeStatus(...args),
}));

import { MemeStatusControls } from "./meme-status-controls";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MemeStatusControls house original attestation", () => {
  it("blocks approve until the operator attests", async () => {
    transitionMemeStatus.mockResolvedValue({ ok: true });
    render(
      <MemeStatusControls
        memeId="meme-1"
        currentStatus="rights_checking"
        originKind="house_original"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "게시 승인" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "자체 제작 권리 확인에 동의해 주세요.",
    );
    expect(transitionMemeStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "게시 승인" }));
    await waitFor(() => {
      expect(transitionMemeStatus).toHaveBeenCalledWith({
        memeId: "meme-1",
        to: "approved",
        attested: true,
      });
    });
  });

  it("does not require attestation on catalog transitions", async () => {
    transitionMemeStatus.mockResolvedValue({ ok: true });
    render(
      <MemeStatusControls memeId="meme-1" currentStatus="rights_checking" originKind="catalog" />,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "게시 승인" }));
    await waitFor(() => {
      expect(transitionMemeStatus).toHaveBeenCalledWith({
        memeId: "meme-1",
        to: "approved",
        attested: undefined,
      });
    });
  });
});
