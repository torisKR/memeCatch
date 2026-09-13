"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
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
    evidence: string[];
  }>;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    draft: Record<string, unknown>;
    modelVersion: string;
    promptVersion: string;
    createdAt: string;
  }>;
};

const STATUS_LABEL: Record<MpeReviewStatus, string> = {
  FACT_CHECKING: "사실 검수",
  RIGHTS_CHECKING: "권리 검수",
  PUBLISH: "공개 결정",
  APPROVED: "공개 승인",
  LIMITED: "제한 공개",
  REJECTED: "반려",
};

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

  function saveRevision() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft) as Record<string, unknown>;
    } catch {
      setMessage({ kind: "error", text: "초안 JSON 형식을 확인해 주세요." });
      return;
    }
    run(
      () => saveMpeCandidateRevision({ candidateId: props.candidate.id, draft: parsed }),
      "수정 전·후 초안 이력을 저장했어요.",
    );
  }

  function review(decision: "APPROVED" | "PUBLISHED" | "LIMITED" | "REJECTED" | "CHANGES_REQUESTED") {
    run(
      () =>
        reviewMpeCandidate({
          candidateId: props.candidate.id,
          stage: props.candidate.reviewStatus as "FACT_CHECKING" | "RIGHTS_CHECKING" | "PUBLISH",
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

  const unresolvedEvidence = props.claims.some(
    (claim) => claim.evidence.length === 0 || claim.reviewStatus !== "APPROVED",
  );
  const publishBlocked = unresolvedEvidence || !props.media.rightsAttested;
  const rightsReady = Boolean(
    props.media.sourceRole
      && props.media.rightsBasis
      && !["unknown", "blocked"].includes(props.media.rightsBasis),
  );

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
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

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">처리 작업</h2>
        <ul className="mt-3 space-y-2">
          {props.jobs.map((job) => (
            <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm">
              <span>
                <strong>{job.jobType}</strong> · {job.status} · 시도 {job.attempts}회
                {job.processor ? ` · ${job.processor}` : ""}
                {job.errorCode ? ` · ${job.errorCode}` : ""}
              </span>
              {job.canReprocess && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => reprocessMpeJob({ jobId: job.id }), "재처리를 등록하고 기존 근거 승인과 검수 단계를 초기화했어요.")}
                  className="min-h-11 rounded-lg border border-border bg-background px-3 font-semibold disabled:opacity-50"
                >
                  재처리
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">ASR · OCR 타임라인</h2>
          <ol className="mt-4 space-y-3">
            {props.timeline.map((segment) => (
              <li key={segment.id} className="border-l-2 border-accent pl-4">
                <p className="text-xs font-semibold text-muted">
                  {timecode(segment.startMs)} · {segment.origin}
                  {segment.confidence === null ? "" : ` · ${Math.round(segment.confidence * 100)}%`}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-base">{segment.text}</p>
              </li>
            ))}
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
          <h2 className="text-lg font-semibold">유사 밈 상위 5개</h2>
          <ol className="mt-3 space-y-2">
            {props.matches.slice(0, 5).map((match) => (
              <li key={match.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm">
                <span>{match.targetTitle} · {match.relation}</span>
                <strong>{Math.round(match.score * 100)}%</strong>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">근거 연결 주장</h2>
        <ul className="mt-3 space-y-3">
          {props.claims.map((claim) => (
            <li key={claim.id} className="rounded-lg bg-surface-2 p-4">
              <p className="text-xs font-semibold text-muted">{claim.field} · {claim.reviewStatus} · {Math.round(claim.confidence * 100)}%</p>
              <p className="mt-1 text-base">{claim.text}</p>
              <p className="mt-2 text-xs text-muted">근거: {claim.evidence.length ? claim.evidence.join(", ") : "없음"}</p>
              {props.candidate.reviewStatus === "FACT_CHECKING" && claim.evidence.length > 0 && claim.reviewStatus === "PENDING" && (
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={pending} onClick={() => run(() => reviewMpeClaim({ candidateId: props.candidate.id, claimId: claim.id, decision: "APPROVED" }), "주장 근거를 승인했어요.")} className="min-h-11 rounded-lg border border-safety-green bg-safety-green-bg px-3 font-semibold text-safety-green disabled:opacity-50">근거 승인</button>
                  <button type="button" disabled={pending} onClick={() => run(() => reviewMpeClaim({ candidateId: props.candidate.id, claimId: claim.id, decision: "REJECTED" }), "주장 근거를 반려했어요.")} className="min-h-11 rounded-lg border border-safety-red bg-safety-red-bg px-3 font-semibold text-safety-red disabled:opacity-50">근거 반려</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <div>
          <h2 className="text-lg font-semibold">초안 수정·검수</h2>
          <p className="mt-1 text-sm text-muted">
            모델 {props.candidate.modelVersion ?? "미기록"} · 프롬프트 {props.candidate.promptVersion ?? "미기록"}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">편집 초안 JSON</span>
          <textarea
            aria-label="편집 초안 JSON"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={12}
            className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm"
          />
        </label>
        <div className="grid gap-3 rounded-lg bg-surface-2 p-4 sm:grid-cols-2">
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
        <button type="button" disabled={pending} onClick={saveRevision} className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 font-semibold disabled:opacity-50">
          수정 이력 저장
        </button>
        {props.revisions.length > 0 && (
          <div>
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
          {(["FACT_CHECKING", "RIGHTS_CHECKING"] as const).includes(props.candidate.reviewStatus as "FACT_CHECKING" | "RIGHTS_CHECKING") && (
            <button type="button" disabled={pending} onClick={() => review("CHANGES_REQUESTED")} className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 font-semibold disabled:opacity-50">수정 요청</button>
          )}
          {(["FACT_CHECKING", "RIGHTS_CHECKING", "PUBLISH"] as const).includes(props.candidate.reviewStatus as "FACT_CHECKING" | "RIGHTS_CHECKING" | "PUBLISH") && (
            <button type="button" disabled={pending} onClick={() => review("REJECTED")} className="min-h-11 rounded-lg border border-safety-red bg-safety-red-bg px-4 font-semibold text-safety-red disabled:opacity-50">반려</button>
          )}
        </div>
        {unresolvedEvidence && <p className="text-sm text-safety-yellow">승인된 근거가 없는 주장이 있어 다음 단계를 진행할 수 없어요.</p>}
        {!props.media.rightsAttested && <p className="text-sm text-safety-yellow">권리 근거가 확인되지 않아 권리 승인·공개를 진행할 수 없어요.</p>}
        {!rightsReady && <p className="text-sm text-safety-yellow">출처 역할과 승인 가능한 권리 근거를 저장해야 권리 승인·공개를 진행할 수 있어요.</p>}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>;
}
