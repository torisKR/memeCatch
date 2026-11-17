"use client";

import { useId, useState } from "react";
import { MemeEmbed } from "@/components/meme-embed";
import {
  relatedVideoSourceUrl,
  type RelatedVideoContent,
} from "@/lib/related-videos";
import { SOURCE_PLATFORM_META, sourcePlatformFromReference } from "@/lib/source-platform";

const INITIAL_VIDEO_COUNT = 4;
const EXTRA_VIDEO_BATCH_COUNT = 4;

export function RelatedVideoList({
  contents,
  title,
}: {
  contents: readonly RelatedVideoContent[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [mountedExtraCount, setMountedExtraCount] = useState(0);
  const extraRegionId = useId();
  const initialContents = contents.slice(0, INITIAL_VIDEO_COUNT);
  const extraContents = contents.slice(INITIAL_VIDEO_COUNT);
  const mountedExtraContents = open
    ? extraContents.slice(0, mountedExtraCount)
    : [];
  const linkedExtraContents = open
    ? extraContents.slice(mountedExtraCount)
    : extraContents;
  const nextBatchCount = Math.min(
    EXTRA_VIDEO_BATCH_COUNT,
    linkedExtraContents.length,
  );

  return (
    <>
      <div className="grid gap-4">
        {initialContents.map((content) => (
          <MemeEmbed
            key={content.id}
            content={content}
            title={title}
            isRepresentative={false}
          />
        ))}
      </div>

      {extraContents.length > 0 && (
        <details
          className="group rounded-xl border border-border bg-surface-2"
          onToggle={(event) => {
            const nextOpen = event.currentTarget.open;
            setOpen(nextOpen);
            setMountedExtraCount(nextOpen ? EXTRA_VIDEO_BATCH_COUNT : 0);
          }}
        >
          <summary
            aria-controls={extraRegionId}
            className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"
          >
            <span>
              관련 영상 {extraContents.length.toLocaleString("ko-KR")}개 더 보기
            </span>
            <span aria-hidden className="text-muted transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div id={extraRegionId} className="grid gap-4 border-t border-border p-4">
            {mountedExtraContents.map((content) => (
              <MemeEmbed
                key={content.id}
                content={content}
                title={title}
                isRepresentative={false}
              />
            ))}
            {linkedExtraContents.map((content, index) => {
              const sourceUrl = relatedVideoSourceUrl(content);
              if (!sourceUrl) return null;
              const platform = sourcePlatformFromReference(content);
              const platformLabel = platform ? SOURCE_PLATFORM_META[platform].label : "영상";
              return (
                <a
                  key={content.id}
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold hover:border-accent/50 hover:text-accent-text"
                >
                  <span>
                    {platformLabel} 관련 영상{" "}
                    {mountedExtraCount + index + INITIAL_VIDEO_COUNT + 1}
                  </span>
                  <span aria-hidden>↗</span>
                </a>
              );
            })}
            {open && nextBatchCount > 0 && (
              <button
                type="button"
                aria-controls={extraRegionId}
                onClick={() => {
                  setMountedExtraCount((count) =>
                    Math.min(count + EXTRA_VIDEO_BATCH_COUNT, extraContents.length),
                  );
                }}
                className="min-h-11 rounded-lg border border-accent/40 bg-surface px-4 py-3 text-sm font-bold text-accent-text hover:border-accent"
              >
                관련 영상 {nextBatchCount.toLocaleString("ko-KR")}개 더 재생하기
              </button>
            )}
          </div>
        </details>
      )}
    </>
  );
}
