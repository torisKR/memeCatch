// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoProductionWorkspace } from "@/lib/video-production/workspace-types";

const actions = vi.hoisted(() => ({
  perform: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/actions/admin-video-productions", () => ({ performVideoProductionCommand: actions.perform }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a> }));

import { VideoProductionConsole } from "./video-production-console";

const hash = "a".repeat(64);

function workspace(overrides: Partial<VideoProductionWorkspace> = {}): VideoProductionWorkspace {
  return {
    state: "ready",
    oauth_configured: true,
    draft_provider_configured: true,
    setup_notes: [],
    expected_channel_id: "UCBxN8lUb-5dDuOPv-szpF4g",
    candidates: [{
      id: "meme-1",
      title: "새삥",
      summary: "새것이나 새로운 사람을 가리키는 표현",
      description: "검수된 설명입니다.",
      origin: "검수된 유래입니다.",
      usage_note: null,
      caution: "사람을 대상화하지 않도록 맥락을 확인합니다.",
      usage_examples: [],
      sources: [{ id: "source-1", title: "공식 출처", url: "https://example.com/source", approved: true }],
      claims: [{ id: "claim-1", type: "meaning", text: "새것을 뜻합니다.", source_id: "source-1" }],
    }],
    productions: [{
      id: "production-1",
      meme_id: "meme-1",
      version: 3,
      status: "review_pending",
      title: "새삥 해설",
      script: {
        title: "새삥을 언제 쓸까",
        description: "새삥이라는 표현의 뜻과 사용 맥락을 설명하는 자체 제작 영상입니다.",
        narration: "첫 장면 설명 둘째 장면 설명 셋째 장면 설명 넷째 장면 설명 다섯째 장면 설명",
        original_observation: "새것뿐 아니라 새로 합류한 사람을 장난스럽게 가리킬 때도 사용됩니다.",
        scenes: [
          { id: "s1", kind: "hook", heading: "새삥?", caption: "무슨 뜻일까", narration: "첫 장면 설명", start_ms: 0, end_ms: 6000, source_ids: [] },
          { id: "s2", kind: "meaning", heading: "뜻", caption: "새것", narration: "둘째 장면 설명", start_ms: 6000, end_ms: 12000, source_ids: ["source-1"] },
          { id: "s3", kind: "example", heading: "자체 작성 가상 예시", caption: "가상 대화", narration: "셋째 장면 설명", start_ms: 12000, end_ms: 18000, source_ids: [] },
          { id: "s4", kind: "context", heading: "맥락", caption: "맥락 확인", narration: "넷째 장면 설명", start_ms: 18000, end_ms: 24000, source_ids: ["source-1"] },
          { id: "s5", kind: "caution", heading: "주의", caption: "상대 확인", narration: "다섯째 장면 설명", start_ms: 24000, end_ms: 30000, source_ids: [] },
        ],
        source_ids: ["source-1"],
        uncertain_claims: [{ text: "최초 사용 시점", reason: "현재 근거만으로 단정할 수 없습니다." }],
        asset_requirements: [
          { kind: "graphic", description: "자체 그래픽" },
          { kind: "voice", description: "자체 음성" },
          { kind: "font", description: "허용 폰트" },
        ],
        contains_synthetic_media: false,
      },
      assets: [
        { id: "graphic-1", kind: "graphic", source_url: null, owner: "밈캐치", acquisition_method: "self_created", allow_edit: false, allow_youtube: false, allow_commercial: false, attribution: null, valid_until: null, territories: ["worldwide"], evidence: "자체 제작 파일", reviewed_by: "", reviewed_at: "" },
        { id: "voice-1", kind: "voice", source_url: null, owner: "밈캐치", acquisition_method: "self_created", allow_edit: false, allow_youtube: false, allow_commercial: false, attribution: null, valid_until: null, territories: ["worldwide"], evidence: "자체 제작 음성", reviewed_by: "", reviewed_at: "" },
        { id: "font-1", kind: "font", source_url: "https://example.com/license", owner: "폰트 권리자", acquisition_method: "licensed", allow_edit: false, allow_youtube: false, allow_commercial: false, attribution: "폰트 출처", valid_until: null, territories: ["worldwide"], evidence: "라이선스 문서", reviewed_by: "", reviewed_at: "" },
      ],
      source_snapshot: {
        id: "meme-1", title: "새삥", summary: "요약", description: "설명", origin: "유래", usage_note: null, caution: null, usage_examples: [],
        sources: [{ id: "source-1", title: "공식 출처", url: "https://example.com/source", approved: true }], claims: [],
      },
      artifact_hash: hash,
      approved_artifact_hash: null,
      technical_check: { duration_ms: 30000, width: 1080, height: 1920, has_audio: true, decodable: true, captions_safe: true },
      last_error_code: null,
      preview_url: "https://cdn.example.com/preview.mp4",
      poster_url: "https://cdn.example.com/poster.webp",
      created_at: "2026-10-12T12:00:00Z",
      blocked_at: null,
      block_reason: null,
    }],
    channels: [{ id: "channel-connection-1", channel_id: "UCBxN8lUb-5dDuOPv-szpF4g", title: "밈캐치", connection_status: "connected", oauth_status: "verified", api_publication_status: "verified" }],
    publications: [{
      id: "publication-1", production_id: "production-1", channel_connection_id: "channel-connection-1", artifact_hash: hash,
      status: "uploaded_private", youtube_video_id: "AbCdEf12345", processing_status: "processing", privacy_status: "private",
      embeddable: null, approved_visibility: null, studio_reviewed_at: null, site_linked_at: null, last_error_code: null,
    }],
    ...overrides,
  };
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  actions.perform.mockResolvedValue({ ok: true });
});

describe("VideoProductionConsole", () => {
  it("shows missing configuration honestly and disables unavailable setup actions", () => {
    render(<VideoProductionConsole workspace={workspace({ state: "setup_required", oauth_configured: false, draft_provider_configured: false, setup_notes: ["OPENROUTER_API_KEY 필요", "YouTube OAuth 필요"] })} />);

    expect(screen.getByRole("heading", { name: "운영 설정이 필요합니다" })).toBeTruthy();
    expect(screen.getByText("OPENROUTER_API_KEY 필요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "AI 초안 생성" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "빈 수동 초안 만들기" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "OAuth로 채널 연결" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText(/연결 완료|설정 완료/)).toBeNull();
  });

  it("locks OAuth and upload selection to the configured MemeCatch channel", () => {
    const value = workspace({
      channels: [{ id: "wrong-channel", channel_id: "UC_NOT_THE_TARGET", title: "다른 채널", connection_status: "connected", oauth_status: "unknown", api_publication_status: "verified" }],
    });
    render(<VideoProductionConsole workspace={value} />);

    const expected = screen.getByRole("textbox", { name: "연결할 채널 ID" }) as HTMLInputElement;
    expect(expected.value).toBe("UCBxN8lUb-5dDuOPv-szpF4g");
    expect(expected.readOnly).toBe(true);
    expect(screen.getByRole("link", { name: "밈캐치 운영 채널" }).getAttribute("href")).toContain("UCBxN8lUb-5dDuOPv-szpF4g");
    expect(screen.queryByRole("option", { name: /다른 채널/ })).toBeNull();
    expect(screen.getByText("업로드 가능한 OAuth 채널 연결이 없습니다.")).toBeTruthy();
  });

  it.each(["unknown", "testing", "production", "verification_required", "verified"])("allows a connected target channel with actual OAuth status %s while warning where needed", (oauthStatus) => {
    const value = workspace();
    value.channels[0] = { ...value.channels[0], oauth_status: oauthStatus };
    render(<VideoProductionConsole workspace={value} />);

    expect(screen.getByRole("option", { name: new RegExp(`OAuth ${oauthStatus}`) })).toBeTruthy();
    if (["unknown", "testing", "verification_required"].includes(oauthStatus)) expect(screen.getByText(new RegExp(`OAuth 앱 상태가 ${oauthStatus}`))).toBeTruthy();
    else expect(screen.queryByText(/OAuth 앱 상태가/)).toBeNull();
  });

  it.each(["disconnected", "reauth_required"])("blocks a target channel whose connection is %s", (connectionStatus) => {
    const value = workspace();
    value.channels[0] = { ...value.channels[0], connection_status: connectionStatus, oauth_status: "verified" };
    render(<VideoProductionConsole workspace={value} />);

    expect(screen.queryByRole("option", { name: /밈캐치 ·/ })).toBeNull();
    expect(screen.getByText("업로드 가능한 OAuth 채널 연결이 없습니다.")).toBeTruthy();
  });

  it("keeps a blank five-scene 35-second manual draft local until the operator writes and saves it", async () => {
    render(<VideoProductionConsole workspace={workspace({ draft_provider_configured: false })} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "빈 수동 초안 만들기" }));

    expect(actions.perform).not.toHaveBeenCalled();
    const composer = screen.getByRole("heading", { name: /저장 전 수동 초안/ }).closest("section")!;
    expect(within(composer).getAllByText(/수동 장면/)).toHaveLength(5);
    expect(within(composer).getByText(/아직 DB에 저장되지 않았습니다/)).toBeTruthy();
    fireEvent.change(within(composer).getByRole("textbox", { name: "영상 제목" }), { target: { value: "운영자가 직접 쓴 새삥 해설" } });
    fireEvent.change(within(composer).getByRole("textbox", { name: "영상 설명" }), { target: { value: "검수된 근거를 바탕으로 운영자가 직접 작성한 새삥 표현 해설 영상입니다." } });
    fireEvent.change(within(composer).getByRole("textbox", { name: "독자적 관찰" }), { target: { value: "새 물건뿐 아니라 새로 합류한 사람에게도 장난스럽게 쓰이는 맥락을 설명합니다." } });
    const headings = within(composer).getAllByRole("textbox", { name: "장면 제목" });
    const captions = within(composer).getAllByRole("textbox", { name: "화면 자막" });
    const narrations = within(composer).getAllByRole("textbox", { name: "내레이션" });
    headings.forEach((field, index) => fireEvent.change(field, { target: { value: index === 2 ? "자체 작성 가상 예시" : `장면 ${index + 1}` } }));
    captions.forEach((field, index) => fireEvent.change(field, { target: { value: `검수 화면 자막 ${index + 1}` } }));
    narrations.forEach((field, index) => fireEvent.change(field, { target: { value: `운영자가 작성한 장면 내레이션 문장 ${index + 1}입니다.` } }));
    await user.click(within(composer).getByRole("button", { name: "수동 초안 저장" }));

    await waitFor(() => expect(actions.perform).toHaveBeenCalled());
    const command = actions.perform.mock.calls[0][0];
    expect(command.kind).toBe("create");
    expect(command.memeId).toBe("meme-1");
    expect(command.script.scenes).toHaveLength(5);
    expect(command.script.scenes.at(-1).end_ms).toBe(35000);
    expect(command.script.title).toBe("운영자가 직접 쓴 새삥 해설");
    expect(command.script.narration).toContain("운영자가 작성한 장면 내레이션 문장 1입니다.");
    expect(command.assets).toEqual([]);
  });

  it("imports a local OpenCodex script only into the unsaved composer without actions or asset permissions", async () => {
    const value = workspace();
    render(<VideoProductionConsole workspace={value} />);
    const input = screen.getByLabelText("로컬 대본 가져오기") as HTMLInputElement;
    const file = { text: async () => JSON.stringify({ script: value.productions[0].script, assets: [{ allow_youtube: true }] }) };
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/로컬 대본을 저장 전 편집기에 열었습니다/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /저장 전 수동 초안/ })).toBeTruthy();
    expect(actions.perform).not.toHaveBeenCalled();
    const composer = screen.getByRole("heading", { name: /저장 전 수동 초안/ }).closest("section")!;
    expect(within(composer).queryByText(/allow_youtube/)).toBeNull();
    expect(within(composer).getByText(/최초 사용 시점/)).toBeTruthy();
  });

  it("shows a keyboard focus indicator on the local JSON import control", () => {
    render(<VideoProductionConsole workspace={workspace()} />);
    const input = screen.getByLabelText("로컬 대본 가져오기");
    expect(input.parentElement?.className).toContain("focus-within:ring-2");
    expect(input.parentElement?.className).toContain("focus-within:ring-accent");
  });

  it("rejects a local script bound to an unknown source ID before opening the composer", async () => {
    const value = workspace();
    const script = structuredClone(value.productions[0].script);
    script.source_ids = ["source:not-selected"];
    render(<VideoProductionConsole workspace={value} />);
    const input = screen.getByLabelText("로컬 대본 가져오기") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [{ text: async () => JSON.stringify({ script }) }] } });

    expect((await screen.findByRole("alert")).textContent).toContain("선택한 밈에 없는 출처 ID");
    expect(screen.queryByRole("heading", { name: /저장 전 수동 초안/ })).toBeNull();
    expect(actions.perform).not.toHaveBeenCalled();
  });

  it("downloads only the reviewed candidate snapshot for the local CLI", async () => {
    const createObjectUrl = vi.fn((blob: Blob) => {
      void blob;
      return "blob:fixture";
    });
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
    let downloadName = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function captureDownload(this: HTMLAnchorElement) { downloadName = this.download; });
    const user = userEvent.setup();
    render(<VideoProductionConsole workspace={workspace()} />);

    await user.click(screen.getByRole("button", { name: "로컬 대본용 근거 내려받기" }));
    expect(createObjectUrl).toHaveBeenCalledOnce();
    const blob = createObjectUrl.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    const content = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    const dto = JSON.parse(content);
    expect(Object.keys(dto).sort()).toEqual(["caution", "claims", "description", "id", "origin", "sources", "summary", "title", "usage_examples", "usage_note"].sort());
    expect(dto.sources).toEqual([{ id: "source-1", title: "공식 출처", url: "https://example.com/source", approved: true }]);
    expect(click).toHaveBeenCalledOnce();
    expect(downloadName).toBe("candidate.json");
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:fixture");
    click.mockRestore();
  });

  it("renders generated rights assets without silently granting any permission", () => {
    render(<VideoProductionConsole workspace={workspace()} />);

    expect(screen.getByRole("heading", { name: "자산 권리 원장" })).toBeTruthy();
    expect(screen.getByText(/직접 체크하기 전에는 사용할 수 없습니다/)).toBeTruthy();
    expect(screen.getAllByRole("checkbox", { name: "편집 허용" }).every((input) => !(input as HTMLInputElement).checked)).toBe(true);
    expect(screen.getAllByRole("checkbox", { name: "YouTube 업로드 허용" }).every((input) => !(input as HTMLInputElement).checked)).toBe(true);
    expect(screen.getAllByRole("checkbox", { name: "상업 이용 허용" }).every((input) => !(input as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText("최초 사용 시점")).toBeTruthy();
    expect(screen.getByText(/단정할 수 없습니다/)).toBeTruthy();
  });

  it("requires an approved current hash, a selected channel, explicit audience, and consent before private upload", async () => {
    const { rerender } = render(<VideoProductionConsole workspace={workspace()} />);
    expect(screen.getByRole("button", { name: "승인 해시 비공개 업로드" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/현재 산출물 해시가 승인되지 않아/)).toBeTruthy();

    const approvedWorkspace = workspace({ publications: [] });
    approvedWorkspace.productions[0].approved_artifact_hash = hash;
    rerender(<VideoProductionConsole workspace={approvedWorkspace} />);
    const user = userEvent.setup();
    const uploadButton = screen.getByRole("button", { name: "승인 해시 비공개 업로드" });
    expect(uploadButton.hasAttribute("disabled")).toBe(true);
    await user.selectOptions(screen.getByRole("combobox", { name: "비공개 업로드 대상 채널" }), "channel-connection-1");
    await user.selectOptions(screen.getByRole("combobox", { name: "아동용 콘텐츠 여부" }), "no");
    await user.click(screen.getByRole("checkbox", { name: /결과가 불명확하면 새 영상을 만들지 않고/ }));
    expect(uploadButton.hasAttribute("disabled")).toBe(false);
    await user.click(uploadButton);
    await waitFor(() => expect(actions.perform).toHaveBeenCalledWith({ kind: "upload", id: "production-1", artifactHash: hash, channelConnectionId: "channel-connection-1", consent: true, madeForKids: false }));
  });

  it.each(["queued", "site_linked"])("blocks a repeated upload when the current hash already has a %s publication", async (status) => {
    const value = workspace();
    value.productions[0].approved_artifact_hash = hash;
    value.publications[0] = { ...value.publications[0], status };
    render(<VideoProductionConsole workspace={value} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "비공개 업로드 대상 채널" }), "channel-connection-1");
    await user.selectOptions(screen.getByRole("combobox", { name: "아동용 콘텐츠 여부" }), "no");
    await user.click(screen.getByRole("checkbox", { name: /결과가 불명확하면 새 영상을 만들지 않고/ }));

    expect(screen.getByRole("button", { name: "승인 해시 비공개 업로드" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/이미 발행 원장/).textContent).toContain(status === "queued" ? "업로드 대기" : "사이트 연결 완료");
    expect(screen.getByText(/기존 세션 재시도 또는 소유권 조정/)).toBeTruthy();
  });

  it("keeps public transition unavailable until ready_for_review, current hash approval, Studio review, visibility, and consent", async () => {
    const initial = workspace();
    initial.productions[0].approved_artifact_hash = hash;
    const { rerender } = render(<VideoProductionConsole workspace={initial} />);
    expect(screen.getByRole("button", { name: "Studio 검수 완료 후 공개 전환" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/ready_for_review/)).toBeTruthy();

    const ready = workspace();
    ready.productions[0].approved_artifact_hash = hash;
    ready.publications[0] = { ...ready.publications[0], status: "ready_for_review", processing_status: "succeeded", embeddable: true };
    rerender(<VideoProductionConsole workspace={ready} />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", { name: "최종 공개 방식" }), "unlisted");
    await user.click(screen.getByRole("checkbox", { name: /Studio에서 저작권·정책 제한/ }));
    await user.click(screen.getByRole("checkbox", { name: /현재 업로드 해시를 선택한 공개 상태/ }));
    const publish = screen.getByRole("button", { name: "Studio 검수 완료 후 공개 전환" });
    expect(publish.hasAttribute("disabled")).toBe(false);
    await user.click(publish);
    await waitFor(() => expect(actions.perform).toHaveBeenCalledWith({ kind: "publish", publicationId: "publication-1", artifactHash: hash, visibility: "unlisted", studioReviewed: true, consent: true }));
  });

  it("derives aggregate narration from edited scenes and saves with the current expected version", async () => {
    render(<VideoProductionConsole workspace={workspace()} />);
    const user = userEvent.setup();
    const fieldset = screen.getByText("장면 1 · hook · 0–6000ms").closest("fieldset");
    expect(fieldset).toBeTruthy();
    fireEvent.change(within(fieldset!).getByRole("textbox", { name: "내레이션" }), { target: { value: "수정한 첫 장면 설명" } });
    expect(screen.getByText(/수정한 첫 장면 설명 둘째 장면 설명/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "대본·권리 저장" }));

    await waitFor(() => expect(actions.perform).toHaveBeenCalled());
    const command = actions.perform.mock.calls[0][0];
    expect(command.kind).toBe("revise");
    expect(command.expectedVersion).toBe(3);
    expect(command.script.narration).toBe("수정한 첫 장면 설명 둘째 장면 설명 셋째 장면 설명 넷째 장면 설명 다섯째 장면 설명");
    expect(actions.refresh).toHaveBeenCalledOnce();
  });

  it("exposes retry, ownership reconciliation, and site-first deletion tracking without a remote delete button", async () => {
    render(<VideoProductionConsole workspace={workspace()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "기존 세션 재시도" }));
    await waitFor(() => expect(actions.perform).toHaveBeenCalledWith({ kind: "retry", publicationId: "publication-1" }));
    expect(screen.getByRole("button", { name: "소유권 확인 후 조정" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "사이트 비노출·삭제 요청 기록" })).toBeTruthy();
    expect(screen.getByText("조정할 YouTube 영상 ID")).toBeTruthy();
    expect(screen.getByText("차단 또는 삭제 요청 사유")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /YouTube.*삭제|원격.*삭제/ })).toBeNull();
  });
});
