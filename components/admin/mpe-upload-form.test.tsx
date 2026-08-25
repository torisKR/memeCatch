// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

import { MpeUploadForm } from "./mpe-upload-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("MpeUploadForm", () => {
  it("requires a file and rights confirmation before upload", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MpeUploadForm />);
    await user.click(screen.getByRole("button", { name: "분석 작업 접수" }));
    expect((await screen.findByRole("alert")).textContent).toContain("파일을 선택");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the file and rights declaration, then shows ingestion and job IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { ingestionId: "ingestion-1", jobIds: ["job-1", "job-2"], status: "queued" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MpeUploadForm />);
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("file input missing");
    fireEvent.change(input, { target: { files: [new File(["meme"], "meme.png", { type: "image/png" })] } });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "분석 작업 접수" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/mpe/uploads");
    expect(init.method).toBe("POST");
    expect(init.body.get("rightsDeclaration")).toBe(JSON.stringify({ accepted: true }));
    expect((await screen.findByRole("status")).textContent).toContain("ingestion: ingestion-1");
    expect(screen.getByRole("status").textContent).toContain("jobs: job-1, job-2");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the API error without refreshing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: "mime_mismatch" }) }));
    const user = userEvent.setup();
    render(<MpeUploadForm />);
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("file input missing");
    fireEvent.change(input, { target: { files: [new File(["bad"], "meme.jpg", { type: "image/jpeg" })] } });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "분석 작업 접수" }));
    expect((await screen.findByRole("alert")).textContent).toContain("파일 내용과 확장자 형식");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("creates the candidate after processing and opens its review console", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { ingestionId: "ingestion-1", jobIds: ["job-1"], status: "queued" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { candidate: { id: "candidate-1" } } }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MpeUploadForm />);
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("file input missing");
    fireEvent.change(input, { target: { files: [new File(["meme"], "meme.png", { type: "image/png" })] } });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "분석 작업 접수" }));
    await user.type(await screen.findByRole("textbox", { name: "후보 제목" }), "찹츄 밈");
    await user.selectOptions(screen.getByRole("combobox", { name: "밈 유형" }), "SOUND");
    await user.click(screen.getByRole("button", { name: "분석 완료 후 후보 생성" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/mpe-candidates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", ingestionId: "ingestion-1", title: "찹츄 밈", memeType: "SOUND" }),
    });
    expect(push).toHaveBeenCalledWith("/admin/mpe/candidate-1");
  });

  it("keeps the upload result and explains when processing is unfinished", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, data: { ingestionId: "ingestion-1", jobIds: ["job-1"], status: "queued" } }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, error: "processing_jobs_not_terminal" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MpeUploadForm />);
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("file input missing");
    fireEvent.change(input, { target: { files: [new File(["meme"], "meme.png", { type: "image/png" })] } });
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "분석 작업 접수" }));
    await user.type(await screen.findByRole("textbox", { name: "후보 제목" }), "대기 후보");
    await user.click(screen.getByRole("button", { name: "분석 완료 후 후보 생성" }));
    expect((await screen.findByRole("alert")).textContent).toContain("아직 끝나지 않았어요");
    expect(screen.getByText("ingestion: ingestion-1")).toBeTruthy();
  });
});
