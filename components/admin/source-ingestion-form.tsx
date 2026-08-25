"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SourceIngestionMeme = {
  id: string;
  title: string;
  short_id: string;
};

type IngestionData = {
  status: string;
  platform: string;
  canonicalUrl: string;
  rightsMode: string;
  duplicate: boolean;
};

function ingestionData(payload: unknown): IngestionData | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.ok !== true) return null;
  const candidate = record.data;
  if (!candidate || typeof candidate !== "object") return null;
  const data = candidate as Record<string, unknown>;
  if (
    typeof data.status !== "string" ||
    typeof data.platform !== "string" ||
    typeof data.canonicalUrl !== "string" ||
    typeof data.rightsMode !== "string" ||
    typeof data.duplicate !== "boolean"
  ) return null;
  return data as IngestionData;
}

function ingestionError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as Record<string, unknown>).error;
  return typeof error === "string" ? error : null;
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
};

const RIGHTS_MODE_LABELS: Record<string, string> = {
  METADATA_ONLY: "메타데이터 전용",
  official_embed: "공식 임베드",
  api_metadata: "API 메타데이터",
  link_only: "링크 전용",
};

function statusLabel(result: IngestionData) {
  if (result.duplicate || result.status === "duplicate") return "중복";
  if (result.status === "metadata_ready") return "메타데이터 준비";
  return "검수 대기";
}

export function SourceIngestionForm({ memes }: { memes: SourceIngestionMeme[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [targetMemeId, setTargetMemeId] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<IngestionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/source-ingestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, targetMemeId }),
      });
      const payload: unknown = await response.json();
      const data = ingestionData(payload);

      if (!response.ok || !data) {
        setError(ingestionError(payload) ?? "출처를 수집하지 못했어요.");
        return;
      }

      setResult(data);
      setUrl("");
      router.refresh();
    } catch {
      setError("출처를 수집하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="source-ingestion-heading">
      <div>
        <h2 id="source-ingestion-heading" className="text-lg font-semibold">
          SNS 출처 수집
        </h2>
        <p className="mt-1 text-sm text-muted">
          지원하는 SNS URL을 기존 밈에 연결하면 정규화·중복 확인 후 검수 대기열에 추가합니다.
        </p>
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)_auto] lg:items-end">
        <label className="block">
          <span className="mb-1 block text-base font-medium">SNS URL</span>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            required
            autoComplete="url"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-base font-medium">연결할 밈</span>
          <select
            value={targetMemeId}
            onChange={(event) => setTargetMemeId(event.target.value)}
            required
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
          >
            <option value="">밈을 선택하세요</option>
            {memes.map((meme) => (
              <option key={meme.id} value={meme.id}>
                {meme.title} ({meme.short_id})
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={pending || memes.length === 0}
          className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "수집 중…" : "검수 후보 만들기"}
        </button>
      </form>

      {memes.length === 0 && (
        <p role="status" className="mt-3 text-sm text-muted">
          연결할 밈이 없어 출처를 수집할 수 없어요.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-safety-red-bg p-3 text-sm text-safety-red">
          {error}
        </p>
      )}

      {result && (
        <div role="status" className="mt-4 rounded-lg bg-safety-green-bg p-3 text-sm text-safety-green">
          <p className="font-semibold">
            {result.duplicate ? "이미 등록된 출처예요." : "검수 대기에 추가했어요."}
          </p>
          <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
            <dt>플랫폼</dt>
            <dd>{PLATFORM_LABELS[result.platform] ?? result.platform}</dd>
            <dt>권리 모드</dt>
            <dd>{RIGHTS_MODE_LABELS[result.rightsMode] ?? result.rightsMode}</dd>
            <dt>상태</dt>
            <dd>{statusLabel(result)}</dd>
            <dt>정규 URL</dt>
            <dd className="min-w-0">
              <a
                href={result.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-accent-text underline underline-offset-2"
              >
                {result.canonicalUrl}
              </a>
            </dd>
          </dl>
        </div>
      )}
    </section>
  );
}
