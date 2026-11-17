"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { SocialVideoPreview } from "@/lib/meme-video-preview";

function previewCopy(locale: Locale, platform: SocialVideoPreview["platform"]) {
  const provider = platform === "tiktok" ? "TikTok" : "Instagram";
  if (locale === "ko") {
    return {
      provider,
      button: `${provider} 영상 미리보기`,
      title: `${provider} 공식 영상 미리보기`,
      privacy: "선택한 공식 플레이어에서 재생할 수 있어요.",
      unavailable: "이 영상은 현재 재생할 수 없어요.",
      close: "미리보기 닫기",
      source: `${provider}에서 원본 열기`,
    };
  }
  return {
    provider,
    button: `Preview ${provider} video`,
    title: `Official ${provider} video preview`,
    privacy: "Play the post in the official embedded player.",
    unavailable: "This video cannot be played right now.",
    close: "Close preview",
    source: `Open original on ${provider}`,
  };
}

export function SocialVideoPreviewDialog({
  preview,
  title,
  locale,
}: {
  preview: SocialVideoPreview;
  title: string;
  locale: Locale;
}) {
  const [active, setActive] = useState(false);
  const [unavailablePreview, setUnavailablePreview] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const copy = previewCopy(locale, preview.platform);
  const labelId = useId();
  const previewKey = [
    preview.platform,
    preview.contentId,
    preview.sourceUrl,
    preview.embedUrl,
  ].join("\n");
  const playerUnavailable =
    preview.platform === "tiktok" && unavailablePreview === previewKey;

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, [active]);

  useEffect(() => {
    if (!active || preview.platform !== "tiktok" || playerUnavailable) return;
    const frame = playerRef.current;
    if (!frame) return;

    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.tiktok.com" ||
        event.source !== frame.contentWindow
      ) return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const message = data as {
        "x-tiktok-player"?: unknown;
        type?: unknown;
        value?: unknown;
      };
      if (
        message["x-tiktok-player"] !== true ||
        message.type !== "onPlayerError" ||
        !message.value ||
        typeof message.value !== "object" ||
        Array.isArray(message.value)
      ) return;
      const value = message.value as { errorCode?: unknown; errorType?: unknown };
      if (value.errorCode === 1001 && value.errorType === "INVALID_VIDEO") {
        setUnavailablePreview(previewKey);
      }
    };

    window.addEventListener("message", onMessage);
    // Subscribe before the real navigation so the player's first error event
    // cannot race hydration/effect registration.
    frame.src = preview.embedUrl;
    return () => window.removeEventListener("message", onMessage);
  }, [active, playerUnavailable, preview.embedUrl, preview.platform, previewKey]);

  function open() {
    setUnavailablePreview(null);
    setActive(true);
  }

  function close() {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    setUnavailablePreview(null);
    setActive(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={`${title} · ${copy.button}`}
        className="absolute right-2 top-2 z-10 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/70 bg-black/75 px-2.5 text-sm font-bold text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span aria-hidden className="inline-flex items-center gap-1.5 leading-none">
          <span className="text-xs">▶</span>
          <span className="text-xs font-semibold">{copy.provider}</span>
        </span>
        <span className="sr-only">{copy.button}</span>
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => {
          setUnavailablePreview(null);
          setActive(false);
        }}
        aria-labelledby={active ? labelId : undefined}
        className="m-auto w-[min(94vw,620px)] max-w-none rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/70"
      >
        {active ? (
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={labelId} className="text-lg font-extrabold">{copy.title}</h2>
                <p className="mt-1 text-sm text-muted">{copy.privacy}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={copy.close}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-xl font-bold hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            {playerUnavailable ? (
              <div className="mx-auto flex min-h-32 w-full max-w-[382px] items-center justify-center rounded-xl border border-border bg-surface-2 p-5 text-center">
                <p role="alert" className="text-sm text-muted">{copy.unavailable}</p>
              </div>
            ) : (
              <iframe
                ref={playerRef}
                src={preview.platform === "tiktok" ? "about:blank" : preview.embedUrl}
                title={`${title} — ${copy.title}`}
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className={`mx-auto block w-full rounded-xl border border-border bg-white ${
                  preview.platform === "tiktok"
                    ? "h-[min(72svh,680px)] max-w-[382px]"
                    : "h-[min(72svh,720px)] max-w-[540px]"
                }`}
              />
            )}
            <a
              href={preview.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-muted underline underline-offset-4 hover:text-foreground focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {copy.source} <span aria-hidden>↗</span>
            </a>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
