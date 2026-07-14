"use client";

import { useState } from "react";

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

export function ContentUrlPreview({ url }: { url: string }) {
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
        `/api/oembed?url=${encodeURIComponent(trimmedUrl)}`
      );
      const result = (await response.json()) as
        | PreviewData
        | { error?: string };
      if (!response.ok || !("provider" in result)) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "공개 콘텐츠를 확인하지 못했어요."
        );
      }
      const trusted =
        result.provider === "threads"
          ? typeof result.embedHtml === "string" && result.embedHtml.length > 0
          : isTrustedEmbedUrl(result.provider, result.embedUrl);
      if (result.provider !== provider || !trusted) {
        throw new Error("안전한 미리보기 주소를 확인하지 못했어요.");
      }
      setState({ status: "ready", url: trimmedUrl, data: result });
    } catch (error) {
      setState({
        status: "error",
        url: trimmedUrl,
        message:
          error instanceof Error
            ? error.message
            : "콘텐츠를 확인하지 못했어요.",
      });
    }
  }

  if (!trimmedUrl) {
    return (
      <p className="mt-2 text-sm text-muted">
        YouTube·Shorts·Instagram·TikTok 링크를 붙이면 제출 전에 확인할 수 있어요.
      </p>
    );
  }

  if (!provider) {
    return (
      <p className="mt-2 text-sm text-muted">
        일반 출처 링크로 제출할 수 있어요. 영상 미리보기는 YouTube·Instagram·TikTok을 지원해요.
      </p>
    );
  }

  const providerName = PROVIDER_NAMES[provider];

  return (
    <section
      aria-label="콘텐츠 링크 미리보기"
      className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-bold">
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
          콘텐츠 신호 확인
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
                공개 콘텐츠를 확인했어요
              </p>
              <p className="truncate text-sm text-muted">
                {currentState.data.title || `${providerName} 콘텐츠`}
                {currentState.data.authorName
                  ? ` · ${currentState.data.authorName}`
                  : ""}
              </p>
            </div>
          </div>
          <PreviewFrame data={currentState.data} />
        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm text-muted">
            링크가 공개 상태이고 사이트 안에서 재생되는지 확인합니다.
          </p>
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
            {currentState.status === "loading"
              ? "공개 콘텐츠 확인 중…"
              : "링크 확인하고 미리보기"}
          </button>
          {currentState.status === "error" && (
            <p role="alert" className="mt-3 text-sm text-safety-red">
              {currentState.message} 삭제·비공개·연령 제한 여부와 URL을 확인해 주세요.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function PreviewFrame({ data }: { data: PreviewData }) {
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
      <iframe
        src={data.embedUrl ?? undefined}
        srcDoc={
          data.provider === "threads" && data.embedHtml
            ? threadsDocument(data.embedHtml)
            : undefined
        }
        title={`${PROVIDER_NAMES[data.provider]} 콘텐츠 미리보기`}
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
