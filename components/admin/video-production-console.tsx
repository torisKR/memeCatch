"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { performVideoProductionCommand } from "@/lib/actions/admin-video-productions";
import type {
  VideoProductionActionResult,
  VideoProductionCommand,
  VideoProductionView,
  VideoProductionWorkspace,
  YouTubePublicationView,
} from "@/lib/video-production/workspace-types";
import type { RightsAsset, VideoAssetKind, VideoScript } from "@/lib/video-production/core.mjs";

const PRODUCTION_STATUS: Record<string, string> = {
  draft: "초안",
  rendering: "렌더링 중",
  rendered: "렌더 완료",
  review_pending: "검수 대기",
  approved: "제작 승인",
  changes_requested: "수정 요청",
  blocked: "차단",
  failed: "실패",
};

const PUBLICATION_STATUS: Record<string, string> = {
  queued: "업로드 대기",
  uploading: "비공개 업로드 중",
  uploaded_private: "비공개 업로드 완료",
  processing: "YouTube 처리 중",
  ready_for_review: "Studio 검수 가능",
  publishing: "공개 상태 변경 중",
  published: "YouTube 공개 완료",
  site_linked: "사이트 연결 완료",
  reconcile_required: "업로드 결과 확인 필요",
  failed: "발행 실패",
  blocked: "사이트 비노출",
};

const ASSET_KIND_LABEL: Record<VideoAssetKind, string> = {
  graphic: "그래픽",
  voice: "음성",
  font: "폰트",
  music: "음악",
  image: "이미지",
  video: "영상",
};

const INPUT = "min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base";
const BUTTON = "min-h-11 rounded-lg bg-accent-strong px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON = "min-h-11 rounded-lg border border-border bg-surface px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

type Message = { kind: "success" | "error"; text: string } | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`${field} 값이 문자열이 아닙니다.`);
  return value;
}

function readStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${field} 값이 문자열 배열이 아닙니다.`);
  return value as string[];
}

function importedScript(value: unknown, candidate: VideoProductionWorkspace["candidates"][number]): VideoScript {
  const root = isRecord(value) && isRecord(value.script) ? value.script : value;
  if (!isRecord(root)) throw new Error("대본 JSON 최상위 형식을 확인해 주세요.");
  if (!Array.isArray(root.scenes) || root.scenes.length < 5 || root.scenes.length > 12) throw new Error("장면은 5~12개여야 합니다.");
  const allowedKinds = new Set(["hook", "meaning", "example", "context", "caution"]);
  const allowedSources = new Set(candidate.sources.map((source) => source.id));
  const sourceIds = readStringArray(root.source_ids, "source_ids");
  for (const sourceId of sourceIds) if (!allowedSources.has(sourceId)) throw new Error(`선택한 밈에 없는 출처 ID입니다: ${sourceId}`);
  const scenes = root.scenes.map((scene, index) => {
    if (!isRecord(scene)) throw new Error(`scenes[${index}] 형식을 확인해 주세요.`);
    const kind = readString(scene.kind, `scenes[${index}].kind`);
    if (!allowedKinds.has(kind)) throw new Error(`scenes[${index}].kind 값이 허용되지 않습니다.`);
    const sceneSources = readStringArray(scene.source_ids, `scenes[${index}].source_ids`);
    for (const sourceId of sceneSources) {
      if (!allowedSources.has(sourceId)) throw new Error(`선택한 밈에 없는 장면 출처 ID입니다: ${sourceId}`);
      if (!sourceIds.includes(sourceId)) throw new Error(`장면 출처가 대본 source_ids에 없습니다: ${sourceId}`);
    }
    if (!Number.isInteger(scene.start_ms) || !Number.isInteger(scene.end_ms)) throw new Error(`scenes[${index}] 시간 값이 정수가 아닙니다.`);
    return {
      id: readString(scene.id, `scenes[${index}].id`),
      kind: kind as VideoScript["scenes"][number]["kind"],
      heading: readString(scene.heading, `scenes[${index}].heading`),
      caption: readString(scene.caption, `scenes[${index}].caption`),
      narration: readString(scene.narration, `scenes[${index}].narration`),
      start_ms: scene.start_ms as number,
      end_ms: scene.end_ms as number,
      source_ids: sceneSources,
    };
  });
  const narration = readString(root.narration, "narration");
  const normalize = (text: string) => text.trim().replace(/\s+/gu, " ");
  if (normalize(narration) !== normalize(scenes.map((scene) => scene.narration).join(" "))) throw new Error("전체 내레이션이 장면 내레이션 순서와 일치하지 않습니다.");
  if (!Array.isArray(root.uncertain_claims) || root.uncertain_claims.some((claim) => !isRecord(claim))) throw new Error("uncertain_claims 형식을 확인해 주세요.");
  if (!Array.isArray(root.asset_requirements) || root.asset_requirements.some((asset) => !isRecord(asset))) throw new Error("asset_requirements 형식을 확인해 주세요.");
  if (typeof root.contains_synthetic_media !== "boolean") throw new Error("contains_synthetic_media는 true 또는 false여야 합니다.");
  return {
    title: readString(root.title, "title"),
    description: readString(root.description, "description"),
    narration,
    original_observation: readString(root.original_observation, "original_observation"),
    scenes,
    source_ids: sourceIds,
    uncertain_claims: root.uncertain_claims.map((claim, index) => ({
      text: readString(claim.text, `uncertain_claims[${index}].text`),
      reason: readString(claim.reason, `uncertain_claims[${index}].reason`),
    })),
    asset_requirements: root.asset_requirements.map((asset, index) => {
      const kind = readString(asset.kind, `asset_requirements[${index}].kind`);
      if (!(kind in ASSET_KIND_LABEL)) throw new Error(`asset_requirements[${index}].kind 값이 허용되지 않습니다.`);
      return { kind: kind as VideoAssetKind, description: readString(asset.description, `asset_requirements[${index}].description`) };
    }),
    contains_synthetic_media: root.contains_synthetic_media,
  };
}

function downloadCandidateSnapshot(candidate: VideoProductionWorkspace["candidates"][number]) {
  const factualDto = {
    id: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    description: candidate.description,
    origin: candidate.origin,
    usage_note: candidate.usage_note,
    caution: candidate.caution,
    usage_examples: candidate.usage_examples,
    sources: candidate.sources.map(({ id, title, url, approved }) => ({ id, title, url, approved })),
    claims: candidate.claims.map(({ id, type, text, source_id }) => ({ id, type, text, source_id })),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(factualDto, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "candidate.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatDate(value: string | null) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function safePreviewUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("https://")) return value;
  return null;
}

function safeExternalUrl(value: string) {
  return value.startsWith("https://") ? value : null;
}

function studioUrl(videoId: string | null) {
  if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return null;
  return `https://studio.youtube.com/video/${videoId}/edit`;
}

