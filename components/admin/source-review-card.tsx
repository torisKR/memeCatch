"use client";

import { useState, useTransition } from "react";
import { reviewMemeSource } from "@/lib/actions/admin-sources";
import {
  RIGHTS_BASIS,
  RIGHTS_BASIS_LABELS,
  SOURCE_ROLES,
  SOURCE_ROLE_LABELS,
  type RightsBasis,
  type SourceRole,
} from "@/lib/sources/review";
import { embedUrlFor, type MediaSourcePlatform } from "@/lib/sources/url";

const EMBED_PLATFORMS: MediaSourcePlatform[] = [
  "youtube",
  "youtube_shorts",
  "tiktok",
  "instagram",
];

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
  broadcast_archive: "방송 아카이브",
  public_archive: "공공 아카이브",
  web: "웹",
};

type Source = {
  id: string;
  platform: string;
  external_id: string | null;
  canonical_url: string;
  title: string | null;
  channel_name: string | null;
  platform_published_at: string | null;
  duration_seconds: number | null;
  public_status: string | null;
  embeddable: boolean | null;
  license_code: string | null;
  thumbnail_url: string | null;
  removed_at: string | null;
};

function formatDuration(seconds: number | null) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SourceReviewCard({
  memeId,
  memeTitle,
  memeOriginYear,
  source,
}: {
  memeId: string;
  memeTitle: string;
  memeOriginYear: number | null;
  source: Source;
}) {
  const [showEmbed, setShowEmbed] = useState(false);
  const [sourceRole, setSourceRole] = useState<SourceRole>("usage_example");
  const [rightsBasis, setRightsBasis] = useState<RightsBasis>("official_embed");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const publishedYear = source.platform_published_at
    ? new Date(source.platform_published_at).getUTCFullYear()
    : null;
  // 업로드가 밈 발생보다 늦으면 원본일 수 없다 — 역할 선택을 안내한다.
  const yearConflict =
    publishedYear != null && memeOriginYear != null && publishedYear > memeOriginYear;

  const embeddablePlatform = EMBED_PLATFORMS.includes(
    source.platform as MediaSourcePlatform,
  );
  const canEmbed =
    embeddablePlatform && source.external_id && source.embeddable !== false;
  const isVerticalEmbed = ["youtube_shorts", "tiktok", "instagram"].includes(
    source.platform,
  );
  const previewClass = isVerticalEmbed
    ? "mx-auto aspect-[9/16] w-full max-w-[320px]"
    : "aspect-video w-full";

  function submit(decision: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      const result = await reviewMemeSource({
        memeId,
        sourceId: source.id,
        decision,
        sourceRole,
        rightsBasis,
        note: note || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(decision === "approve" ? "승인했어요." : "반려했어요.");
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-safety-green">
        {done}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-foreground">
          {PLATFORM_LABELS[source.platform] ?? source.platform}
        </span>
        {source.public_status && <span>공개 상태 {source.public_status}</span>}
        {source.embeddable != null && (
          <span className={source.embeddable ? "text-safety-green" : "text-safety-red"}>
            임베드 {source.embeddable ? "가능" : "불가"}
          </span>
        )}
        {source.license_code && <span>라이선스 {source.license_code}</span>}
        {formatDuration(source.duration_seconds) && (
          <span>{formatDuration(source.duration_seconds)}</span>
        )}
        {source.platform_published_at && (
          <span>
            업로드{" "}
            {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul" }).format(
              new Date(source.platform_published_at),
            )}
          </span>
        )}
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <div>
          {canEmbed && showEmbed ? (
            <iframe
              src={embedUrlFor({
                platform: source.platform as MediaSourcePlatform,
                externalId: source.external_id!,
                canonicalUrl: source.canonical_url,
              })}
              title={source.title ?? `${memeTitle} 출처 영상`}
              className={`${previewClass} rounded-lg border border-border bg-black`}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowEmbed(true)}
              disabled={!canEmbed}
              className={`${previewClass} group relative flex items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 text-sm text-muted hover:opacity-90 disabled:cursor-not-allowed`}
            >
              {source.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={source.thumbnail_url}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {canEmbed ? (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 text-white transition-colors group-hover:bg-black/45">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 shadow-lg">
                    <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13l11-6.5z" />
                    </svg>
                  </span>
                  <span className="rounded-full bg-black/70 px-3 py-1 font-semibold">
                    {PLATFORM_LABELS[source.platform] ?? "SNS"} 영상 재생
                  </span>
                </span>
              ) : (
                <span className="relative rounded-full bg-background/85 px-3 py-1">
                  임베드 미리보기를 사용할 수 없어요
                </span>
              )}
            </button>
          )}
          <a
            href={source.canonical_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block truncate text-xs text-accent hover:underline"
          >
            {source.canonical_url}
          </a>
        </div>

        <div className="space-y-3">
          <div>
            <p className="font-semibold">{source.title ?? "(제목 없음)"}</p>
            {source.channel_name && (
              <p className="text-sm text-muted">{source.channel_name}</p>
            )}
          </div>

          {yearConflict && (
            <p className="rounded-lg bg-safety-yellow/10 px-3 py-2 text-sm text-safety-yellow">
              업로드 연도({publishedYear})가 밈 발생 연도({memeOriginYear})보다 늦어요.
              원본이 아니라 사용 예시·2차 자료일 가능성이 높습니다.
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted">출처 역할</span>
              <select
                value={sourceRole}
                onChange={(e) => setSourceRole(e.target.value as SourceRole)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {SOURCE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {SOURCE_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">권리 근거</span>
              <select
                value={rightsBasis}
                onChange={(e) => setRightsBasis(e.target.value as RightsBasis)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {RIGHTS_BASIS.map((basis) => (
                  <option key={basis} value={basis}>
                    {RIGHTS_BASIS_LABELS[basis]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="검수 메모 (반려 시 필수)"
            maxLength={500}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />

          {error && <p className="text-sm text-safety-red">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => submit("approve")}
              disabled={pending}
              className="rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              승인
            </button>
            <button
              type="button"
              onClick={() => submit("reject")}
              disabled={pending}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-safety-red hover:bg-surface-2 disabled:opacity-50"
            >
              반려
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
