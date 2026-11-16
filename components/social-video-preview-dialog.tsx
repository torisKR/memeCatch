"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { SocialVideoPreview } from "@/lib/meme-video-preview";

function previewCopy(locale: Locale, platform: SocialVideoPreview["platform"]) {
  const provider = platform === "tiktok" ? "TikTok" : "Instagram";
  if (locale === "ko") {
    return {
      button: `${provider} 영상 미리보기`,
      title: `${provider} 공식 영상 미리보기`,
      privacy: "선택한 공식 플레이어에서 재생할 수 있어요.",
      close: "미리보기 닫기",
      source: `${provider}에서 원본 열기`,
    };
  }
  return {
    button: `Preview ${provider} video`,
    title: `Official ${provider} video preview`,
    privacy: "Play the post in the official embedded player.",
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copy = previewCopy(locale, preview.platform);
  const labelId = useId();

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, [active]);

  function close() {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    setActive(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setActive(true)}
        aria-haspopup="dialog"
        aria-label={`${title} · ${copy.button}`}
        className="absolute right-2 top-2 z-10 inline-flex size-11 items-center justify-center rounded-full border border-white/70 bg-black/75 text-sm font-bold text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span aria-hidden>▶</span>
        <span className="sr-only">{copy.button}</span>
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setActive(false)}
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
            <iframe
              src={preview.embedUrl}
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
