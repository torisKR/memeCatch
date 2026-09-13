"use client";

import { useState } from "react";
import type { SourceAcquisitionRecoveryDto } from "@/lib/sources/recovery.server";

type RecoveryMeme = { readonly id: string; readonly title: string; readonly short_id: string };

type Props = {
  readonly entries: readonly SourceAcquisitionRecoveryDto[];
  readonly memes: readonly RecoveryMeme[];
  readonly now?: number;
  readonly loadError?: string | null;
};

function recoveryState(entry: SourceAcquisitionRecoveryDto, now: number): "due" | "deferred" | "permanent" {
  if (!entry.lastErrorRetryable || !entry.nextRetryAt) return "permanent";
  return new Date(entry.nextRetryAt).getTime() <= now ? "due" : "deferred";
}

function errorLabel(code: string) {
  const labels: Record<string, string> = {
    provider_transient: "제공자 일시 오류",
    provider_uncertain: "제공자 결과 불확실",
    invalid_url: "URL 형식 오류",
    missing_meme: "연결할 밈 없음",
    metadata_mismatch: "메타데이터 불일치",
    db_failure: "저장 오류",
  };
  return labels[code] ?? "수집 오류";
}

function dateLabel(value: string | null) {
  if (!value) return "없음";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "확인할 수 없음" : date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

export function SourceRecoveryPanel({ entries, memes, now: providedNow, loadError = null }: Props) {
  const [targetByKey, setTargetByKey] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [now] = useState(() => providedNow ?? Date.now());
  async function retry(entry: SourceAcquisitionRecoveryDto) {
    const targetMemeId = targetByKey[entry.sourceKey] ?? "";
    if (!targetMemeId || !entry.canonicalUrl) {
      setMessage({ kind: "error", text: "재시도할 URL과 연결할 밈을 모두 선택해 주세요. 기존 source_id가 없어도 밈을 추측하지 않아요." });
      return;
    }
    if (pendingKey) return;
    setPendingKey(entry.sourceKey);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/source-ingestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: entry.canonicalUrl, targetMemeId, retry: true }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true) {
        setMessage({ kind: "error", text: "수동 재시도를 기록하지 못했어요. 입력과 운영자 권한을 확인해 주세요." });
        return;
      }
      const warning = "warning" in payload && payload.warning === "recovery_resolution_failed";
      setMessage({
        kind: "success",
        text: warning
          ? "출처 재확인은 성공했어요. 다만 이전 복구 기록 정리가 완료되지 않았어요. 이 성공한 요청을 다시 제출하지 말고 상태를 운영자 검토 대상으로 남겨 주세요."
          : "같은 출처를 선택한 밈에 다시 확인 요청했어요. 승인이나 원본 확인을 뜻하지 않아요.",
      });
    } catch {
      setMessage({ kind: "error", text: "수동 재시도에 실패했어요. 네트워크 상태를 확인해 주세요." });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="source-recovery-heading">
      <div>
        <h2 id="source-recovery-heading" className="text-lg font-semibold">출처 수집 복구 상태</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">자동 재시도 예약과 마지막 오류를 보여줘요. 이 상태는 출처 승인이나 원본 확인을 뜻하지 않아요.</p>
      </div>
      {loadError ? (
        <div role="alert" className="mt-4 rounded-lg bg-safety-red-bg p-4 text-sm text-safety-red">
          <p className="font-semibold">복구 상태를 불러오지 못했어요.</p>
          <p className="mt-1">{loadError}</p>
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted">현재 기록된 복구 대상이 없어요.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => {
            const state = recoveryState(entry, now);
            const canRetry = state !== "deferred" && Boolean(entry.canonicalUrl);
            return (
              <li key={entry.sourceKey} className="rounded-lg border border-border bg-surface-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{entry.platform} · {errorLabel(entry.lastErrorCode)}</p>
                    <p className="mt-1 break-all text-sm text-muted">{entry.canonicalUrl ?? entry.sourceKey}</p>
                  </div>
                  <span className="rounded-full bg-background px-3 py-1 text-sm font-semibold">
                    {state === "due" ? "재시도 시점 도래" : state === "deferred" ? "재시도 예약됨" : "자동 재시도 없음"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">시도 횟수</dt><dd>{entry.attemptCount}회</dd></div>
                  <div><dt className="text-muted">마지막 시도</dt><dd>{dateLabel(entry.lastAttemptedAt)}</dd></div>
                  <div><dt className="text-muted">다음 재시도 시각</dt><dd>{entry.nextRetryAt ? dateLabel(entry.nextRetryAt) : "예약 없음"}</dd></div>
                  <div><dt className="text-muted">source_id 연결</dt><dd>{entry.sourceId ? "있음" : "없음"}</dd></div>
                </dl>
                {state === "deferred" && <p className="mt-3 text-sm text-muted">다음 시각은 복구 기록의 예약값이에요. source_id가 없는 기록을 스케줄러가 자동으로 연결하거나 공개하지는 않아요.</p>}
                {state === "permanent" && <p className="mt-3 text-sm text-safety-yellow">영구 오류 또는 결과 불확실 상태라 자동 재시도하지 않아요. URL과 연결할 밈을 운영자가 확인한 뒤 수동 재검토할 수 있어요.</p>}
                {canRetry && (
                  <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="block min-w-0 overflow-hidden text-sm" style={{ width: "100%" }}>
                      <span className="mb-1 block font-medium">재시도 후 연결할 밈</span>
                      <select
                        value={targetByKey[entry.sourceKey] ?? ""}
                        onChange={(event) => setTargetByKey((current) => ({ ...current, [entry.sourceKey]: event.target.value }))}
                        style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
                        className="min-h-11 min-w-0 w-full max-w-full appearance-none rounded-lg border border-border bg-background px-3 text-base"
                      >
                        <option value="">밈을 선택하세요</option>
                        {memes.map((meme) => <option key={meme.id} value={meme.id}>{meme.title} ({meme.short_id})</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={() => void retry(entry)} disabled={pendingKey !== null} className="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      {pendingKey === entry.sourceKey ? "다시 확인 중…" : state === "permanent" ? "수동 재검토" : "수동 재시도"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {message && <p role={message.kind === "error" ? "alert" : "status"} className={`mt-4 rounded-lg p-3 text-sm ${message.kind === "error" ? "bg-safety-red-bg text-safety-red" : "bg-safety-green-bg text-safety-green"}`}>{message.text}</p>}
    </section>
  );
}
