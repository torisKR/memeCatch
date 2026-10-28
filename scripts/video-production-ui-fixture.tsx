import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { VideoProductionConsole } from "../components/admin/video-production-console";
import type { VideoProductionWorkspace } from "../lib/video-production/workspace-types";
import "../app/globals.css";

const TARGET_CHANNEL_ID = "UCBxN8lUb-5dDuOPv-szpF4g";
const ARTIFACT_HASH = "a".repeat(64);

type FixtureMode = "ready" | "review" | "setup" | "upload";

function fixtureWorkspace(mode: FixtureMode): VideoProductionWorkspace {
  const candidate = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "새삥",
    summary: "새것 또는 새로 합류한 사람을 장난스럽게 가리키는 표현",
    description: "검수된 뜻과 실제 사용 맥락을 바탕으로 해설 영상을 준비합니다.",
    origin: "공개 상세에 연결된 승인 출처를 기준으로 유래 표현을 검수합니다.",
    usage_note: "친한 관계의 가벼운 대화에서 맥락을 확인하고 사용합니다.",
    caution: "사람을 대상화하거나 낮춰 부르는 상황이 되지 않도록 주의합니다.",
    usage_examples: [],
    sources: [{ id: "source:editorial", title: "밈캐치 편집 원칙", url: "https://catchmeme.com/editorial", approved: true as const }],
    claims: [{ id: "claim:meaning", type: "meaning", text: "새것을 가리키는 표현으로 쓰입니다.", source_id: "source:editorial" }],
  };
  if (mode === "setup") {
    return {
      state: "setup_required",
      candidates: [candidate],
      productions: [],
      channels: [],
      publications: [],
      oauth_configured: false,
      draft_provider_configured: false,
      expected_channel_id: TARGET_CHANNEL_ID,
      setup_notes: [
        "로컬 UI 픽스처에는 OAuth 비밀과 외부 API 연결이 없습니다.",
        "실제 DB 마이그레이션·채널 인증·업로드 성공을 증명하지 않습니다.",
      ],
    };
  }

  const approved = mode === "review" || mode === "upload";
  return {
    state: "ready",
    candidates: [candidate],
    oauth_configured: true,
    draft_provider_configured: true,
    expected_channel_id: TARGET_CHANNEL_ID,
    setup_notes: [],
    channels: [{
      id: "22222222-2222-4222-8222-222222222222",
      channel_id: TARGET_CHANNEL_ID,
      title: "밈캐치 운영 채널 (픽스처)",
      connection_status: "connected",
      oauth_status: "testing",
      api_publication_status: "fixture_only",
    }],
    productions: [{
      id: "33333333-3333-4333-8333-333333333333",
      meme_id: candidate.id,
      version: 3,
      status: approved ? "approved" : "review_pending",
      title: "새삥을 언제 쓸까",
      source_snapshot: candidate,
      script: {
        title: "새삥을 언제 쓸까",
        description: "새삥이라는 표현의 뜻과 사용 맥락을 운영자가 검수하는 자체 제작 영상 초안입니다.",
        narration: "새삥이라는 말, 어떤 상황에서 쓸까요? 새것을 가리킬 때 쓰는 표현입니다. 자체 작성한 가상 대화로 사용 맥락을 살펴봅니다. 친한 관계에서는 새로 합류한 사람에게도 장난스럽게 쓰입니다. 상대가 불편하지 않은지 먼저 살피는 것이 중요합니다.",
        original_observation: "같은 단어도 물건과 사람을 가리킬 때 받아들여지는 온도가 달라진다는 점을 직접 설명합니다.",
        source_ids: ["source:editorial"],
        uncertain_claims: [{ text: "최초 사용 시점", reason: "현재 승인 출처만으로는 단정하지 않습니다." }],
        asset_requirements: [
          { kind: "graphic", description: "자체 제작 세로 그래픽" },
          { kind: "voice", description: "직접 제작 내레이션" },
          { kind: "font", description: "상업 이용 허용 폰트" },
        ],
        contains_synthetic_media: false,
        scenes: [
          { id: "hook", kind: "hook", heading: "새삥?", caption: "어떤 상황에서 쓸까", narration: "새삥이라는 말, 어떤 상황에서 쓸까요?", start_ms: 0, end_ms: 7000, source_ids: [] },
          { id: "meaning", kind: "meaning", heading: "기본 뜻", caption: "새것을 가리키는 표현", narration: "새것을 가리킬 때 쓰는 표현입니다.", start_ms: 7000, end_ms: 14000, source_ids: ["source:editorial"] },
          { id: "example", kind: "example", heading: "자체 작성 가상 예시", caption: "가상 대화로 맥락 보기", narration: "자체 작성한 가상 대화로 사용 맥락을 살펴봅니다.", start_ms: 14000, end_ms: 21000, source_ids: [] },
          { id: "context", kind: "context", heading: "사람에게 쓸 때", caption: "관계와 분위기 확인", narration: "친한 관계에서는 새로 합류한 사람에게도 장난스럽게 쓰입니다.", start_ms: 21000, end_ms: 28000, source_ids: ["source:editorial"] },
          { id: "caution", kind: "caution", heading: "사용 주의", caption: "상대의 반응 먼저", narration: "상대가 불편하지 않은지 먼저 살피는 것이 중요합니다.", start_ms: 28000, end_ms: 35000, source_ids: [] },
        ],
      },
      assets: [
        { id: "graphic-1", kind: "graphic", source_url: null, owner: "밈캐치", acquisition_method: "self_created", allow_edit: true, allow_youtube: true, allow_commercial: true, attribution: null, valid_until: null, territories: ["worldwide"], evidence: "픽스처: 자체 제작 그래픽 권리 확인 UI", reviewed_by: "fixture-operator", reviewed_at: "2026-10-12T13:00:00Z" },
        { id: "voice-1", kind: "voice", source_url: null, owner: "밈캐치", acquisition_method: "self_created", allow_edit: true, allow_youtube: true, allow_commercial: true, attribution: null, valid_until: null, territories: ["worldwide"], evidence: "픽스처: 자체 제작 음성 권리 확인 UI", reviewed_by: "fixture-operator", reviewed_at: "2026-10-12T13:00:00Z" },
        { id: "font-1", kind: "font", source_url: "https://example.com/font-license", owner: "예시 폰트 권리자", acquisition_method: "licensed", allow_edit: true, allow_youtube: true, allow_commercial: true, attribution: "예시 폰트", valid_until: null, territories: ["worldwide"], evidence: "픽스처: 라이선스 증빙 입력 UI", reviewed_by: "fixture-operator", reviewed_at: "2026-10-12T13:00:00Z" },
      ],
      artifact_hash: ARTIFACT_HASH,
      approved_artifact_hash: approved ? ARTIFACT_HASH : null,
      technical_check: { duration_ms: 35000, width: 1080, height: 1920, has_audio: true, decodable: true, captions_safe: true },
      last_error_code: null,
      preview_url: null,
      poster_url: null,
      created_at: "2026-10-12T13:00:00Z",
      blocked_at: null,
      block_reason: null,
    }],
    publications: mode === "upload" ? [] : [{
      id: "44444444-4444-4444-8444-444444444444",
      production_id: "33333333-3333-4333-8333-333333333333",
      channel_connection_id: "22222222-2222-4222-8222-222222222222",
      artifact_hash: ARTIFACT_HASH,
      status: approved ? "ready_for_review" : "uploaded_private",
      youtube_video_id: "Fixture1234",
      processing_status: approved ? "succeeded" : "processing",
      privacy_status: "private",
      embeddable: approved ? true : null,
      approved_visibility: null,
      studio_reviewed_at: null,
      site_linked_at: null,
      last_error_code: null,
    }],
  };
}

