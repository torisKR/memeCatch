// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  approveSubmission: vi.fn(),
  claimSubmission: vi.fn(),
  generateDraft: vi.fn(),
  rejectSubmission: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/actions/admin", () => ({
  approveSubmission: mocks.approveSubmission,
  claimSubmission: mocks.claimSubmission,
  generateDraft: mocks.generateDraft,
  rejectSubmission: mocks.rejectSubmission,
}));

import { SubmissionReview } from "./submission-review";

const submissionId = "10000000-0000-4000-8000-000000000001";
const memeId = "20000000-0000-4000-8000-000000000002";

function approvalForm() {
  render(<SubmissionReview
    submissionId={submissionId}
    submissionName="제보한 밈"
    submissionTags={["테스트"]}
    status="pending"
    claimedByMe={false}
    hasOpenAiReviewKey={false}
  />);
  fireEvent.click(screen.getByRole("button", { name: "승인 → 밈 생성" }));
  fireEvent.change(screen.getByLabelText("한 줄 요약"), { target: { value: "검수한 요약" } });
  const button = screen.getByRole("button", { name: "밈 생성 및 게시" });
  const form = button.closest("form");
  if (!form) throw new Error("approval form not found");
  return { button, form };
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("SubmissionReview publication results", () => {
  it("keeps the explicit publish button and redirects only after ordinary approval success", async () => {
    mocks.approveSubmission.mockResolvedValue({ ok: true, data: { memeId } });
    const { button } = approvalForm();
    expect(mocks.approveSubmission).not.toHaveBeenCalled();
    expect(screen.getByText("승인하면 밈이 생성되고 검수 상태가", { exact: false })).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/submissions"));
    expect(mocks.approveSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.approveSubmission).toHaveBeenCalledWith(expect.objectContaining({
      submissionId, title: "제보한 밈", summary: "검수한 요약",
    }));
  });

  it.each(["제보 상태 저장", "감사 기록 저장"])("shows %s recovery without redirect or repeat approval", async (step) => {
    const warning = `밈은 이미 게시됐지만 ${step}에 실패했어요. 다시 승인하지 말고 제보와 밈 관리에서 저장 상태를 확인해 주세요.`;
    mocks.approveSubmission.mockResolvedValue({ ok: true, data: { memeId, warning } });
    const { button, form } = approvalForm();
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", warning);
    expect(mocks.push).not.toHaveBeenCalled();

    const memeLink = screen.getByRole("link", { name: `게시된 밈 관리 (ID: ${memeId})` });
    const submissionLink = screen.getByRole("link", { name: `제보 상태 확인 (ID: ${submissionId})` });
    expect(memeLink.getAttribute("href")).toBe(`/admin/memes/${memeId}`);
    expect(submissionLink.getAttribute("href")).toBe(`/admin/submissions/${submissionId}`);
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "밈 생성 및 게시" }) as HTMLButtonElement).disabled).toBe(true);
    });
    expect((screen.getByRole("button", { name: "승인 → 밈 생성" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "반려" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(form);
    expect(mocks.approveSubmission).toHaveBeenCalledTimes(1);
  });

  it("locks successful approval even while ordinary redirect is pending", async () => {
    mocks.approveSubmission.mockResolvedValue({ ok: true, data: { memeId } });
    const { button, form } = approvalForm();
    fireEvent.click(button);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/submissions"));
    fireEvent.submit(form);
    expect(mocks.approveSubmission).toHaveBeenCalledTimes(1);
  });

  it.each(["출처 저장", "상태 전이"])("locks %s failure after creation and links to the saved draft", async (step) => {
    const error = `${step}에 실패했어요. 승인을 다시 실행하지 말고 밈 관리에서 검수를 이어서 처리해 주세요. (밈 ID: ${memeId})`;
    mocks.approveSubmission.mockResolvedValue({ ok: false, error, createdMemeId: memeId });
    const { button, form } = approvalForm();
    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", error);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /게시된 밈 관리/ })).toBeNull();
    const savedLink = screen.getByRole("link", { name: `등록된 밈 관리 (ID: ${memeId})` });
    expect(savedLink.getAttribute("href")).toBe(`/admin/memes/${memeId}`);
    expect(screen.getByRole("link", { name: `제보 상태 확인 (ID: ${submissionId})` }).getAttribute("href")).toBe(
      `/admin/submissions/${submissionId}`,
    );
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "밈 생성 및 게시" }) as HTMLButtonElement).disabled).toBe(true);
    });
    expect((screen.getByRole("button", { name: "승인 → 밈 생성" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(form);
    expect(mocks.approveSubmission).toHaveBeenCalledTimes(1);
  });

  it("allows retry after validation failure without a created meme ID", async () => {
    mocks.approveSubmission
      .mockResolvedValueOnce({ ok: false, error: "한 줄 요약을 입력해 주세요." })
      .mockResolvedValueOnce({ ok: true, data: { memeId } });
    const { button, form } = approvalForm();
    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "한 줄 요약을 입력해 주세요.");
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "밈 생성 및 게시" }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.queryByRole("link", { name: /등록된 밈 관리/ })).toBeNull();
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin/submissions"));
    expect(mocks.approveSubmission).toHaveBeenCalledTimes(2);
  });
});
