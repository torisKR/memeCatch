"use client";

import { useState } from "react";
import type { SubmitCopy } from "@/lib/i18n-submit";

type PreviewProvider =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "threads";

type PreviewData = {
  provider: PreviewProvider;
  sourceUrl: string;
  embedUrl: string | null;
  embedHtml: string | null;
  contentId: string | null;
  title: string | null;
  authorName: string | null;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading"; url: string }
  | { status: "ready"; url: string; data: PreviewData }
  | { status: "error"; url: string; message: string };

const PROVIDER_NAMES: Record<PreviewProvider, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
};

function detectProvider(rawUrl: string): PreviewProvider | null {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const isHost = (domain: string) =>
      hostname === domain || hostname.endsWith(`.${domain}`);
    if (isHost("youtube.com") || isHost("youtu.be")) return "youtube";
    if (isHost("tiktok.com")) return "tiktok";
    if (isHost("instagram.com")) return "instagram";
    if (isHost("facebook.com") || hostname === "fb.watch") return "facebook";
    if (isHost("threads.net") || isHost("threads.com")) return "threads";
    return null;
  } catch {
    return null;
  }
}

function isTrustedEmbedUrl(provider: PreviewProvider, rawUrl: string | null) {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (provider === "youtube") {
      return (
        url.hostname === "www.youtube-nocookie.com" &&
        url.pathname.startsWith("/embed/")
      );
    }
    if (provider === "tiktok") {
      return (
        url.hostname === "www.tiktok.com" &&
        url.pathname.startsWith("/player/v1/")
      );
    }
    if (provider === "instagram") {
      return (
        url.hostname === "www.instagram.com" &&
        url.pathname.endsWith("/embed/captioned/")
      );
    }
    if (provider === "facebook") {
      return (
        url.hostname === "www.facebook.com" &&
        url.pathname.startsWith("/plugins/")
      );
    }
    return false;
  } catch {
    return false;
  }
}

function threadsDocument(html: string) {
  return `<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style></head><body>${html}</body></html>`;
}

export function ContentUrlPreview({
  url,
  copy,
}: {
  url: string;
  copy: SubmitCopy["preview"];
}) {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  const trimmedUrl = url.trim();
  const provider = detectProvider(trimmedUrl);
  const isCurrent = "url" in state && state.url === trimmedUrl;
  const currentState: PreviewState = isCurrent ? state : { status: "idle" };

  async function checkPreview() {
    if (!provider) return;
    setState({ status: "loading", url: trimmedUrl });
    try {
      const response = await fetch(
        `/api/oembed?url=${encodeURIComponent(trimmedUrl)}`,
      );
      const result = (await response.json()) as
        | PreviewData
        | { error?: string };
      if (!response.ok || !("provider" in result)) {
        throw new Error(copy.genericError);
      }
      const trusted =
        result.provider === "threads"
          ? typeof result.embedHtml === "string" && result.embedHtml.length > 0
          : isTrustedEmbedUrl(result.provider, result.embedUrl);
      if (result.provider !== provider || !trusted) {
        throw new Error(copy.unsafeError);
      }
      setState({ status: "ready", url: trimmedUrl, data: result });
    } catch (error) {
      setState({
        status: "error",
        url: trimmedUrl,
        message:
          error instanceof Error && error.message === copy.unsafeError
            ? copy.unsafeError
            : copy.genericError,
      });
    }
  }

  if (!trimmedUrl) {
    return <p className="mt-2 text-sm text-muted">{copy.idle}</p>;
  }

  if (!provider) {
    return <p className="mt-2 text-sm text-muted">{copy.unsupported}</p>;
  }

  const providerName = PROVIDER_NAMES[provider];

  return (
    <section
      aria-label={copy.label}
      className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-bold">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          {copy.checking}
        </p>
        <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted">
          {providerName}
        </span>
      </div>

      {currentState.status === "ready" ? (
        <div>
          <div className="flex items-start gap-2 border-b border-border px-4 py-3">
            <span
              aria-hidden
              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-safety-green-bg text-xs font-bold text-safety-green"
            >
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-safety-green">
                {copy.ready}
              </p>
              <p className="truncate text-sm text-muted">
                {currentState.data.title || copy.providerContent(providerName)}
                {currentState.data.authorName
                  ? ` · ${currentState.data.authorName}`
                  : ""}
              </p>
            </div>
          </div>
          <PreviewFrame data={currentState.data} copy={copy} />
        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm text-muted">{copy.verifyBody}</p>
          <button
            type="button"
            onClick={checkPreview}
            disabled={currentState.status === "loading"}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft px-4 text-sm font-bold text-accent transition-colors hover:bg-accent-strong hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            {currentState.status === "loading" && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
              />
            )}
            {currentState.status === "loading" ? copy.verifying : copy.verify}
          </button>
          {currentState.status === "error" && (
            <p role="alert" className="mt-3 text-sm text-safety-red">
              {currentState.message} {copy.errorSuffix}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function PreviewFrame({
  data,
  copy,
}: {
  data: PreviewData;
  copy: SubmitCopy["preview"];
}) {
  const isPortrait =
    data.provider === "tiktok" ||
    (data.provider === "youtube" &&
      new URL(data.sourceUrl).pathname.startsWith("/shorts/"));
  const isTall = data.provider === "instagram" || data.provider === "threads";
  const className = isPortrait
    ? "mx-auto aspect-[9/16] w-full max-w-[360px]"
    : isTall
      ? "mx-auto h-[680px] w-full max-w-[658px]"
      : "aspect-video w-full";

  return (
    <div className="bg-surface-2 p-2 sm:p-3">
      {/* 서드파티 임베드 내부가 흰 배경이라 다크 모드에서도 흰 컨테이너 유지 */}
      <iframe
        src={data.embedUrl ?? undefined}
        srcDoc={
          data.provider === "threads" && data.embedHtml
            ? threadsDocument(data.embedHtml)
            : undefined
        }
        title={copy.frameTitle(PROVIDER_NAMES[data.provider])}
        sandbox={
          data.provider === "threads"
            ? "allow-scripts allow-popups allow-popups-to-escape-sandbox"
            : "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
        }
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className={`${className} rounded-xl border-0 bg-white`}
      />
    </div>
  );
}
