"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  reprocessMpeJob,
  reviewMpeClaim,
  reviewMpeCandidate,
  saveMpeCandidateRevision,
  setMpeIngestionSourceRights,
} from "@/lib/actions/admin-mpe";
import {
  RIGHTS_BASIS,
  RIGHTS_BASIS_LABELS,
  SOURCE_ROLES,
  SOURCE_ROLE_LABELS,
  type RightsBasis,
  type SourceRole,
} from "@/lib/sources/review";
import { MpeReviewTransparency } from "./mpe-review-transparency";

export type MpeReviewStatus =
  | "FACT_CHECKING"
  | "RIGHTS_CHECKING"
  | "PUBLISH"
  | "APPROVED"
  | "LIMITED"
  | "REJECTED";

/**
 * 주장 하나가 실제로 기댄 근거 한 건.
 * 예전처럼 문자열 배열로 합치면 운영자가 어떤 발화인지 확인할 수 없어
 * claim ↔ 근거 대조가 불가능해져서, 종류를 구분해 그대로 전달한다.
 */
export type MpeClaimEvidence =
  | {
      kind: "text_segment";
      segmentId: string;
      origin: string;
      startMs: number | null;
      text: string;
      url: null;
    }
  | {
      kind: "source";
      segmentId: null;
      origin: null;
      startMs: null;
      text: string;
      url: string;
    };

export type MpeReviewConsoleProps = {
  candidate: {
    id: string;
    title: string;
    memeType: string;
    reviewStatus: MpeReviewStatus;
    overallConfidence: number | null;
    draft: Record<string, unknown>;
    modelVersion: string | null;
    promptVersion: string | null;
  };
  media: {
    ingestionId: string;
    sourceUrl: string | null;
    sourceTitle: string | null;
    authorName: string | null;
    publishedAt: string | null;
    availabilityStatus: string | null;
    rightsMode: string;
    rightsAttested: boolean;
    sourceRole: SourceRole | null;
    rightsBasis: RightsBasis | null;
    mimeType: string | null;
    dimensions: string | null;
    durationMs: number | null;
  };
  jobs: Array<{
    id: string;
    jobType: string;
    status: string;
    attempts: number;
    processor: string | null;
    errorCode: string | null;
    canReprocess: boolean;
  }>;
  timeline: Array<{
    id: string;
    origin: string;
    startMs: number | null;
    endMs: number | null;
    text: string;
    confidence: number | null;
  }>;
  artifacts: Array<{
    id: string;
    kind: string;
    frameMs: number | null;
    reference: string;
    representative: boolean;
    signedUrl: string | null;
    mimeType: string | null;
  }>;
  matches: Array<{
    id: string;
    targetTitle: string;
    relation: "DUPLICATE" | "RELATED" | "DERIVED";
    score: number;
  }>;
  claims: Array<{
    id: string;
    field: string;
    text: string;
    confidence: number;
    reviewStatus: string;
    evidence: MpeClaimEvidence[];
  }>;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    draft: Record<string, unknown>;
    modelVersion: string;
    promptVersion: string;
    createdAt: string;
  }>;
  /** 검수 큐 안에서의 이전·다음 후보. 큐 순서(created_at 오름차순)와 같은 정렬을 쓴다. */
  queue?: { previousId?: string | null; nextId?: string | null };
};

const STATUS_LABEL: Record<MpeReviewStatus, string> = {
  FACT_CHECKING: "사실 검수",
  RIGHTS_CHECKING: "권리 검수",
  PUBLISH: "공개 결정",
  APPROVED: "공개 승인",
  LIMITED: "제한 공개",
  REJECTED: "반려",
};

const CLAIM_STATUS_LABEL: Record<string, string> = {
  PENDING: "검수 대기",
  APPROVED: "근거 승인",
  REJECTED: "근거 반려",
};

const STAGES = ["FACT_CHECKING", "RIGHTS_CHECKING", "PUBLISH"] as const;
type Stage = (typeof STAGES)[number];

function isStage(value: MpeReviewStatus): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

