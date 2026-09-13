// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  reprocess: vi.fn(),
  review: vi.fn(),
  reviewClaim: vi.fn(),
  saveRevision: vi.fn(),
  setSourceRights: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
vi.mock("@/lib/actions/admin-mpe", () => ({
  reprocessMpeJob: actions.reprocess,
  reviewMpeCandidate: actions.review,
  reviewMpeClaim: actions.reviewClaim,
  saveMpeCandidateRevision: actions.saveRevision,
  setMpeIngestionSourceRights: actions.setSourceRights,
}));

import { MpeReviewConsole, type MpeReviewConsoleProps } from "./mpe-review-console";

const base: MpeReviewConsoleProps = {
  candidate: { id: "candidate-1", title: "찹츄", memeType: "SOUND", reviewStatus: "FACT_CHECKING", overallConfidence: 0.84, draft: { title: "찹츄", reviewNotes: [{ field: "ORIGIN", reason: "최초 유래를 확인할 근거가 부족해요." }] }, modelVersion: "gpt-test", promptVersion: "v3" },
  media: { ingestionId: "ingestion-1", sourceUrl: "https://www.tiktok.com/@creator/video/123", sourceTitle: "강아지 밥", authorName: "creator", publishedAt: null, availabilityStatus: "AVAILABLE", rightsMode: "USER_UPLOADED", rightsAttested: true, sourceRole: "original", rightsBasis: "creator_permission", mimeType: "video/mp4", dimensions: "1080×1920", durationMs: 5000 },
  jobs: [{ id: "job-1", jobType: "ASR", status: "FAILED", attempts: 1, processor: "whisper:test", errorCode: "TIMEOUT", canReprocess: true }],
  timeline: [
    { id: "ocr", origin: "OCR", startMs: 800, endMs: 1200, text: "화면 문구", confidence: 0.9 },
    { id: "asr", origin: "ASR", startMs: 1100, endMs: 1800, text: "음성 문구", confidence: 0.8 },
  ],
  artifacts: [{ id: "frame-1", kind: "REPRESENTATIVE_FRAME", frameMs: 1200, reference: "artifacts/frame-1.webp", representative: true, signedUrl: "https://signed.example/frame-1.webp", mimeType: "image/webp" }],
  matches: [{ id: "match-1", targetTitle: "관련 강아지 밈", relation: "RELATED", score: 0.65 }],
  claims: [{ id: "claim-1", field: "USAGE", text: "반려동물 영상에 사용된다", confidence: 0.84, reviewStatus: "APPROVED", evidence: ["OCR 00:00.800", "ASR 00:01.100"] }],
  revisions: [
    { id: "revision-2", revisionNumber: 2, draft: { title: "수정" }, modelVersion: "gpt-test", promptVersion: "v3", createdAt: "2026-08-24T00:00:00Z" },
    { id: "revision-1", revisionNumber: 1, draft: { title: "원본" }, modelVersion: "gpt-test", promptVersion: "v3", createdAt: "2026-08-23T00:00:00Z" },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MpeReviewConsole", () => {
  it("renders AI review notes as uncalibrated assistance without changing approval controls", () => {
    render(<MpeReviewConsole {...base} />);

    expect(screen.getByRole("heading", { name: "자동 분석 참고 신호" })).toBeTruthy();
    expect(screen.getByText("자동 분석 참고 신호").parentElement?.textContent).toContain("84%");
    expect(screen.getByText("유래 확인 필요")).toBeTruthy();
    expect(screen.getByText("최초 유래를 확인할 근거가 부족해요.")).toBeTruthy();
    expect(screen.getByText(/사실 확인이나 권리 승인을 대신하지 않아요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "사실 검수 승인" })).toBeTruthy();
  });

  it("supports legacy drafts without review notes or a confidence value", () => {
    render(<MpeReviewConsole {...base} candidate={{ ...base.candidate, overallConfidence: null, draft: { title: "레거시" } }} />);

    expect(screen.getByText("참고값 없음")).toBeTruthy();
    expect(screen.getByText("추가 보류 메모가 없어요. 그래도 운영자 사실·권리 검수는 필요해요.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "자동 분석 보류 메모" })).toBeNull();
  });

  it("keeps review actions disabled while a human decision is pending", async () => {
    let resolveReview: (() => void) | undefined;
    actions.review.mockReturnValue(new Promise((resolve) => {
      resolveReview = () => resolve({ ok: true });
    }));
    const user = userEvent.setup();
    render(<MpeReviewConsole {...base} />);

    await user.click(screen.getByRole("button", { name: "사실 검수 승인" }));

    expect(screen.getByRole("button", { name: "사실 검수 승인" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "수정 요청" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "반려" }).hasAttribute("disabled")).toBe(true);
    resolveReview?.();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  });

  it("renders the ordered ASR/OCR timeline, artifacts, matches, and evidence", () => {
    render(<MpeReviewConsole {...base} />);
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items.some((text) => text?.includes("00:00.800 · OCR") && text.includes("화면 문구"))).toBe(true);
    expect(items.some((text) => text?.includes("00:01.100 · ASR") && text.includes("음성 문구"))).toBe(true);
    expect(screen.getByText(/대표 · REPRESENTATIVE_FRAME/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "00:01.200 대표 프레임" }).getAttribute("src")).toBe("https://signed.example/frame-1.webp");
    expect(screen.queryByText("artifacts/frame-1.webp")).toBeNull();
    expect(screen.getByText(/관련 강아지 밈 · RELATED/)).toBeTruthy();
    expect(screen.getByText(/근거: OCR 00:00.800, ASR 00:01.100/)).toBeTruthy();
    expect(screen.getByText(/revision 2 · gpt-test · v3/)).toBeTruthy();
    expect(screen.getByText(/revision 1 · gpt-test · v3/)).toBeTruthy();
    expect(screen.queryByText(/<iframe/i)).toBeNull();
  });

  it.each([
    ["FACT_CHECKING", "사실 검수 승인"],
    ["RIGHTS_CHECKING", "권리 검수 승인"],
    ["PUBLISH", "공개"],
  ] as const)("shows only the current %s stage action", (reviewStatus, label) => {
    render(<MpeReviewConsole {...base} candidate={{ ...base.candidate, reviewStatus }} />);
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
    if (reviewStatus !== "FACT_CHECKING") expect(screen.queryByRole("button", { name: "사실 검수 승인" })).toBeNull();
    if (reviewStatus !== "RIGHTS_CHECKING") expect(screen.queryByRole("button", { name: "권리 검수 승인" })).toBeNull();
    if (reviewStatus !== "PUBLISH") expect(screen.queryByRole("button", { name: "공개" })).toBeNull();
  });

  it("blocks publish when evidence or rights are missing", () => {
    render(<MpeReviewConsole {...base} candidate={{ ...base.candidate, reviewStatus: "PUBLISH" }} media={{ ...base.media, rightsAttested: false }} claims={[{ ...base.claims[0], evidence: [] }]} />);
    expect(screen.getByRole("button", { name: "공개" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "제한 공개" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/승인된 근거가 없는 주장/)).toBeTruthy();
    expect(screen.getByText(/권리 근거가 확인되지 않아/)).toBeTruthy();
  });

  it("requires and saves source role and rights basis before rights approval", async () => {
    actions.setSourceRights.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<MpeReviewConsole {...base} candidate={{ ...base.candidate, reviewStatus: "RIGHTS_CHECKING" }} media={{ ...base.media, sourceRole: null, rightsBasis: null }} />);
    expect(screen.getByRole("button", { name: "권리 검수 승인" }).hasAttribute("disabled")).toBe(true);
    await user.selectOptions(screen.getByRole("combobox", { name: "출처 역할" }), "original");
    await user.selectOptions(screen.getByRole("combobox", { name: "권리 근거" }), "creator_permission");
    await user.click(screen.getByRole("button", { name: "출처·권리 저장" }));
    await waitFor(() => expect(actions.setSourceRights).toHaveBeenCalledWith({ ingestionId: "ingestion-1", sourceRole: "original", rightsBasis: "creator_permission" }));
    expect(screen.getByRole("button", { name: "권리 검수 승인" }).hasAttribute("disabled")).toBe(true);
    expect(actions.refresh).toHaveBeenCalledOnce();
  });

  it("sends stage decisions, revision drafts, and reprocessing through server actions", async () => {
    actions.review.mockResolvedValue({ ok: true });
    actions.saveRevision.mockResolvedValue({ ok: true });
    actions.reprocess.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<MpeReviewConsole {...base} />);

    await user.click(screen.getByRole("button", { name: "사실 검수 승인" }));
    await waitFor(() => expect(actions.review).toHaveBeenCalledWith({ candidateId: "candidate-1", stage: "FACT_CHECKING", decision: "APPROVED", reason: undefined }));

    fireEvent.change(screen.getByRole("textbox", { name: "편집 초안 JSON" }), { target: { value: '{"title":"수정"}' } });
    await user.click(screen.getByRole("button", { name: "수정 이력 저장" }));
    await waitFor(() => expect(actions.saveRevision).toHaveBeenCalledWith({ candidateId: "candidate-1", draft: { title: "수정" } }));

    await user.click(screen.getByRole("button", { name: "재처리" }));
    await waitFor(() => expect(actions.reprocess).toHaveBeenCalledWith({ jobId: "job-1" }));
    expect((await screen.findByRole("status")).textContent).toContain("근거 승인과 검수 단계를 초기화");
  });

  it("shows action and invalid draft errors", async () => {
    const user = userEvent.setup();
    actions.review.mockResolvedValue({ ok: false, error: "현재 단계와 요청 단계가 달라요." });
    render(<MpeReviewConsole {...base} />);
    await user.click(screen.getByRole("button", { name: "사실 검수 승인" }));
    expect((await screen.findByRole("alert")).textContent).toContain("현재 단계와 요청 단계가 달라요.");

    fireEvent.change(screen.getByRole("textbox", { name: "편집 초안 JSON" }), { target: { value: "{" } });
    await user.click(screen.getByRole("button", { name: "수정 이력 저장" }));
    expect((await screen.findByRole("alert")).textContent).toContain("초안 JSON 형식을 확인해 주세요.");
  });
});
