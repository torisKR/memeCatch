// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  register: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/actions/admin-catalog", () => ({
  checkCatalogMemeDuplicates: (...args: unknown[]) => mocks.check(...args),
  registerCatalogMeme: (...args: unknown[]) => mocks.register(...args),
}));

import { CatalogRegistrationForm } from "./catalog-registration-form";

function fillRequired() {
  fireEvent.change(screen.getByLabelText("제목"), { target: { value: "정식 카탈로그 밈" } });
  fireEvent.change(screen.getByLabelText("한 줄 요약"), { target: { value: "요약" } });
  fireEvent.change(screen.getByLabelText("설명"), { target: { value: "설명" } });
  fireEvent.change(screen.getByLabelText("기원·확산 설명"), { target: { value: "확인 전 유래" } });
  fireEvent.change(screen.getByLabelText("태그 (쉼표로 구분)"), { target: { value: "반응, 이미지" } });
  fireEvent.change(screen.getByLabelText("원문 출처 URL"), { target: { value: "https://archive.org/details/original" } });
  fireEvent.change(screen.getByLabelText("검증 출처 URL"), { target: { value: "https://www.bbc.com/culture/reference" } });
}

beforeEach(() => {
  vi.stubGlobal("crypto", { randomUUID: () => "10000000-0000-4000-8000-000000000001" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CatalogRegistrationForm", () => {
  it("blocks registration and links the existing meme when duplicate evidence is found", async () => {
    mocks.check.mockResolvedValue({
      ok: true,
      data: { matches: [{ reason: "source", memeId: "m1", title: "기존 밈", shortId: "abcd1234", slug: "existing" }] },
    });
    render(<CatalogRegistrationForm />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "중복 검사" }));

    const existing = await screen.findByRole("link", { name: "기존 밈" });
    expect(existing.getAttribute("href")).toBe("/admin/memes/m1");
    expect(mocks.register).not.toHaveBeenCalled();
    expect((await screen.findByRole("button", { name: "대기 상태로 등록" })).hasAttribute("disabled")).toBe(true);
  });

  it("creates only a pending intake after a clean duplicate check", async () => {
    mocks.check.mockResolvedValue({ ok: true, data: { matches: [] } });
    mocks.register.mockResolvedValue({
      ok: true,
      data: { status: "created", memeId: "m2", shortId: "efgh5678", slug: "catalog" },
    });
    render(<CatalogRegistrationForm />);
    fillRequired();
    fireEvent.submit(screen.getByRole("button", { name: "대기 상태로 등록" }).closest("form")!);

    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({
      registrationKey: "10000000-0000-4000-8000-000000000001",
      title: "정식 카탈로그 밈",
      sources: expect.arrayContaining([
        expect.objectContaining({ sourceRole: "earliest_known" }),
        expect.objectContaining({ sourceRole: "secondary_reference" }),
      ]),
    }));
    expect(mocks.push).toHaveBeenCalledWith("/admin/memes/m2");
  });

  it("cancels without calling a mutation", () => {
    render(<CatalogRegistrationForm />);
    const cancel = screen.getByRole("link", { name: "취소" });
    expect(cancel.getAttribute("href")).toBe("/admin/memes");
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("reuses the same request key after a save failure so retry cannot double-create", async () => {
    mocks.check.mockResolvedValue({ ok: true, data: { matches: [] } });
    mocks.register
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "save_failed", message: "저장 실패", retryable: true },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { status: "duplicate_request", memeId: "m2", shortId: "efgh5678", slug: "catalog" },
      });
    render(<CatalogRegistrationForm />);
    fillRequired();
    const form = screen.getByRole("button", { name: "대기 상태로 등록" }).closest("form")!;

    fireEvent.submit(form);
    await screen.findByText("저장 실패");
    fireEvent.submit(form);

    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(2));
    expect(mocks.register.mock.calls[0][0].registrationKey).toBe(
      mocks.register.mock.calls[1][0].registrationKey,
    );
    expect(mocks.push).toHaveBeenCalledWith("/admin/memes/m2");
  });
});
