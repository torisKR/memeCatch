export type OEmbedProvider =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "threads";

export type OEmbedResult = {
  provider: OEmbedProvider;
  sourceUrl: string;
  embedUrl: string | null;
  embedHtml: string | null;
  contentId: string | null;
  title: string | null;
  authorName: string | null;
};

export class OEmbedError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_URL"
      | "UNSUPPORTED_PROVIDER"
      | "UPSTREAM_ERROR",
    readonly status: number
  ) {
    super(message);
  }
}

type ProviderTarget = {
  provider: OEmbedProvider;
  sourceUrl: string;
  tiktokId?: string;
  youtubeId?: string;
  metaEndpoint?:
    | "instagram_oembed"
    | "oembed_post"
    | "oembed_video"
    | "threads_oembed";
};

type UpstreamOEmbed = {
  author_name?: unknown;
  html?: unknown;
  title?: unknown;
};

const GRAPH_API_VERSION_PATTERN = /^v\d+\.\d+$/;

function isHost(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function safeText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 500)
    : null;
}

function getTikTokId(url: URL, html?: string) {
  return (
    url.pathname.match(/\/video\/(\d+)/)?.[1] ??
    html?.match(/data-video-id=["'](\d+)["']/)?.[1] ??
    html?.match(/\/video\/(\d+)/)?.[1] ??
    null
  );
}

function getYouTubeId(url: URL) {
  const hostname = url.hostname.toLowerCase();
  const candidate =
    hostname === "youtu.be" || hostname.endsWith(".youtu.be")
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1] ??
        url.searchParams.get("v");
  return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}

export function isSupportedOEmbedUrl(rawUrl: string) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return (
      isHost(hostname, "youtube.com") ||
      isHost(hostname, "youtu.be") ||
      isHost(hostname, "tiktok.com") ||
      isHost(hostname, "instagram.com") ||
      isHost(hostname, "facebook.com") ||
      hostname === "fb.watch" ||
      isHost(hostname, "threads.net") ||
      isHost(hostname, "threads.com")
    );
  } catch {
    return false;
  }
}

export function parseOEmbedTarget(rawUrl: string): ProviderTarget {
  if (!rawUrl || rawUrl.length > 2_048) {
    throw new OEmbedError("올바른 콘텐츠 URL이 필요합니다.", "INVALID_URL", 400);
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new OEmbedError("올바른 콘텐츠 URL이 필요합니다.", "INVALID_URL", 400);
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new OEmbedError("HTTPS 콘텐츠 URL만 사용할 수 있습니다.", "INVALID_URL", 400);
  }

  url.hash = "";
  const sourceUrl = url.toString();
  const hostname = url.hostname.toLowerCase();

  if (isHost(hostname, "youtube.com") || isHost(hostname, "youtu.be")) {
    const youtubeId = getYouTubeId(url);
    if (!youtubeId) {
      throw new OEmbedError(
        "YouTube 영상 또는 Shorts URL을 확인해 주세요.",
        "INVALID_URL",
        400
      );
    }
    return { provider: "youtube", sourceUrl, youtubeId };
  }

  if (isHost(hostname, "tiktok.com")) {
    return {
      provider: "tiktok",
      sourceUrl,
      tiktokId: getTikTokId(url) ?? undefined,
    };
  }

  if (isHost(hostname, "instagram.com")) {
    if (!/^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?/.test(url.pathname)) {
      throw new OEmbedError(
        "Instagram 게시물 또는 릴스 URL만 임베드할 수 있습니다.",
        "INVALID_URL",
        400
      );
    }
    return {
      provider: "instagram",
      sourceUrl,
      metaEndpoint: "instagram_oembed",
    };
  }

  if (isHost(hostname, "threads.net") || isHost(hostname, "threads.com")) {
    if (!/^\/(?:@[^/]+\/post|t)\/[A-Za-z0-9_-]+\/?/.test(url.pathname)) {
      throw new OEmbedError(
        "Threads 공개 게시물 URL만 임베드할 수 있습니다.",
        "INVALID_URL",
        400
      );
    }
    return {
      provider: "threads",
      sourceUrl,
      metaEndpoint: "threads_oembed",
    };
  }

  if (isHost(hostname, "facebook.com") || hostname === "fb.watch") {
    const isVideo =
      hostname === "fb.watch" ||
      /\/(?:watch|videos?|reel)(?:\/|$)/.test(url.pathname) ||
      url.searchParams.has("v");
    return {
      provider: "facebook",
      sourceUrl,
      metaEndpoint: isVideo ? "oembed_video" : "oembed_post",
    };
  }

  throw new OEmbedError(
    "YouTube, TikTok, Instagram, Facebook 또는 Threads 콘텐츠만 지원합니다.",
    "UNSUPPORTED_PROVIDER",
    400
  );
}

