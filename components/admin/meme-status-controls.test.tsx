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

    fireEvent.click(screen.getByRole("button", { name: "수동 게시" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "자체 제작 권리 확인에 동의해 주세요.",
    );
    expect(transitionMemeStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "수동 게시" }));
    await waitFor(() => {
      expect(transitionMemeStatus).toHaveBeenCalledWith({
        memeId: "meme-1",
        to: "approved",
        attested: true,
      });
    });
  });

  it("marks the current path step for assistive tech on rights_checking", () => {
    render(
      <MemeStatusControls
        memeId="meme-1"
        currentStatus="rights_checking"
        originKind="house_original"
      />,
    );
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("권리 확인");
    expect(screen.getByRole("button", { name: "수동 게시" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "사실 확인으로" })).toBeTruthy();
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

  it("shows a yellow evidence warning before approve when rights sources are missing", () => {
    render(
      <MemeStatusControls
        memeId="meme-1"
        currentStatus="rights_checking"
        originKind="house_original"
        hasRightsEvidence={false}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("권리 근거");
    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect(screen.getByRole("checkbox").getAttribute("aria-required")).toBe("true");
    expect(screen.getByRole("checkbox").getAttribute("aria-describedby")).toBe(
      "house-original-rights-evidence",
    );
    expect((screen.getByRole("button", { name: "수동 게시" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("shows the pending→fact→rights→manual publish path and rights source URL", () => {
    render(
      <MemeStatusControls
        memeId="meme-1"
        currentStatus="pending"
        originKind="house_original"
        rightsSourceUrl="https://catchmeme.com/memes/abcd1234-test"
      />,
    );
    const path = screen.getByRole("list", { name: "자체 제작 검수 경로" });
    expect(path.textContent).toContain("대기");
    expect(path.textContent).toContain("사실 확인");
    expect(path.textContent).toContain("권리 확인");
    expect(path.textContent).toContain("수동 게시");
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("대기");
    expect(screen.getByText("자동 게시하지 않습니다.", { exact: false })).toBeTruthy();
    expect(screen.getByRole("link", { name: "https://catchmeme.com/memes/abcd1234-test" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "게시 승인" })).toBeNull();
  });
});
