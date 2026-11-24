// components/meme-embed.tsx and components/related-video-list.tsx: what the
// players of the meme page do. A related YouTube video is a still until it
// is pressed. A social post is checked with Next's /api/oembed before its
// player is trusted (the TikTok and Instagram players the server already
// put in stay unless the check fails). The related videos past the first
// four are links until their region is opened.
{
  const ERROR = "콘텐츠를 불러오지 못했습니다.";
  const TIKTOK_UNAVAILABLE = "이 TikTok 콘텐츠를 현재 재생할 수 없습니다.";

  // isTrustedEmbedUrl.
  const trusted = (provider, raw) => {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") return false;
      if (provider === "tiktok") return url.hostname === "www.tiktok.com" && url.pathname.startsWith("/player/v1/");
      if (provider === "instagram") return url.hostname === "www.instagram.com" && url.pathname.endsWith("/embed/captioned/");
      if (provider === "threads") return false;
      return url.hostname === "www.facebook.com" && url.pathname.startsWith("/plugins/");
    } catch {
      return false;
    }
  };

  const playerOf = (box, embed) => {
    const frame = document.createElement("iframe");
    if (embed.embedUrl) frame.src = embed.embedUrl;
    if (embed.embedHtml) {
      frame.srcdoc = `<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style></head><body>${embed.embedHtml}</body></html>`;
    }
    frame.title = box.dataset.socialTitle;
    frame.setAttribute("sandbox", box.dataset.socialSandbox);
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.className = `${box.dataset.socialFrame} block rounded-2xl border border-border bg-white shadow-sm`;
    return frame;
  };

  const showError = (box, message) => {
    const panel = document.createElement("div");
    panel.className = "mx-auto flex min-h-32 w-full max-w-[540px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 p-5 text-center";
    const text = document.createElement("p");
    text.setAttribute("role", "alert");
    text.className = "text-sm text-muted";
    text.textContent = message;
    panel.append(text);
    if (box.dataset.social !== "tiktok") {
      const link = document.createElement("a");
      link.href = box.dataset.socialUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-bold transition-colors hover:border-accent hover:text-accent";
      link.append(`${box.dataset.socialName}에서 보기 `);
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "↗";
      link.append(arrow);
      panel.append(link);
    }
    box.lastElementChild.replaceWith(panel);
  };

  const check = async (box) => {
    const provider = box.dataset.social;
    try {
      const response = await fetch(`/api/oembed?url=${encodeURIComponent(box.dataset.socialUrl)}`);
      const data = await response.json();
      if (!response.ok || !("embedUrl" in data)) throw new Error("error" in data ? data.error : undefined);
      const ok = provider === "threads"
        ? typeof data.embedHtml === "string" && data.embedHtml.length > 0
        : typeof data.embedUrl === "string" && trusted(provider, data.embedUrl);
      if (data.provider !== provider || !ok) throw new Error("안전한 임베드 주소를 확인하지 못했습니다.");
      if (box.dataset.unavailable) return;
      const current = box.lastElementChild;
      if (current.localName !== "iframe" || current.src !== (data.embedUrl ?? "")) current.replaceWith(playerOf(box, data));
    } catch (error) {
      // A player the link named stays: the component draws it before the error.
      if (box.lastElementChild.localName === "iframe") return;
      showError(box, error instanceof Error && error.message ? error.message : ERROR);
    }
  };

  const watch = (box) => {
    // A TikTok player says when its video cannot be played; reload it once
    // the listener is there, as the component does after hydration.
    if (box.dataset.social === "tiktok") {
      const frame = box.querySelector("iframe");
      addEventListener("message", (event) => {
        const player = box.querySelector("iframe");
        if (event.origin !== "https://www.tiktok.com" || !player || event.source !== player.contentWindow) return;
        const message = event.data;
        if (!message || typeof message !== "object" || message["x-tiktok-player"] !== true || message.type !== "onPlayerError") return;
        if (message.value?.errorCode === 1001 && message.value?.errorType === "INVALID_VIDEO") {
          box.dataset.unavailable = "true";
          showError(box, TIKTOK_UNAVAILABLE);
        }
      });
      if (frame?.src) {
        const src = frame.src;
        frame.src = "about:blank";
        frame.src = src;
      }
    }
    // With a player already in place the check runs at once; otherwise
    // when the box comes within 200px of the viewport.
    if (box.querySelector("iframe") || typeof IntersectionObserver === "undefined") {
      check(box);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      check(box);
    }, { rootMargin: "200px" });
    observer.observe(box);
  };

  for (const box of document.querySelectorAll("[data-social]")) watch(box);

  document.addEventListener("click", (event) => {
    const still = event.target instanceof Element ? event.target.closest("[data-youtube]") : null;
    if (!still) return;
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${still.dataset.youtube}?rel=0&autoplay=1`;
    frame.title = still.dataset.youtubeTitle;
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-presentation");
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.loading = "lazy";
    frame.className = "h-full w-full border-0";
    still.replaceWith(frame);
  });

  // RelatedVideoList: opening the region plays four more, then four at a time.
  const BATCH = 4;
  for (const details of document.querySelectorAll("details[data-related-extra]")) {
    const region = details.querySelector("#related-videos-extra");
    const embeds = [...details.querySelector("template[data-related-embeds]").content.children];
    const links = [...region.querySelectorAll("[data-related-index]")];
    let mounted = 0;
    const more = document.createElement("button");
    more.type = "button";
    more.setAttribute("aria-controls", "related-videos-extra");
    more.className = "min-h-11 rounded-lg border border-accent/40 bg-surface px-4 py-3 text-sm font-bold text-accent-text hover:border-accent";
    const render = () => {
      region.replaceChildren();
      for (const embed of embeds.slice(0, mounted)) {
        const node = embed.firstElementChild.cloneNode(true);
        region.append(node);
        for (const box of node.querySelectorAll("[data-social]")) watch(box);
      }
      for (const link of links) {
        if (Number(link.dataset.relatedIndex) >= mounted) region.append(link);
      }
      const next = Math.min(BATCH, embeds.length - mounted);
      if (details.open && next > 0) {
        more.textContent = `관련 영상 ${next}개 더 재생하기`;
        region.append(more);
      }
    };
    more.addEventListener("click", () => {
      mounted = Math.min(mounted + BATCH, embeds.length);
      render();
    });
    details.addEventListener("toggle", () => {
      mounted = details.open ? BATCH : 0;
      render();
    });
  }
}