async function readJson(response: Response): Promise<UpstreamOEmbed> {
  const data = (await response.json().catch(() => null)) as
    | UpstreamOEmbed
    | { error?: { message?: string } }
    | null;

  if (!response.ok || !data) {
    const detail =
      data && "error" in data && typeof data.error?.message === "string"
        ? data.error.message
        : null;
    throw new OEmbedError(
      detail ?? "플랫폼에서 콘텐츠 정보를 가져오지 못했습니다.",
      "UPSTREAM_ERROR",
      response.status === 404 ? 404 : 502
    );
  }

  return data as UpstreamOEmbed;
}

function buildInstagramEmbedUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) {
    throw new OEmbedError("Instagram URL을 해석하지 못했습니다.", "INVALID_URL", 400);
  }
  return `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/`;
}

function buildFacebookEmbedUrl(sourceUrl: string, isVideo: boolean) {
  const endpoint = isVideo ? "video.php" : "post.php";
  const params = new URLSearchParams({
    href: sourceUrl,
    show_text: "true",
    width: "658",
  });
  return `https://www.facebook.com/plugins/${endpoint}?${params}`;
}

export async function getOEmbed(rawUrl: string): Promise<OEmbedResult> {
  const target = parseOEmbedTarget(rawUrl);

  if (target.provider === "youtube") {
    const canonicalUrl = `https://www.youtube.com/watch?v=${target.youtubeId}`;
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", canonicalUrl);
    endpoint.searchParams.set("format", "json");
    const response = await fetch(endpoint, {
      next: { revalidate: 3_600 },
      signal: AbortSignal.timeout(8_000),
    });
    const data = await readJson(response);
    return {
      provider: "youtube",
      sourceUrl: target.sourceUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${target.youtubeId}?rel=0`,
      embedHtml: null,
      contentId: target.youtubeId ?? null,
      title: safeText(data.title),
      authorName: safeText(data.author_name),
    };
  }

  if (target.provider === "tiktok") {
    const endpoint = new URL("https://www.tiktok.com/oembed");
    endpoint.searchParams.set("url", target.sourceUrl);
    const response = await fetch(endpoint, {
      next: { revalidate: 3_600 },
      signal: AbortSignal.timeout(8_000),
    });
    const data = await readJson(response);
    const id = getTikTokId(
      new URL(target.sourceUrl),
      typeof data.html === "string" ? data.html : undefined
    );
    if (!id) {
      throw new OEmbedError(
        "TikTok 게시물 ID를 확인하지 못했습니다.",
        "UPSTREAM_ERROR",
        502
      );
    }
    return {
      provider: "tiktok",
      sourceUrl: target.sourceUrl,
      embedUrl: `https://www.tiktok.com/player/v1/${id}?description=1&music_info=1`,
      embedHtml: null,
      contentId: id,
      title: safeText(data.title),
      authorName: safeText(data.author_name),
    };
  }

  const configuredVersion = process.env.META_GRAPH_API_VERSION ?? "v25.0";
  const graphVersion = GRAPH_API_VERSION_PATTERN.test(configuredVersion)
    ? configuredVersion
    : "v25.0";
  const endpoint =
    target.provider === "threads"
      ? new URL("https://graph.threads.net/v1.0/oembed")
      : new URL(
          `https://graph.facebook.com/${graphVersion}/${target.metaEndpoint}`
        );
  endpoint.searchParams.set("url", target.sourceUrl);
  endpoint.searchParams.set("maxwidth", "658");
  endpoint.searchParams.set("omitscript", "true");

  const response = await fetch(endpoint, {
    next: { revalidate: 3_600 },
    signal: AbortSignal.timeout(8_000),
  });
  const data = await readJson(response);

  if (target.provider === "threads") {
    if (typeof data.html !== "string" || !data.html.trim()) {
      throw new OEmbedError(
        "Threads 임베드 HTML을 확인하지 못했습니다.",
        "UPSTREAM_ERROR",
        502
      );
    }
    return {
      provider: target.provider,
      sourceUrl: target.sourceUrl,
      embedUrl: null,
      embedHtml: data.html,
      contentId:
        new URL(target.sourceUrl).pathname.match(/\/(?:post|t)\/([A-Za-z0-9_-]+)/)?.[1] ??
        null,
      title: safeText(data.title),
      authorName: safeText(data.author_name),
    };
  }

  return {
    provider: target.provider,
    sourceUrl: target.sourceUrl,
    embedUrl:
      target.provider === "instagram"
        ? buildInstagramEmbedUrl(target.sourceUrl)
        : buildFacebookEmbedUrl(
            target.sourceUrl,
            target.metaEndpoint === "oembed_video"
          ),
    embedHtml: null,
    contentId:
      target.provider === "instagram"
        ? new URL(target.sourceUrl).pathname.match(
            /^\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/
          )?.[1] ?? null
        : null,
    title: safeText(data.title),
    authorName: safeText(data.author_name),
  };
}
