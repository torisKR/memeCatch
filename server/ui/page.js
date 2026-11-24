// What the pages themselves do, as opposed to the frame around them. Each
// block names the React component whose browser behaviour it replaces.
const COPIED_MS = 2000;

// components/adsense-script.tsx with adsense-host-gate.tsx: the loader runs
// only where the server allows it and only on the live host.
const adsClient = main?.dataset.ads;
const liveHost = location.protocol === "https:" && !location.port
  && (location.hostname === "catchmeme.com" || location.hostname === "www.catchmeme.com");
if (adsClient && liveHost) {
  const loader = document.createElement("script");
  loader.id = "adsense";
  loader.async = true;
  loader.crossOrigin = "anonymous";
  loader.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsClient)}`;
  document.head.append(loader);
}

// app/(default)/memes/[key]/view-tracker.tsx.
const viewedMemeId = main?.dataset.memeId;
if (viewedMemeId) {
  track("meme_view", { meme_id: viewedMemeId });
  fetch("/api/memes/view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memeId: viewedMemeId }),
    keepalive: true,
  }).catch(() => {});
  try {
    const recent = JSON.parse(storage.get("localStorage", "mc_recent_memes") || "[]");
    storage.set("localStorage", "mc_recent_memes", JSON.stringify(
      [viewedMemeId, ...recent.filter((id) => id !== viewedMemeId)].slice(0, 6),
    ));
  } catch {
    /* a damaged list is replaced next time */
  }
}

const flash = (element, attribute) => {
  element.setAttribute(attribute, "");
  setTimeout(() => element.removeAttribute(attribute), COPIED_MS);
};

document.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target : null;

  // components/copy-text-button.tsx.
  const copy = target?.closest("[data-copy]");
  if (copy) {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(copy.dataset.copy);
      navigator.vibrate?.(15);
      flash(copy, "data-copied");
    } catch {
      /* no clipboard access */
    }
    return;
  }

  // components/share-button.tsx.
  const share = target?.closest("[data-share]");
  if (share) {
    const path = share.dataset.share;
    const method = navigator.share ? "native" : "link";
    const url = `${location.origin}${path}?utm_source=share&utm_medium=${method}`;
    track("share_click", { method, to: path });
    try {
      if (navigator.share) {
        await navigator.share({ title: `${share.dataset.shareTitle} — 밈캐치`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      const status = share.nextElementSibling;
      if (status) status.textContent = "링크가 복사되었어요.";
      setTimeout(() => status && (status.textContent = ""), COPIED_MS);
    } catch {
      /* the share sheet was closed */
    }
    return;
  }

  // components/tracked-block.tsx: a link followed inside a tracked block.
  const link = target?.closest("a");
  const block = link?.closest("[data-track]");
  if (block) {
    // The block's own parameters, then where the link goes.
    const { trackShortId, trackFrom, trackPlatform } = block.dataset;
    track(block.dataset.track, {
      short_id: trackShortId,
      ...(trackFrom === undefined ? {} : { from: trackFrom }),
      ...(trackPlatform === undefined ? {} : { platform: trackPlatform }),
      to: link.getAttribute("href") ?? "",
    });
  }
});