function readMode(): FixtureMode {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "review" || mode === "setup" || mode === "upload" ? mode : "ready";
}

function FixtureApp() {
  const [lastAction, setLastAction] = useState("아직 실행한 픽스처 작업이 없습니다.");
  const mode = readMode();
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string }>).detail;
      setLastAction(`메모리 내 작업 수신: ${detail?.kind ?? "unknown"} — 외부 요청 없음`);
    };
    window.addEventListener("video-production-fixture-action", listener);
    return () => window.removeEventListener("video-production-fixture-action", listener);
  }, []);
  return (
    <>
      <aside className="sticky top-0 z-50 border-b-2 border-accent bg-surface px-4 py-3 shadow-sm" role="note">
        <strong>LOCAL UI FIXTURE — no real auth, no external actions</strong>
        <span className="ml-3 text-sm text-muted">mode={mode} · {lastAction}</span>
      </aside>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <nav aria-label="픽스처 모드" className="mb-4 flex flex-wrap gap-3 text-sm">
          <a className="text-accent-text underline" href="?mode=ready">승인 전</a>
          <a className="text-accent-text underline" href="?mode=review">공개 검수 가능</a>
          <a className="text-accent-text underline" href="?mode=upload">최초 업로드 게이트</a>
          <a className="text-accent-text underline" href="?mode=setup">설정 누락</a>
        </nav>
        <VideoProductionConsole workspace={fixtureWorkspace(mode)} />
      </main>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("fixture root is missing");
const fixtureWindow = window as Window & { __memeCatchVideoFixtureRoot?: Root };
const reactRoot = fixtureWindow.__memeCatchVideoFixtureRoot ?? createRoot(root);
fixtureWindow.__memeCatchVideoFixtureRoot = reactRoot;
reactRoot.render(<StrictMode><FixtureApp /></StrictMode>);