function timecode(ms: number | null) {
  if (ms === null) return "시간 없음";
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  const millis = ms % 1_000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function MpeReviewConsole(props: MpeReviewConsoleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(() => JSON.stringify(props.candidate.draft, null, 2));
  const [reason, setReason] = useState("");
  const [sourceRole, setSourceRole] = useState<SourceRole | "">(props.media.sourceRole ?? "");
  const [rightsBasis, setRightsBasis] = useState<RightsBasis | "">(props.media.rightsBasis ?? "");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  // 주장에 마우스를 올리면 그 근거가 있는 타임라인 구간을 함께 강조한다.
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  // 재처리는 근거 승인과 검수 단계를 초기화하므로 한 번 더 확인한다.
  const [confirmReprocessId, setConfirmReprocessId] = useState<string | null>(null);

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) setMessage({ kind: "error", text: result.error });
      else {
        setMessage({ kind: "success", text: success });
        router.refresh();
      }
    });
  }

  function parseDraft(): Record<string, unknown> | null {
    try {
      return JSON.parse(draft) as Record<string, unknown>;
    } catch {
      setMessage({ kind: "error", text: "초안 JSON 형식을 확인해 주세요." });
      return null;
    }
  }

  function saveRevision() {
    const parsed = parseDraft();
    if (!parsed) return;
    run(
      () => saveMpeCandidateRevision({ candidateId: props.candidate.id, draft: parsed }),
      "수정 전·후 초안 이력을 저장했어요.",
    );
  }

  /** 필드 키로 초안 항목을 찾아 문구만 교체한다. 손으로 JSON을 고칠 필요가 없어야 한다. */
  function saveClaimText(claimId: string) {
    const parsed = parseDraft();
    if (!parsed) return;
    const field = props.claims.find((claim) => claim.id === claimId)?.field;
    const entries = Array.isArray(parsed.claims) ? [...parsed.claims] : [];
    const index = entries.findIndex(
      (entry) => Boolean(entry) && typeof entry === "object"
        && (entry as { field?: unknown }).field === field,
    );
    if (index < 0) {
      setMessage({
        kind: "error",
        text: `${field ?? "해당"} 필드의 초안을 찾지 못했어요. JSON 편집에서 직접 확인해 주세요.`,
      });
      return;
    }
    entries[index] = { ...(entries[index] as Record<string, unknown>), text: editingText.trim() };
    const next = { ...parsed, claims: entries };
    setDraft(JSON.stringify(next, null, 2));
    setEditingClaimId(null);
    run(
      () => saveMpeCandidateRevision({ candidateId: props.candidate.id, draft: next }),
      `${field ?? "주장"} 문구를 수정하고 이력을 저장했어요.`,
    );
  }

  function review(decision: "APPROVED" | "PUBLISHED" | "LIMITED" | "REJECTED" | "CHANGES_REQUESTED") {
    run(
      () =>
        reviewMpeCandidate({
          candidateId: props.candidate.id,
          stage: props.candidate.reviewStatus as Stage,
          decision,
          reason: reason.trim() || undefined,
        }),
      "검수 결정을 반영했어요.",
    );
  }

  function saveSourceRights() {
    if (!sourceRole || !rightsBasis) {
      setMessage({ kind: "error", text: "출처 역할과 권리 근거를 모두 선택해 주세요." });
      return;
    }
    run(
      () => setMpeIngestionSourceRights({ ingestionId: props.media.ingestionId, sourceRole, rightsBasis }),
      "출처 역할과 권리 근거를 저장했어요.",
    );
  }

  /**
   * 남은 근거 일괄 승인. 서버 액션은 주장마다 한 번씩 그대로 호출하므로
   * 단계·근거 유무 검사는 RPC가 그대로 수행한다. 하나라도 실패하면 그 지점에서 멈춘다.
   */
  function approveRemainingClaims() {
    const targets = props.claims.filter(
      (claim) => claim.reviewStatus === "PENDING" && claim.evidence.length > 0,
    );
    if (targets.length === 0) return;
    setMessage(null);
    startTransition(async () => {
      let approved = 0;
      for (const claim of targets) {
        const result = await reviewMpeClaim({
          candidateId: props.candidate.id,
          claimId: claim.id,
          decision: "APPROVED",
        });
        if (!result.ok) {
          setMessage({
            kind: "error",
            text: approved > 0
              ? `근거 ${approved}건 승인 후 중단했어요: ${result.error}`
              : result.error,
          });
          router.refresh();
          return;
        }
        approved += 1;
      }
      setMessage({ kind: "success", text: `남은 근거 ${approved}건을 승인했어요.` });
      router.refresh();
    });
  }

  const approvedClaims = props.claims.filter((claim) => claim.reviewStatus === "APPROVED").length;
  const pendingClaims = props.claims.filter(
    (claim) => claim.reviewStatus === "PENDING" && claim.evidence.length > 0,
  );
  const unresolvedEvidence = props.claims.some(
    (claim) => claim.evidence.length === 0 || claim.reviewStatus !== "APPROVED",
  );
  const publishBlocked = unresolvedEvidence || !props.media.rightsAttested;
  const rightsReady = Boolean(
    props.media.sourceRole
      && props.media.rightsBasis
      && !["unknown", "blocked"].includes(props.media.rightsBasis),
  );

  /** 긴 사유 문장은 결정 액션 근처에 두고, 고정 바에는 짧은 상태만 남긴다. */
  const blockers: string[] = [];
  if (unresolvedEvidence) blockers.push("근거 미승인");
  if (!props.media.rightsAttested) blockers.push("권리 미확인");
  if (!rightsReady) blockers.push("권리 근거 미저장");

  const evidenceSegmentIds = new Set(
    props.claims.flatMap((claim) => claim.evidence.map((item) => item.segmentId).filter((id): id is string => Boolean(id))),
  );
  const stageIndex = STAGES.indexOf(props.candidate.reviewStatus as Stage);

  return (
    <div className="space-y-6">
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`rounded-lg p-3 text-base ${
            message.kind === "error"
              ? "bg-safety-red-bg text-safety-red"
              : "bg-safety-green-bg text-safety-green"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{props.candidate.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {props.candidate.memeType} · {STATUS_LABEL[props.candidate.reviewStatus]}
              {props.candidate.overallConfidence === null
                ? ""
                : ` · 자동 분석 참고값 ${Math.round(props.candidate.overallConfidence * 100)}%`}
            </p>
          </div>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
            {props.media.rightsMode}
          </span>
        </div>

        <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs" aria-label="검수 단계">
          {STAGES.map((stage, index) => {
            const current = index === stageIndex;
            return (
              <li key={stage} className="flex items-center gap-2">
                <span
                  aria-current={current ? "step" : undefined}
                  className={`rounded-full px-3 py-1 font-semibold ${
                    current ? "bg-accent-strong text-white" : "bg-surface-2 text-muted"
                  }`}
                >
                  {STATUS_LABEL[stage]}
                </span>
                {index < STAGES.length - 1 && <span aria-hidden="true" className="text-muted">→</span>}
              </li>
            );
          })}
        </ol>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="출처 제목" value={props.media.sourceTitle ?? "없음"} />
          <Field label="작성자" value={props.media.authorName ?? "없음"} />
          <Field label="링크 상태" value={props.media.availabilityStatus ?? "미확인"} />
          <Field label="미디어" value={[props.media.mimeType, props.media.dimensions].filter(Boolean).join(" · ") || "없음"} />
        </dl>
        {props.media.sourceUrl && (
          <a
            href={props.media.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex min-h-11 items-center break-all text-sm text-accent-text underline"
          >
            공식 출처 열기
          </a>
        )}
        <MpeReviewTransparency
          draft={props.candidate.draft}
          confidence={props.candidate.overallConfidence}
        />
      </section>

      {/* 검수 진행도·막힌 이유·큐 이동은 스크롤 위치와 무관하게 항상 보이게 둔다. */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {STATUS_LABEL[props.candidate.reviewStatus]}
                <span className="ml-2 font-normal text-muted">{props.candidate.title}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                근거 {approvedClaims}/{props.claims.length} 승인
                {props.claims.length === 0 ? " · 근거 초안이 아직 없어요" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <QueueLink href={props.queue?.previousId} label="이전 후보" />
              <QueueLink href={props.queue?.nextId} label="다음 후보" />
              <Link
                href="/admin/mpe"
                className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold"
              >
                검수 큐
              </Link>
            </div>
          </div>
          {blockers.length > 0 && (
            <p className="mt-2 text-sm text-safety-yellow">
              다음 단계 진행 불가 · {blockers.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">근거 연결 주장</h2>
            <p className="mt-1 text-sm text-muted">
              주장을 옆 근거와 대조해 주세요. 근거가 없거나 다르면 반려하고, 문구가 어긋나면 문구를 고쳐 주세요.
            </p>
          </div>
          {pendingClaims.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={approveRemainingClaims}
              className="min-h-11 rounded-lg border border-safety-green bg-safety-green-bg px-3 font-semibold text-safety-green disabled:opacity-50"
            >
              남은 근거 {pendingClaims.length}건 모두 승인
            </button>
          )}
        </div>

        {props.claims.length === 0 ? (
          <p className="mt-4 rounded-lg bg-surface-2 p-4 text-sm text-muted">
            근거 초안이 아직 없어요. 처리 작업이 끝난 뒤 초안을 생성해야 해요.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {props.claims.map((claim) => {
              const segmentIds = claim.evidence
                .map((item) => item.segmentId)
                .filter((id): id is string => Boolean(id));
              const claimable = props.candidate.reviewStatus === "FACT_CHECKING"
                && claim.reviewStatus === "PENDING"
                && claim.evidence.length > 0;
              return (
                <li
                  key={claim.id}
                  onMouseEnter={() => setActiveSegmentId(segmentIds[0] ?? null)}
                  onMouseLeave={() => setActiveSegmentId(null)}
                  onFocus={() => setActiveSegmentId(segmentIds[0] ?? null)}
                  onBlur={() => setActiveSegmentId(null)}
                  className="rounded-lg border border-border bg-surface-2 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted">
                      {claim.field} · {CLAIM_STATUS_LABEL[claim.reviewStatus] ?? claim.reviewStatus}
                    </p>
                    <p
                      className="text-xs text-muted"
                      title="모델이 스스로 매긴 참고 신호예요. 검증된 정확도가 아니에요."
                    >
                      자동 분석 참고 {Math.round(claim.confidence * 100)}%
                    </p>
                  </div>

                  <div className="mt-2 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                      <p className="text-xs font-semibold text-muted">주장</p>
                      <p className="mt-1 whitespace-pre-wrap text-base">{claim.text}</p>
                      {editingClaimId === claim.id ? (
                        <div className="mt-3 space-y-2">
                          <label className="block">
                            <span className="mb-1 block text-sm font-medium">{claim.field} 문구 수정</span>
                            <textarea
                              aria-label={`${claim.field} 문구 수정`}
                              value={editingText}
                              onChange={(event) => setEditingText(event.target.value)}
                              rows={3}
                              className="w-full rounded-lg border border-border bg-background p-3 text-base"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={pending || !editingText.trim()}
                              onClick={() => saveClaimText(claim.id)}
                              className="min-h-11 rounded-lg border border-accent bg-accent-soft px-3 font-semibold text-accent disabled:opacity-50"
                            >
                              문구 저장
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setEditingClaimId(null)}
                              className="min-h-11 rounded-lg border border-border bg-background px-3 font-semibold disabled:opacity-50"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={pending || editingClaimId !== null}
                          onClick={() => { setEditingClaimId(claim.id); setEditingText(claim.text); }}
                          className="mt-3 min-h-11 rounded-lg border border-border bg-background px-3 text-sm font-semibold disabled:opacity-50"
                        >
                          문구 수정
                        </button>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-muted">
                        근거 {claim.evidence.length ? `${claim.evidence.length}건` : "없음"}
                      </p>
                      {claim.evidence.length === 0 ? (
                        <p className="mt-1 text-sm text-safety-yellow">
                          연결된 근거가 없어 승인할 수 없어요.
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-2">
                          {claim.evidence.map((item) => (
                            <li key={`${claim.id}:${item.kind}:${item.segmentId ?? item.url}`} className="rounded-md border border-border bg-background p-2 text-sm">
                              <p className="text-xs font-semibold text-muted">
                                {item.kind === "text_segment"
                                  ? `${item.origin} ${timecode(item.startMs)}`
                                  : "출처 링크"}
                              </p>
                              {item.kind === "text_segment"
                                ? <p className="mt-1 whitespace-pre-wrap break-words">{item.text}</p>
                                : (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="mt-1 inline-flex min-h-11 items-center break-all text-accent-text underline"
                                  >
                                    {item.url}
                                  </a>
                                )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {claimable && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => reviewMpeClaim({ candidateId: props.candidate.id, claimId: claim.id, decision: "APPROVED" }), "주장 근거를 승인했어요.")}
                        className="min-h-11 rounded-lg border border-safety-green bg-safety-green-bg px-3 font-semibold text-safety-green disabled:opacity-50"
                      >
                        근거 승인
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => reviewMpeClaim({ candidateId: props.candidate.id, claimId: claim.id, decision: "REJECTED" }), "주장 근거를 반려했어요.")}
                        className="min-h-11 rounded-lg border border-safety-red bg-safety-red-bg px-3 font-semibold text-safety-red disabled:opacity-50"
                      >
                        근거 반려
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">미디어·근거 원문</h2>
        <p className="mt-1 text-sm text-muted">
          주장에 마우스를 올리면 그 근거가 있는 구간이 아래에서 함께 강조돼요.
        </p>
        <h3 className="mt-4 font-semibold">ASR · OCR 타임라인</h3>
        <ol className="mt-3 space-y-2">
          {props.timeline.map((segment) => {
            const cited = evidenceSegmentIds.has(segment.id);
            return (
              <li
                key={segment.id}
                className={`rounded-md border-l-2 pl-3 ${
                  activeSegmentId === segment.id
                    ? "border-accent bg-accent-soft"
                    : cited ? "border-accent/50" : "border-border"
                }`}
              >
                <p className="text-xs font-semibold text-muted">
                  {timecode(segment.startMs)} · {segment.origin}
                  {segment.confidence === null ? "" : ` · ${Math.round(segment.confidence * 100)}%`}
                  {cited ? " · 주장 근거로 인용" : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-base">{segment.text}</p>
              </li>
            );
          })}
        </ol>
        <h3 className="mt-6 font-semibold">대표 프레임·산출물 참조</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {props.artifacts.map((artifact) => (
            <li key={artifact.id} className="rounded-lg bg-surface-2 p-3">
              {artifact.representative ? "대표 · " : ""}{artifact.kind} · {timecode(artifact.frameMs)}
              {artifact.signedUrl && artifact.mimeType?.startsWith("image/") ? (
                <Image unoptimized src={artifact.signedUrl} alt={`${timecode(artifact.frameMs)} ${artifact.representative ? "대표 " : ""}프레임`} width={640} height={360} className="mt-2 h-auto max-h-96 w-auto max-w-full rounded-lg border border-border object-contain" />
              ) : (
                <code className="mt-1 block break-all text-xs text-muted">{artifact.reference}</code>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">권리 확인</h2>
        <div className="mt-3 grid gap-3 rounded-lg bg-surface-2 p-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">출처 역할</span>
            <select aria-label="출처 역할" value={sourceRole} onChange={(event) => setSourceRole(event.target.value as SourceRole | "")} className="min-h-11 w-full rounded-lg border border-border bg-background px-3">
              <option value="">선택하세요</option>
              {SOURCE_ROLES.map((value) => <option key={value} value={value}>{SOURCE_ROLE_LABELS[value]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">권리 근거</span>
            <select aria-label="권리 근거" value={rightsBasis} onChange={(event) => setRightsBasis(event.target.value as RightsBasis | "")} className="min-h-11 w-full rounded-lg border border-border bg-background px-3">
              <option value="">선택하세요</option>
              {RIGHTS_BASIS.map((value) => <option key={value} value={value}>{RIGHTS_BASIS_LABELS[value]}</option>)}
            </select>
          </label>
          <button type="button" disabled={pending} onClick={saveSourceRights} className="min-h-11 rounded-lg border border-border bg-background px-4 font-semibold disabled:opacity-50 sm:col-span-2">출처·권리 저장</button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <div>
          <h2 className="text-lg font-semibold">초안 수정·검수</h2>
          <p className="mt-1 text-sm text-muted">
            모델 {props.candidate.modelVersion ?? "미기록"} · 프롬프트 {props.candidate.promptVersion ?? "미기록"}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">검수 메모</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background p-3 text-base" />
        </label>
        <div className="flex flex-wrap gap-2">
          {props.candidate.reviewStatus === "FACT_CHECKING" && (
            <button type="button" disabled={pending || unresolvedEvidence} onClick={() => review("APPROVED")} className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:opacity-50">사실 검수 승인</button>
          )}
          {props.candidate.reviewStatus === "RIGHTS_CHECKING" && (
            <button type="button" disabled={pending || !props.media.rightsAttested || !rightsReady} onClick={() => review("APPROVED")} className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:opacity-50">권리 검수 승인</button>
          )}
          {props.candidate.reviewStatus === "PUBLISH" && (
            <>
              <button type="button" disabled={pending || publishBlocked || !rightsReady} onClick={() => review("PUBLISHED")} className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:opacity-50">공개</button>
              <button type="button" disabled={pending || publishBlocked || !rightsReady} onClick={() => review("LIMITED")} className="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 font-semibold text-safety-yellow disabled:opacity-50">제한 공개</button>
            </>
          )}
          {isStage(props.candidate.reviewStatus) && (
            <button type="button" disabled={pending} onClick={() => review("CHANGES_REQUESTED")} className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 font-semibold disabled:opacity-50">수정 요청</button>
          )}
          {isStage(props.candidate.reviewStatus) && (
            <button type="button" disabled={pending} onClick={() => review("REJECTED")} className="min-h-11 rounded-lg border border-safety-red bg-safety-red-bg px-4 font-semibold text-safety-red disabled:opacity-50">반려</button>
          )}
        </div>
        {unresolvedEvidence && <p className="text-sm text-safety-yellow">승인된 근거가 없는 주장이 있어 다음 단계로 진행할 수 없어요.</p>}
        {!props.media.rightsAttested && <p className="text-sm text-safety-yellow">권리 근거가 확인되지 않아 권리 승인·공개를 진행할 수 없어요.</p>}
        {!rightsReady && <p className="text-sm text-safety-yellow">출처 역할과 승인 가능한 권리 근거를 저장해야 권리 승인·공개를 진행할 수 있어요.</p>}
      </section>

      <details className="rounded-xl border border-border bg-surface p-5">
        <summary className="min-h-11 cursor-pointer text-lg font-semibold">
          처리 작업 <span className="text-sm font-normal text-muted">{props.jobs.length}건</span>
        </summary>
        <ul className="mt-3 space-y-2">
          {props.jobs.map((job) => (
            <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm">
              <span>
                <strong>{job.jobType}</strong> · {job.status} · 시도 {job.attempts}회
                {job.processor ? ` · ${job.processor}` : ""}
                {job.errorCode ? ` · ${job.errorCode}` : ""}
              </span>
              {job.canReprocess && (
                <div className="flex flex-wrap items-center gap-2">
                  {confirmReprocessId === job.id ? (
                    <>
                      <span className="text-xs text-safety-yellow">
                        근거 승인과 검수 단계가 초기화돼요. 계속할까요?
                      </span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setConfirmReprocessId(null);
                          run(() => reprocessMpeJob({ jobId: job.id }), "재처리를 등록하고 기존 근거 승인과 검수 단계를 초기화했어요.");
                        }}
                        className="min-h-11 rounded-lg border border-safety-red bg-safety-red-bg px-3 font-semibold text-safety-red disabled:opacity-50"
                      >
                        초기화 후 재처리
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirmReprocessId(null)}
                        className="min-h-11 rounded-lg border border-border bg-background px-3 font-semibold disabled:opacity-50"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirmReprocessId(job.id)}
                      className="min-h-11 rounded-lg border border-border bg-background px-3 font-semibold disabled:opacity-50"
                    >
                      재처리
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </details>

      <details className="rounded-xl border border-border bg-surface p-5">
        <summary className="min-h-11 cursor-pointer text-lg font-semibold">
          유사 밈 상위 5개 <span className="text-sm font-normal text-muted">{props.matches.length}건</span>
        </summary>
        <ol className="mt-3 space-y-2">
          {props.matches.slice(0, 5).map((match) => (
            <li key={match.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm">
              <span>{match.targetTitle} · {match.relation}</span>
              <strong>{Math.round(match.score * 100)}%</strong>
            </li>
          ))}
        </ol>
      </details>

      <details className="rounded-xl border border-border bg-surface p-5">
        <summary className="min-h-11 cursor-pointer text-lg font-semibold">
          초안 JSON·수정 이력 <span className="text-sm font-normal text-muted">{props.revisions.length}건</span>
        </summary>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">편집 초안 JSON</span>
          <textarea
            aria-label="편집 초안 JSON"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={12}
            className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm"
          />
        </label>
        <button type="button" disabled={pending} onClick={saveRevision} className="mt-3 min-h-11 rounded-lg border border-border bg-surface-2 px-4 font-semibold disabled:opacity-50">
          수정 이력 저장
        </button>
        {props.revisions.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold">수정 전·후 이력</h3>
            <div className="mt-2 grid gap-3 lg:grid-cols-2">
              {props.revisions.slice(0, 2).map((revision) => (
                <article key={revision.id} className="rounded-lg bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-muted">
                    revision {revision.revisionNumber} · {revision.modelVersion} · {revision.promptVersion}
                  </p>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(revision.draft, null, 2)}</pre>
                </article>
              ))}
            </div>
          </div>
        )}
      </details>
    </div>
  );
}

function QueueLink({ href, label }: { href?: string | null; label: string }) {
  if (!href) {
    return (
      <span className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold text-muted opacity-60">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/admin/mpe/${href}`}
      className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 text-sm font-semibold hover:border-accent"
    >
      {label}
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>;
}