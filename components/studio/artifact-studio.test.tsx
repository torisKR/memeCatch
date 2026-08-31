// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArtifactStudio } from "@/components/studio/artifact-studio";
import { MemeStudioApp } from "@/components/studio/meme-studio-app";

const canvasContext = {
  drawImage: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillRect: vi.fn(),
  measureText: vi.fn((text: string) => ({ width: text.length * 24 })),
  strokeText: vi.fn(),
  fillText: vi.fn(),
  fillStyle: "",
  strokeStyle: "",
  font: "80px Arial",
  lineWidth: 0,
  lineJoin: "round",
  textAlign: "center",
  textBaseline: "top",
};

beforeEach(() => {
  const NativeUrl = URL;
  vi.stubGlobal("URL", class extends NativeUrl {
    static createObjectURL = vi.fn(() => "blob:studio-file");
    static revokeObjectURL = vi.fn();
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("Image", class {
    onload: (() => void) | null = null;
    naturalWidth = 1080;
    naturalHeight = 1080;
    set src(_value: string) { this.onload?.(); }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ArtifactStudio", () => {
  it("shows only the selected workspace and exposes exact Ox Alpha readiness", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<MemeStudioApp aiEnabled />);
    const ideasButton = screen.getByRole("button", { name: /아이디어 생성/ });
    const artifactsButton = screen.getByRole("button", { name: /내 콘텐츠 출력/ });
    const ideasWorkspace = container.querySelector("#studio-workspace-ideas");
    const artifactsWorkspace = container.querySelector("#studio-workspace-artifacts");

    expect(ideasButton.getAttribute("aria-pressed")).toBe("true");
    expect(artifactsButton.getAttribute("aria-pressed")).toBe("false");
    expect(ideasWorkspace?.hasAttribute("hidden")).toBe(false);
    expect(artifactsWorkspace?.hasAttribute("hidden")).toBe(true);
    expect(screen.getByText("Ox Alpha 아이디어 생성이 준비되어 있습니다.")).toBeTruthy();
    expect(container.textContent).not.toContain("OpenAI");
    expect(screen.queryByRole("tab")).toBeNull();

    await user.click(artifactsButton);
    expect(ideasWorkspace?.hasAttribute("hidden")).toBe(true);
    expect(artifactsWorkspace?.hasAttribute("hidden")).toBe(false);
    expect(screen.getByRole("heading", { name: "내 콘텐츠 출력" })).toBeTruthy();

    rerender(<MemeStudioApp aiEnabled={false} />);
    await user.click(ideasButton);
    expect(screen.getByText("기본 템플릿으로 아이디어를 만듭니다.")).toBeTruthy();
  });

  it("keeps API and network failures in Korean", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "Couldn't generate ideas" }),
    }));
    const user = userEvent.setup();
    render(<MemeStudioApp aiEnabled={false} />);

    await user.type(screen.getByLabelText("어떤 내용인가요?"), "고양이 밈");
    await user.click(screen.getByRole("button", { name: "밈 아이디어 만들기" }));

    expect((await screen.findByRole("alert")).textContent).toContain("아이디어를 만들지 못했습니다.");
    expect(screen.queryByText(/Couldn't/)).toBeNull();
  });

  it("does not submit the idea while Enter confirms IME composition", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<MemeStudioApp aiEnabled={false} />);
    const topic = screen.getByLabelText("어떤 내용인가요?");

    fireEvent.change(topic, { target: { value: "고양이 밈" } });
    fireEvent.keyDown(topic, { key: "Enter", isComposing: true, keyCode: 229 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires rights confirmation before image render and calls Canvas after confirmation", async () => {
    const user = userEvent.setup();
    render(<ArtifactStudio />);
    const file = new File(["image"], "mine.png", { type: "image/png" });
    const imageInput = screen.getByLabelText("내 이미지 업로드");
    expect(imageInput.className).toContain("text-base");
    expect(imageInput.className).toContain("sm:text-sm");
    fireEvent.change(imageInput, { target: { files: [file] } });

    const renderButton = screen.getByRole("button", { name: "미리보기 렌더" });
    expect((renderButton as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "PNG 내려받기" }) as HTMLButtonElement).disabled).toBe(true);

    await user.selectOptions(screen.getByRole("combobox", { name: "출력 크기" }), "vertical");
    await user.click(screen.getByRole("checkbox"));
    expect((renderButton as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByRole("textbox", { name: "이미지 출처 표기" }), "직접 제작");
    await waitFor(() => expect((renderButton as HTMLButtonElement).disabled).toBe(false));
    await user.click(renderButton);

    expect(canvasContext.drawImage).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("밈 이미지 결과")).toMatchObject({ width: 1080, height: 1920 });
    expect(canvasContext.fillText).toHaveBeenCalledWith(expect.stringContaining("밈캐치"), expect.any(Number), expect.any(Number));
    expect(canvasContext.fillText).toHaveBeenCalledWith(expect.stringContaining("직접 제작"), expect.any(Number), expect.any(Number));
    expect((screen.getByRole("button", { name: "PNG 내려받기" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("requires explicit dictionary attribution and renders it with the watermark", async () => {
    const user = userEvent.setup();
    render(<ArtifactStudio />);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "사전 카드" }));
    await user.type(screen.getByRole("textbox", { name: "밈 이름" }), "테스트 밈");
    await user.type(screen.getByRole("textbox", { name: "한 줄 정의" }), "직접 만든 사전 카드");

    const renderButton = screen.getByRole("button", { name: "사전 카드 렌더" });
    expect((renderButton as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByRole("textbox", { name: "사전 카드 출처 표기" }), "직접 제작");
    expect((screen.getByRole("textbox", { name: "상세 URL" }) as HTMLInputElement).value).toBe("");
    await user.type(screen.getByRole("textbox", { name: "상세 URL" }), "http://catchmeme.com/memes/test");
    expect((renderButton as HTMLButtonElement).disabled).toBe(true);
    await user.clear(screen.getByRole("textbox", { name: "상세 URL" }));
    await user.type(screen.getByRole("textbox", { name: "상세 URL" }), "https://catchmeme.com/memes/test");
    expect((renderButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(renderButton);

    expect(canvasContext.fillText).toHaveBeenCalledWith("밈 사전", expect.any(Number), expect.any(Number));
    expect(canvasContext.fillText).toHaveBeenCalledWith("출처: 직접 제작", expect.any(Number), expect.any(Number));
    expect(canvasContext.fillText).toHaveBeenCalledWith("밈캐치", expect.any(Number), expect.any(Number));
    expect((screen.getByRole("button", { name: "PNG 내려받기" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows a prefilled dictionary workspace without image mode", () => {
    const { rerender } = render(<ArtifactStudio dictionaryOnly dictionaryDefaults={{
      name: "자체 제작 밈",
      summary: "SNS 원본 없이 만든 밈",
      safety: "친한 사이에서만 권장",
      detailUrl: "https://catchmeme.com/memes/original",
      source: "밈캐치 자체 제작",
    }} />);

    expect(screen.queryByRole("button", { name: "이미지 밈" })).toBeNull();
    expect(screen.queryByRole("button", { name: "사전 카드" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "밈 이름" }) as HTMLInputElement).value).toBe("자체 제작 밈");
    expect((screen.getByRole("textbox", { name: "한 줄 정의" }) as HTMLTextAreaElement).value).toBe("SNS 원본 없이 만든 밈");
    expect((screen.getByRole("textbox", { name: "사용 안전 신호" }) as HTMLInputElement).value).toBe("친한 사이에서만 권장");
    expect((screen.getByRole("textbox", { name: "상세 URL" }) as HTMLInputElement).value).toBe("https://catchmeme.com/memes/original");
    expect((screen.getByRole("textbox", { name: "사전 카드 출처 표기" }) as HTMLInputElement).value).toBe("밈캐치 자체 제작");

    rerender(<ArtifactStudio dictionaryOnly dictionaryDefaults={{
      name: "수정된 자체 제작 밈",
      summary: "수정된 한 줄 정의",
      safety: "써도 됨",
      detailUrl: "https://catchmeme.com/memes/updated",
      source: "밈캐치 자체 제작",
    }} />);
    expect((screen.getByRole("textbox", { name: "밈 이름" }) as HTMLInputElement).value).toBe("수정된 자체 제작 밈");
    expect((screen.getByRole("textbox", { name: "한 줄 정의" }) as HTMLTextAreaElement).value).toBe("수정된 한 줄 정의");
  });

  it("exposes only browser-rendered image outputs", () => {
    render(<ArtifactStudio />);

    expect(screen.getByText(/파일은 서버에 업로드되지 않습니다/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "이미지 밈" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "사전 카드" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "자막 영상" })).toBeNull();
    expect(screen.queryByText(/MP4|MPE/)).toBeNull();
  });
});