function blankManualScript(candidate: VideoProductionWorkspace["candidates"][number]): VideoScript {
  const sourceIds = candidate.sources.map((source) => source.id);
  const firstSource = sourceIds[0];
  const timings = [[0, 7000], [7000, 14000], [14000, 21000], [21000, 28000], [28000, 35000]] as const;
  const kinds = ["hook", "meaning", "example", "context", "caution"] as const;
  return {
    title: "",
    description: "",
    narration: "",
    original_observation: "",
    scenes: timings.map(([start_ms, end_ms], index) => ({
      id: `scene-${index + 1}`,
      kind: kinds[index],
      heading: "",
      caption: "",
      narration: "",
      start_ms,
      end_ms,
      source_ids: kinds[index] === "meaning" || kinds[index] === "context" ? (firstSource ? [firstSource] : []) : [],
    })),
    source_ids: firstSource ? [firstSource] : [],
    uncertain_claims: [],
    asset_requirements: [
      { kind: "graphic", description: "운영자가 권리를 확인한 그래픽" },
      { kind: "voice", description: "운영자가 권리를 확인한 음성" },
      { kind: "font", description: "운영자가 권리를 확인한 폰트" },
    ],
    contains_synthetic_media: false,
  };
}

export function VideoProductionConsole({ workspace }: { workspace: VideoProductionWorkspace }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const [candidateId, setCandidateId] = useState(workspace.candidates[0]?.id ?? "");
  const [manualDraft, setManualDraft] = useState<{ memeId: string; script: VideoScript } | null>(null);
  const [localDraftMessage, setLocalDraftMessage] = useState<Message>(null);

  function run(command: VideoProductionCommand, success: string) {
    setMessage(null);
    startTransition(async () => {
      let result: VideoProductionActionResult;
      try {
        result = await performVideoProductionCommand(command);
      } catch (error) {
        setMessage({
          kind: "error",
          text: error instanceof Error ? error.message : "요청 결과를 확인하지 못했어요. 새로고침 후 다시 확인하세요.",
        });
        return;
      }
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setMessage({ kind: "success", text: success });
      router.refresh();
    });
  }

  const publicationByProduction = useMemo(() => {
    const map = new Map<string, YouTubePublicationView[]>();
    for (const publication of workspace.publications) {
      const rows = map.get(publication.production_id) ?? [];
      rows.push(publication);
      map.set(publication.production_id, rows);
    }
    return map;
  }, [workspace.publications]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">영상 제작·발행</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
              검수된 밈으로 자체 해설 영상을 만들고, 제작물 해시별 승인 후 YouTube 비공개 업로드와 공개 전환을 관리합니다.
            </p>
          </div>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold">
            후보 {workspace.candidates.length}/5
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          출처 링크나 임베드 허용은 편집·재게시·상업 이용 권한이 아닙니다. 모든 자산 권리와 Studio 제한사항을 각각 확인하세요.
        </p>
      </header>

      {workspace.state === "setup_required" ? (
        <section aria-labelledby="video-setup" className="rounded-xl border border-accent/40 bg-accent-soft p-5">
          <h2 id="video-setup" className="text-lg font-bold">운영 설정이 필요합니다</h2>
          <p className="mt-1 text-sm leading-relaxed">
            아래 설정이 준비되기 전에는 AI 초안 생성 또는 YouTube 연동을 성공한 것처럼 표시하지 않습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {workspace.setup_notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="candidate-selection" className="rounded-xl border border-border bg-surface p-5">
        <h2 id="candidate-selection" className="text-lg font-bold">1. 제작 후보 선택</h2>
        <p className="mt-1 text-sm text-muted">편집 검수와 근거 확인을 통과하고, 제작 중복·차단 기록이 없는 후보만 최대 5개 표시합니다.</p>
        {workspace.candidates.length === 0 ? (
          <p className="mt-4 rounded-lg bg-surface-2 p-4 text-sm">현재 제작 가능한 후보가 없습니다.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">검수된 밈</span>
              <select aria-label="제작 후보" value={candidateId} onChange={(event) => { setCandidateId(event.target.value); setManualDraft(null); }} className={INPUT}>
                {workspace.candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.title} — {candidate.summary}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={BUTTON}
                disabled={pending || !candidateId || !workspace.draft_provider_configured}
                onClick={() => run({ kind: "generate", memeId: candidateId }, "AI 초안을 만들었습니다. 사실·권리 내용을 직접 검수하세요.")}
              >
                {pending ? "처리 중…" : "AI 초안 생성"}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON}
                disabled={pending || !candidateId}
                onClick={() => {
                  const candidate = workspace.candidates.find((item) => item.id === candidateId);
                  if (!candidate) return;
                  setManualDraft({ memeId: candidateId, script: blankManualScript(candidate) });
                }}
              >
                빈 수동 초안 만들기
              </button>
            </div>
          </div>
        )}
        {!workspace.draft_provider_configured ? (
          <p className="mt-3 text-sm font-medium text-danger">AI 초안 제공자 설정이 없어 생성 기능이 비활성화되었습니다.</p>
        ) : null}
        {candidateId ? <CandidateEvidence candidate={workspace.candidates.find((item) => item.id === candidateId)} /> : null}
        {candidateId ? (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
            <h3 className="font-semibold">로컬 OpenCodex로 대본 만들기</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">검수된 사실 DTO만 내려받아 로컬 OpenCodex에 입력합니다. 가져온 JSON은 저장 전 편집기에만 열리며 DB 저장·승인·업로드를 자동 실행하지 않습니다.</p>
            <code className="mt-3 block overflow-x-auto rounded-lg bg-surface p-3 text-xs" aria-label="로컬 대본 생성 명령">node scripts/video-production-draft.mjs --input candidate.json --output draft.json --model gpt-6.1-sol</code>
            <p className="mt-2 text-xs text-muted">CLI는 이 컴퓨터의 http://localhost:10100/v1만 사용합니다. 출력 대본도 운영자가 사실·권리 내용을 검수해야 합니다.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => {
                const candidate = workspace.candidates.find((item) => item.id === candidateId);
                if (candidate) downloadCandidateSnapshot(candidate);
              }}>로컬 대본용 근거 내려받기</button>
              <label className={`${SECONDARY_BUTTON} inline-flex cursor-pointer items-center focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2`}>
                로컬 대본 가져오기
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const candidate = workspace.candidates.find((item) => item.id === candidateId);
                    if (!candidate) return;
                    try {
                      const script = importedScript(JSON.parse(await file.text()), candidate);
                      setManualDraft({ memeId: candidate.id, script });
                      setLocalDraftMessage({ kind: "success", text: "로컬 대본을 저장 전 편집기에 열었습니다. 외부 작업이나 DB 저장은 실행하지 않았습니다." });
                    } catch (error) {
                      setLocalDraftMessage({ kind: "error", text: error instanceof Error ? error.message : "대본 JSON을 읽지 못했습니다." });
                    } finally {
                      event.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            {localDraftMessage ? <p role={localDraftMessage.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm ${localDraftMessage.kind === "error" ? "text-danger" : "text-foreground"}`}>{localDraftMessage.text}</p> : null}
          </div>
        ) : null}
        {manualDraft ? (
          <ManualDraftComposer
            candidate={workspace.candidates.find((item) => item.id === manualDraft.memeId)!}
            script={manualDraft.script}
            setScript={(script) => setManualDraft((current) => current ? { ...current, script } : null)}
            pending={pending}
            cancel={() => setManualDraft(null)}
            save={() => run({ kind: "create", memeId: manualDraft.memeId, script: manualDraft.script, assets: [] }, "수동 대본 초안을 저장했습니다. 이제 자산 권리를 등록하고 렌더를 준비하세요.")}
          />
        ) : null}
      </section>

      <OAuthConnectionPanel configured={workspace.oauth_configured} pending={pending} expectedChannelId={workspace.expected_channel_id} />

      <div aria-live="polite" aria-atomic="true">
        {message ? (
          <p role={message.kind === "error" ? "alert" : "status"} className={`rounded-xl border p-4 text-sm ${message.kind === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-accent/40 bg-accent-soft"}`}>
            {message.text}
          </p>
        ) : null}
      </div>

      <section aria-labelledby="production-list" className="space-y-4">
        <div>
          <h2 id="production-list" className="text-xl font-bold">2. 제작물 검수·발행</h2>
          <p className="mt-1 text-sm text-muted">수정하면 새 버전이 되고 기존 렌더·승인은 무효화됩니다.</p>
        </div>
        {workspace.productions.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface p-8 text-center text-muted">아직 생성된 제작물이 없습니다.</p>
        ) : workspace.productions.map((production) => (
          <ProductionEditor
            key={`${production.id}:${production.version}`}
            production={production}
            publications={publicationByProduction.get(production.id) ?? []}
            workspace={workspace}
            pending={pending}
            run={run}
          />
        ))}
      </section>
    </div>
  );
}

function CandidateEvidence({ candidate }: { candidate: VideoProductionWorkspace["candidates"][number] | undefined }) {
  if (!candidate) return null;
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg bg-surface-2 p-4 text-sm leading-relaxed">
        <h3 className="font-semibold">검수 스냅샷</h3>
        <p className="mt-2"><strong>설명:</strong> {candidate.description}</p>
        <p className="mt-2"><strong>유래:</strong> {candidate.origin}</p>
        {candidate.caution ? <p className="mt-2"><strong>사용 주의:</strong> {candidate.caution}</p> : null}
      </div>
      <div className="rounded-lg border border-border p-4 text-sm">
        <h3 className="font-semibold">승인된 출처와 주장</h3>
        <ul className="mt-2 space-y-2">
          {candidate.sources.map((source) => (
            <li key={source.id} className="break-words">
              {safeExternalUrl(source.url) ? <a href={source.url} target="_blank" rel="noreferrer" className="text-accent-text underline">{source.title}</a> : <span>{source.title} (안전하지 않은 URL 형식)</span>}
              <span className="ml-2 text-xs text-muted">{source.id}</span>
            </li>
          ))}
        </ul>
        {candidate.claims.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
            {candidate.claims.map((claim) => <li key={claim.id}>{claim.type}: {claim.text} · 근거 {claim.source_id}</li>)}
          </ul>
        ) : <p className="mt-3 text-sm text-danger">영상에서 단정할 수 있는 승인 주장이 없습니다.</p>}
      </div>
    </div>
  );
}

function ManualDraftComposer({
  candidate,
  script,
  setScript,
  pending,
  cancel,
  save,
}: {
  candidate: VideoProductionWorkspace["candidates"][number];
  script: VideoScript;
  setScript: (script: VideoScript) => void;
  pending: boolean;
  cancel: () => void;
  save: () => void;
}) {
  function updateScene(index: number, field: "heading" | "caption" | "narration" | "source_ids", value: string) {
    const scenes = script.scenes.map((scene, sceneIndex) => sceneIndex === index
      ? { ...scene, [field]: field === "source_ids" ? value.split(",").map((item) => item.trim()).filter(Boolean) : value }
      : scene);
    setScript({ ...script, scenes, narration: scenes.map((scene) => scene.narration).join(" ").trim() });
  }
  return (
    <section aria-labelledby="manual-draft" className="mt-5 space-y-4 rounded-xl border border-accent/40 bg-accent-soft/30 p-4">
      <div>
        <h3 id="manual-draft" className="font-bold">저장 전 수동 초안 · {candidate.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          아직 DB에 저장되지 않았습니다. 승인된 출처만 근거 ID로 사용하고, 예시 장면에는 반드시 ‘가상’ 또는 ‘자체 작성’임을 표시하세요. 장면 내레이션은 자동으로 합쳐집니다.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="영상 제목"><input value={script.title} onChange={(event) => setScript({ ...script, title: event.target.value })} className={INPUT} /></Field>
        <Field label="독자적 관찰"><textarea value={script.original_observation} onChange={(event) => setScript({ ...script, original_observation: event.target.value })} className={INPUT} rows={3} /></Field>
        <Field label="영상 설명" wide><textarea value={script.description} onChange={(event) => setScript({ ...script, description: event.target.value })} className={INPUT} rows={4} /></Field>
      </div>
      {script.scenes.map((scene, index) => (
        <fieldset key={scene.id} className="rounded-lg border border-border bg-surface p-4">
          <legend className="px-2 text-sm font-bold">수동 장면 {index + 1} · {scene.kind} · {scene.start_ms}–{scene.end_ms}ms</legend>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="장면 제목"><input value={scene.heading} onChange={(event) => updateScene(index, "heading", event.target.value)} className={INPUT} /></Field>
            <Field label="화면 자막"><input value={scene.caption} onChange={(event) => updateScene(index, "caption", event.target.value)} className={INPUT} /></Field>
            <Field label="내레이션" wide><textarea value={scene.narration} onChange={(event) => updateScene(index, "narration", event.target.value)} className={INPUT} rows={3} /></Field>
            <Field label="근거 출처 ID (쉼표 구분)" wide><input value={scene.source_ids.join(", ")} onChange={(event) => updateScene(index, "source_ids", event.target.value)} className={INPUT} /></Field>
          </div>
        </fieldset>
      ))}
      <div className="rounded-lg bg-surface p-3 text-sm"><strong>합성 내레이션:</strong> {script.narration || "장면 내레이션을 작성하세요."}</div>
      <div className="rounded-lg bg-surface p-3 text-xs text-muted">
        사용 가능한 승인 출처: {candidate.sources.map((source) => `${source.id} (${source.title})`).join(" · ") || "없음"}
      </div>
      <div className={`rounded-lg border p-3 text-sm ${script.uncertain_claims.length ? "border-accent/50 bg-surface" : "border-border"}`}>
        <strong>가져온 대본의 불확실한 주장</strong>
        {script.uncertain_claims.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {script.uncertain_claims.map((claim, index) => <li key={`${claim.text}:${index}`}>{claim.text} — {claim.reason}</li>)}
          </ul>
        ) : <p className="mt-1 text-muted">표시된 항목 없음. 운영자 사실 검수는 계속 필요합니다.</p>}
      </div>
      <div className="rounded-lg border border-border bg-surface p-3 text-sm">
        <strong>필요 자산 (권리 허용 아님)</strong>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {script.asset_requirements.map((asset, index) => <li key={`${asset.kind}:${index}`}>{ASSET_KIND_LABEL[asset.kind]} — {asset.description}</li>)}
        </ul>
        <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={script.contains_synthetic_media} onChange={(event) => setScript({ ...script, contains_synthetic_media: event.target.checked })} className="size-5" /> 실사처럼 보이는 합성 미디어 포함</label>
        <p className="mt-2 text-xs text-muted">대본 가져오기는 자산 권리 원장을 만들거나 어떤 허용 체크도 자동 승인하지 않습니다.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={BUTTON} disabled={pending} onClick={save}>수동 초안 저장</button>
        <button type="button" className={SECONDARY_BUTTON} disabled={pending} onClick={cancel}>저장하지 않고 닫기</button>
      </div>
    </section>
  );
}

function OAuthConnectionPanel({ configured, pending, expectedChannelId }: { configured: boolean; pending: boolean; expectedChannelId: string }) {
  return (
    <section aria-labelledby="youtube-connection" className="rounded-xl border border-border bg-surface p-5">
      <h2 id="youtube-connection" className="text-lg font-bold">YouTube 채널 연결</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        연결 권한은 업로드뿐 아니라 영상 상태 조회와 공개 상태 변경에 사용됩니다. 앱은 원격 영상을 자동 삭제하지 않으며 삭제 요청은 별도 추적합니다. 대상은 {" "}
        <a href={`https://www.youtube.com/channel/${expectedChannelId}`} target="_blank" rel="noreferrer" className="font-semibold text-accent-text underline">밈캐치 운영 채널</a>로 고정됩니다.
      </p>
      <form method="POST" action="/api/admin/video-productions/youtube/connect" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label>
          <span className="mb-1 block text-sm font-medium">연결할 채널 ID</span>
          <input name="expected_channel_id" className={INPUT} required readOnly value={expectedChannelId} disabled={!configured || pending} />
        </label>
        <button type="submit" className={BUTTON} disabled={!configured || pending}>OAuth로 채널 연결</button>
        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="consent" value="true" required disabled={!configured || pending} className="mt-1 size-5" />
          <span>YouTube 영상의 조회·업로드·수정·공개 상태 관리·삭제가 가능한 넓은 권한 범위를 이해했습니다. 밈캐치 앱은 이 화면에서 원격 영상을 직접 삭제하지 않습니다.</span>
        </label>
      </form>
      {!configured ? <p className="mt-3 text-sm font-medium text-danger">YouTube OAuth 설정이 없어 연결 기능이 비활성화되었습니다.</p> : null}
    </section>
  );
}

function ProductionEditor({
  production,
  publications,
  workspace,
  pending,
  run,
}: {
  production: VideoProductionView;
  publications: YouTubePublicationView[];
  workspace: VideoProductionWorkspace;
  pending: boolean;
  run: (command: VideoProductionCommand, success: string) => void;
}) {
  const [script, setScript] = useState<VideoScript>(() => structuredClone(production.script));
  const [assets, setAssets] = useState<RightsAsset[]>(() => structuredClone(production.assets));
  const [reviewNote, setReviewNote] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [assetKind, setAssetKind] = useState<VideoAssetKind>("graphic");
  const approved = Boolean(production.artifact_hash && production.approved_artifact_hash === production.artifact_hash);
  const preview = safePreviewUrl(production.preview_url);
  const poster = safePreviewUrl(production.poster_url);

  function updateScene(index: number, field: "heading" | "caption" | "narration" | "source_ids", value: string) {
    setScript((current) => {
      const scenes = current.scenes.map((scene, sceneIndex) => sceneIndex === index
        ? { ...scene, [field]: field === "source_ids" ? value.split(",").map((item) => item.trim()).filter(Boolean) : value }
        : scene);
      return { ...current, scenes, narration: scenes.map((scene) => scene.narration).join(" ").trim() };
    });
  }

  function updateAsset(index: number, field: keyof RightsAsset, value: unknown) {
    setAssets((current) => current.map((asset, assetIndex) => assetIndex === index ? { ...asset, [field]: value } as RightsAsset : asset));
  }

  function addAsset() {
    setAssets((current) => {
      let suffix = current.length + 1;
      while (current.some((asset) => asset.id === `${assetKind}-${suffix}`)) suffix += 1;
      return [...current, {
        id: `${assetKind}-${suffix}`,
        kind: assetKind,
        source_url: null,
        owner: "",
        acquisition_method: "self_created",
        allow_edit: false,
        allow_youtube: false,
        allow_commercial: false,
        attribution: null,
        valid_until: null,
        territories: ["worldwide"],
        evidence: "",
        reviewed_by: "",
        reviewed_at: "",
      }];
    });
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h3 className="text-lg font-bold">{production.title}</h3>
          <p className="mt-1 text-xs text-muted">버전 {production.version} · 생성 {formatDate(production.created_at)} · ID {production.id}</p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
          {PRODUCTION_STATUS[production.status] ?? production.status}
        </span>
      </header>

      <div className="space-y-6 p-5">
        {production.blocked_at ? (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm" role="alert">
            <strong>사이트 비노출 적용:</strong> {production.block_reason ?? "사유 없음"} · {formatDate(production.blocked_at)}
          </div>
        ) : null}
        {production.last_error_code ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm" role="alert">최근 제작 오류: {production.last_error_code}</p>
        ) : null}

        <section aria-labelledby={`script-${production.id}`} className="space-y-4">
          <h4 id={`script-${production.id}`} className="font-bold">대본과 장면 편집</h4>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="영상 제목"><input value={script.title} onChange={(event) => setScript({ ...script, title: event.target.value })} className={INPUT} /></Field>
            <Field label="독자적 관찰"><textarea value={script.original_observation} onChange={(event) => setScript({ ...script, original_observation: event.target.value })} className={INPUT} rows={3} /></Field>
            <Field label="영상 설명" wide><textarea value={script.description} onChange={(event) => setScript({ ...script, description: event.target.value })} className={INPUT} rows={4} /></Field>
          </div>
          <div className="space-y-3">
            {script.scenes.map((scene, index) => (
              <fieldset key={scene.id} className="rounded-xl border border-border p-4">
                <legend className="px-2 text-sm font-bold">장면 {index + 1} · {scene.kind} · {scene.start_ms}–{scene.end_ms}ms</legend>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="장면 제목"><input value={scene.heading} onChange={(event) => updateScene(index, "heading", event.target.value)} className={INPUT} /></Field>
                  <Field label="화면 자막"><input value={scene.caption} onChange={(event) => updateScene(index, "caption", event.target.value)} className={INPUT} /></Field>
                  <Field label="내레이션" wide><textarea value={scene.narration} onChange={(event) => updateScene(index, "narration", event.target.value)} className={INPUT} rows={3} /></Field>
                  <Field label="근거 출처 ID (쉼표 구분)" wide><input value={scene.source_ids.join(", ")} onChange={(event) => updateScene(index, "source_ids", event.target.value)} className={INPUT} /></Field>
                </div>
              </fieldset>
            ))}
          </div>
          <div className="rounded-lg bg-surface-2 p-4 text-sm">
            <strong>합성 내레이션</strong>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{script.narration}</p>
          </div>
          <SourceAndUncertainty production={production} script={script} />
        </section>

        <section aria-labelledby={`rights-${production.id}`} className="space-y-4">
          <div>
            <h4 id={`rights-${production.id}`} className="font-bold">자산 권리 원장</h4>
            <p className="mt-1 text-sm text-muted">AI가 만든 요구 자산도 운영자가 각 허용 범위를 직접 체크하기 전에는 사용할 수 없습니다.</p>
          </div>
          {assets.length === 0 ? (
            <p className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm">등록된 자산이 없어 렌더링할 수 없습니다.</p>
          ) : assets.map((asset, index) => (
            <AssetEditor key={`${asset.id}:${index}`} asset={asset} index={index} update={updateAsset} />
          ))}
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-surface-2 p-4">
            <label>
              <span className="mb-1 block text-sm font-medium">추가할 자산 종류</span>
              <select aria-label="추가할 자산 종류" value={assetKind} onChange={(event) => setAssetKind(event.target.value as VideoAssetKind)} className={INPUT}>
                {Object.entries(ASSET_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="button" className={SECONDARY_BUTTON} onClick={addAsset}>권리 자산 추가</button>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="button" className={BUTTON} disabled={pending || Boolean(production.blocked_at)} onClick={() => run({ kind: "revise", id: production.id, expectedVersion: production.version, script, assets }, "수정본을 새 버전으로 저장했습니다. 기존 렌더와 승인은 무효화됩니다.")}>대본·권리 저장</button>
          <button type="button" className={SECONDARY_BUTTON} disabled={pending || Boolean(production.blocked_at)} onClick={() => run({ kind: "render", id: production.id, expectedVersion: production.version }, "렌더 작업을 대기열에 넣었습니다.")}>렌더 작업 시작</button>
        </div>

        <ArtifactPanel production={production} preview={preview} poster={poster} />

        {production.artifact_hash ? (
          <section aria-labelledby={`review-${production.id}`} className="rounded-xl border border-border p-4">
            <h4 id={`review-${production.id}`} className="font-bold">제작물 검수</h4>
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium">검수 메모</span>
              <textarea className={INPUT} rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="승인 근거 또는 수정 요청을 기록하세요." />
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={BUTTON} disabled={pending || Boolean(production.blocked_at)} onClick={() => run({ kind: "review", id: production.id, artifactHash: production.artifact_hash!, decision: "approve", note: reviewNote }, "현재 제작물 해시를 승인했습니다.")}>현재 해시 승인</button>
              <button type="button" className={SECONDARY_BUTTON} disabled={pending || !reviewNote.trim()} onClick={() => run({ kind: "review", id: production.id, artifactHash: production.artifact_hash!, decision: "changes_requested", note: reviewNote }, "수정 요청을 기록했습니다.")}>수정 요청</button>
            </div>
          </section>
        ) : null}

        <PrivateUploadPanel production={production} publications={publications} workspace={workspace} approved={approved} pending={pending} run={run} />

        {publications.length ? (
          <section aria-labelledby={`publications-${production.id}`} className="space-y-3">
            <h4 id={`publications-${production.id}`} className="font-bold">YouTube 발행 원장</h4>
            {publications.map((publication) => <PublicationPanel key={publication.id} publication={publication} production={production} pending={pending} run={run} />)}
          </section>
        ) : null}

        <section aria-labelledby={`block-${production.id}`} className="rounded-xl border border-danger/30 p-4">
          <h4 id={`block-${production.id}`} className="font-bold">차단·삭제 요청</h4>
          <p className="mt-1 text-sm text-muted">즉시 사이트 비노출을 적용하고 원격 영상 조치는 별도 작업으로 추적합니다. YouTube 영상을 자동 삭제하지 않습니다.</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-sm font-medium">차단 또는 삭제 요청 사유</span>
              <input aria-label="차단 또는 삭제 요청 사유" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} className={INPUT} placeholder="요청자·대상 자산·사유" />
            </label>
            <button type="button" className={SECONDARY_BUTTON} disabled={pending || !blockReason.trim() || Boolean(production.blocked_at)} onClick={() => run({ kind: "block", id: production.id, reason: blockReason }, "사이트 비노출과 삭제 요청 추적을 시작했습니다.")}>사이트 비노출·삭제 요청 기록</button>
          </div>
        </section>
      </div>
    </article>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "block lg:col-span-2" : "block"}><span className="mb-1 block text-sm font-medium">{label}</span>{children}</label>;
}

function SourceAndUncertainty({ production, script }: { production: VideoProductionView; script: VideoScript }) {
  const sourceById = new Map(production.source_snapshot.sources.map((source) => [source.id, source]));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border p-4">
        <h5 className="font-semibold">대본에 사용한 출처</h5>
        <ul className="mt-2 space-y-2 text-sm">
          {script.source_ids.map((sourceId) => {
            const source = sourceById.get(sourceId);
            return <li key={sourceId}>{source && safeExternalUrl(source.url) ? <a href={source.url} target="_blank" rel="noreferrer" className="text-accent-text underline">{source.title}</a> : source ? <span>{source.title} (안전하지 않은 URL 형식)</span> : <span className="text-danger">알 수 없는 출처</span>} <span className="text-xs text-muted">{sourceId}</span></li>;
          })}
        </ul>
      </div>
      <div className={`rounded-xl border p-4 ${script.uncertain_claims.length ? "border-accent/50 bg-accent-soft" : "border-border"}`}>
        <h5 className="font-semibold">불확실한 주장</h5>
        {script.uncertain_claims.length ? (
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            {script.uncertain_claims.map((claim, index) => <li key={`${claim.text}:${index}`}><strong>{claim.text}</strong><br />{claim.reason}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">초안이 표시한 불확실한 주장은 없습니다. 운영자 사실 검수는 계속 필요합니다.</p>}
      </div>
    </div>
  );
}

function AssetEditor({ asset, index, update }: { asset: RightsAsset; index: number; update: (index: number, field: keyof RightsAsset, value: unknown) => void }) {
  return (
    <fieldset className="rounded-xl border border-border p-4">
      <legend className="px-2 text-sm font-bold">{ASSET_KIND_LABEL[asset.kind]} · {asset.id}</legend>
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="권리자 또는 제공자"><input value={asset.owner} onChange={(event) => update(index, "owner", event.target.value)} className={INPUT} /></Field>
        <Field label="취득 방법">
          <select value={asset.acquisition_method} onChange={(event) => update(index, "acquisition_method", event.target.value)} className={INPUT}>
            <option value="self_created">자체 제작</option><option value="creator_supplied">창작자 직접 제공</option><option value="licensed">라이선스 취득</option>
          </select>
        </Field>
        <Field label="자산 출처 URL"><input type="url" value={asset.source_url ?? ""} onChange={(event) => update(index, "source_url", event.target.value || null)} className={INPUT} placeholder="자체 제작이면 비워 둘 수 있습니다" /></Field>
        <Field label="필수 출처 표기"><input value={asset.attribution ?? ""} onChange={(event) => update(index, "attribution", event.target.value || null)} className={INPUT} placeholder="없으면 비워 두세요" /></Field>
        <Field label="사용 기한 (시간대 포함 ISO)"><input value={asset.valid_until ?? ""} onChange={(event) => update(index, "valid_until", event.target.value || null)} className={INPUT} placeholder="무기한이면 비워 두세요" /></Field>
        <Field label="사용 지역 (쉼표 구분)"><input value={asset.territories.join(", ")} onChange={(event) => update(index, "territories", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} className={INPUT} /></Field>
        <Field label="허락 증빙" wide><textarea value={asset.evidence} onChange={(event) => update(index, "evidence", event.target.value)} className={INPUT} rows={3} /></Field>
        <Field label="검수자"><input value={asset.reviewed_by} onChange={(event) => update(index, "reviewed_by", event.target.value)} className={INPUT} /></Field>
        <Field label="검수 시각 (시간대 포함 ISO)"><input value={asset.reviewed_at} onChange={(event) => update(index, "reviewed_at", event.target.value)} className={INPUT} /></Field>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {([
          ["allow_edit", "편집 허용"],
          ["allow_youtube", "YouTube 업로드 허용"],
          ["allow_commercial", "상업 이용 허용"],
        ] as const).map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 rounded-lg bg-surface-2 p-3 text-sm font-medium">
            <input type="checkbox" checked={asset[field]} onChange={(event) => update(index, field, event.target.checked)} className="size-5" /> {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ArtifactPanel({ production, preview, poster }: { production: VideoProductionView; preview: string | null; poster: string | null }) {
  const entries = Object.entries(production.technical_check);
  return (
    <section aria-labelledby={`artifact-${production.id}`} className="rounded-xl border border-border p-4">
      <h4 id={`artifact-${production.id}`} className="font-bold">렌더 산출물·기술 검사</h4>
      {preview ? <video controls preload="metadata" poster={poster ?? undefined} className="mt-3 max-h-[70vh] w-full rounded-lg bg-black" src={preview}>브라우저가 영상 재생을 지원하지 않습니다.</video> : <p className="mt-3 text-sm text-muted">검수 가능한 미리보기 영상이 아직 없습니다.</p>}
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {entries.length ? entries.map(([key, value]) => <div key={key} className="rounded-lg bg-surface-2 p-3"><dt className="font-medium">{key}</dt><dd className="mt-1 break-words text-muted">{String(value)}</dd></div>) : <div className="text-muted">기술 검사 기록 없음</div>}
      </dl>
      <p className="mt-4 break-all rounded-lg bg-surface-2 p-3 font-mono text-xs"><strong className="font-sans">산출물 SHA-256:</strong> {production.artifact_hash ?? "없음"}</p>
      <p className="mt-2 break-all rounded-lg bg-surface-2 p-3 font-mono text-xs"><strong className="font-sans">승인 SHA-256:</strong> {production.approved_artifact_hash ?? "없음"}</p>
    </section>
  );
}

function PrivateUploadPanel({ production, publications, workspace, approved, pending, run }: { production: VideoProductionView; publications: YouTubePublicationView[]; workspace: VideoProductionWorkspace; approved: boolean; pending: boolean; run: (command: VideoProductionCommand, success: string) => void }) {
  const [channel, setChannel] = useState("");
  const [consent, setConsent] = useState(false);
  const [madeForKids, setMadeForKids] = useState<"" | "yes" | "no">("");
  const usableChannels = workspace.channels.filter((item) => item.connection_status === "connected" && item.channel_id === workspace.expected_channel_id);
  const oauthWarnings = usableChannels.filter((item) => ["unknown", "testing", "verification_required"].includes(item.oauth_status));
  const existingPublication = publications.find((publication) => publication.artifact_hash === production.artifact_hash);
  const disabled = pending || !approved || !workspace.oauth_configured || !channel || !consent || !madeForKids || Boolean(production.blocked_at) || Boolean(existingPublication);
  return (
    <section aria-labelledby={`upload-${production.id}`} className="rounded-xl border border-border p-4">
      <h4 id={`upload-${production.id}`} className="font-bold">YouTube 비공개 업로드</h4>
      <p className="mt-1 text-sm text-muted">승인된 산출물 해시와 연결 채널을 고정해 먼저 비공개로 업로드합니다.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="대상 채널">
          <select aria-label="비공개 업로드 대상 채널" className={INPUT} value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="">채널을 명시적으로 선택하세요</option>
            {usableChannels.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.channel_id} · OAuth {item.oauth_status} · API {item.api_publication_status}</option>)}
          </select>
        </Field>
        <Field label="아동용 콘텐츠 여부">
          <select aria-label="아동용 콘텐츠 여부" className={INPUT} value={madeForKids} onChange={(event) => setMadeForKids(event.target.value as "" | "yes" | "no")}>
            <option value="">선택 필요</option><option value="yes">예, 아동용입니다</option><option value="no">아니요, 아동용이 아닙니다</option>
          </select>
        </Field>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-5" /><span>현재 승인 해시를 선택한 채널에 비공개 업로드하며, 결과가 불명확하면 새 영상을 만들지 않고 조정 절차로 멈추는 데 동의합니다.</span></label>
      <button type="button" className={`${BUTTON} mt-4`} disabled={disabled} onClick={() => run({ kind: "upload", id: production.id, artifactHash: production.artifact_hash!, channelConnectionId: channel, consent, madeForKids: madeForKids === "yes" }, "비공개 업로드 작업을 시작했습니다.")}>승인 해시 비공개 업로드</button>
      {!approved ? <p className="mt-2 text-sm text-danger">현재 산출물 해시가 승인되지 않아 업로드할 수 없습니다.</p> : null}
      {usableChannels.length === 0 ? <p className="mt-2 text-sm text-danger">업로드 가능한 OAuth 채널 연결이 없습니다.</p> : null}
      {oauthWarnings.length ? <p className="mt-2 rounded-lg bg-accent-soft p-3 text-sm">OAuth 앱 상태가 {oauthWarnings.map((item) => item.oauth_status).join(", ")}입니다. 비공개 업로드 자체를 추측으로 막지는 않지만 토큰 만료·API 공개 제한은 실제 응답과 운영 콘솔에서 확인하세요.</p> : null}
      {existingPublication ? <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm font-medium">이 제작물 해시에는 이미 발행 원장({PUBLICATION_STATUS[existingPublication.status] ?? existingPublication.status})이 있습니다. 새 업로드를 만들지 말고 아래 원장에서 기존 세션 재시도 또는 소유권 조정을 사용하세요.</p> : null}
    </section>
  );
}

function PublicationPanel({ publication, production, pending, run }: { publication: YouTubePublicationView; production: VideoProductionView; pending: boolean; run: (command: VideoProductionCommand, success: string) => void }) {
  const [visibility, setVisibility] = useState<"" | "public" | "unlisted">("");
  const [studioReviewed, setStudioReviewed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [videoId, setVideoId] = useState(publication.youtube_video_id ?? "");
  const [reconcileConsent, setReconcileConsent] = useState(false);
  const ready = publication.status === "ready_for_review";
  const hashBound = publication.artifact_hash === production.artifact_hash && publication.artifact_hash === production.approved_artifact_hash;
  const canPublish = ready && hashBound && visibility && studioReviewed && consent && !pending && !production.blocked_at;
  const studio = studioUrl(publication.youtube_video_id);
  return (
    <article className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold">{PUBLICATION_STATUS[publication.status] ?? publication.status}</h5>
          <p className="mt-1 text-xs text-muted">발행 ID {publication.id} · 채널 연결 {publication.channel_connection_id}</p>
        </div>
        {studio ? <a href={studio} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent-text underline">YouTube Studio에서 검수</a> : null}
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="font-medium">영상 ID</dt><dd className="break-all text-muted">{publication.youtube_video_id ?? "미확정"}</dd></div>
        <div><dt className="font-medium">처리</dt><dd className="text-muted">{publication.processing_status ?? "확인 전"}</dd></div>
        <div><dt className="font-medium">공개 상태</dt><dd className="text-muted">{publication.privacy_status ?? "확인 전"}</dd></div>
        <div><dt className="font-medium">임베드</dt><dd className="text-muted">{publication.embeddable === null ? "확인 전" : publication.embeddable ? "허용" : "차단"}</dd></div>
      </dl>
      <p className="mt-3 break-all rounded-lg bg-surface-2 p-3 font-mono text-xs">업로드 해시: {publication.artifact_hash}</p>
      {publication.last_error_code ? <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">발행 오류: {publication.last_error_code}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="최종 공개 방식">
          <select aria-label="최종 공개 방식" className={INPUT} value={visibility} onChange={(event) => setVisibility(event.target.value as "" | "public" | "unlisted")} disabled={!ready}>
            <option value="">명시적으로 선택하세요</option><option value="public">공개</option><option value="unlisted">일부 공개</option>
          </select>
        </Field>
        <div className="space-y-2 pt-1 md:pt-7">
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={studioReviewed} onChange={(event) => setStudioReviewed(event.target.checked)} disabled={!ready} className="mt-0.5 size-5" /><span>YouTube Studio에서 저작권·정책 제한과 처리 완료를 확인했습니다.</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={!ready} className="mt-0.5 size-5" /><span>현재 업로드 해시를 선택한 공개 상태로 전환하고 사이트 연결 조건을 확인하는 데 동의합니다.</span></label>
        </div>
      </div>
      <button type="button" className={`${BUTTON} mt-3`} disabled={!canPublish} onClick={() => run({ kind: "publish", publicationId: publication.id, artifactHash: publication.artifact_hash, visibility: visibility as "public" | "unlisted", studioReviewed, consent }, "YouTube 공개 전환과 사이트 연결 확인을 시작했습니다.")}>Studio 검수 완료 후 공개 전환</button>
      {!ready ? <p className="mt-2 text-sm text-muted">YouTube 처리와 소유 채널 조회가 끝나 ready_for_review가 되어야 공개할 수 있습니다.</p> : !hashBound ? <p className="mt-2 text-sm text-danger">제작·승인·업로드 해시가 일치하지 않아 공개할 수 없습니다.</p> : null}

      <div className="mt-5 border-t border-border pt-4">
        <h6 className="font-semibold">실패 복구</h6>
        <p className="mt-1 text-sm text-muted">재시도는 저장된 이어 올리기 세션과 기존 영상 ID를 먼저 조회하며 새 업로드를 자동 생성하지 않습니다.</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <button type="button" className={SECONDARY_BUTTON} disabled={pending} onClick={() => run({ kind: "retry", publicationId: publication.id }, "기존 업로드 세션 상태를 다시 확인합니다.")}>기존 세션 재시도</button>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-sm font-medium">조정할 YouTube 영상 ID</span>
            <input aria-label="조정할 YouTube 영상 ID" className={INPUT} value={videoId} onChange={(event) => setVideoId(event.target.value)} placeholder="YouTube Studio에서 확인한 영상 ID" />
          </label>
          <button type="button" className={SECONDARY_BUTTON} disabled={pending || !videoId.trim() || !reconcileConsent} onClick={() => run({ kind: "reconcile", publicationId: publication.id, videoId: videoId.trim(), consent: reconcileConsent }, "영상 소유 채널과 해시를 확인하는 조정 작업을 시작했습니다.")}>소유권 확인 후 조정</button>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={reconcileConsent} onChange={(event) => setReconcileConsent(event.target.checked)} className="mt-0.5 size-5" /><span>입력한 영상 ID를 새로 업로드하지 않고, 연결 채널의 소유 영상인지 확인해 기존 발행 원장과 조정하는 데 동의합니다.</span></label>
      </div>
      {publication.site_linked_at ? <p className="mt-4 text-sm font-medium">사이트 연결 완료: {formatDate(publication.site_linked_at)}</p> : null}
      {publication.studio_reviewed_at ? <p className="mt-1 text-sm text-muted">Studio 검수 기록: {formatDate(publication.studio_reviewed_at)}</p> : null}
    </article>
  );
}
