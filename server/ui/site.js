// The one script of the native pages. A page is complete without it: this
// adds what a server cannot do. Each block names the React component whose
// browser behavior it replaces; markup carries the inputs in data attributes.
//
// Not here yet, so these controls do nothing on a native page: the header
// menu and language switch, the signed-in account menu, the chat panel, and
// saving a meme (it needs the save action as an endpoint; the button sends a
// visitor to sign in).
(() => {
  "use strict";
  const root = document.documentElement;
  const main = document.querySelector("main");
  const COPIED_MS = 2000;

  // @next/third-parties GoogleAnalytics: the tag itself is an async script
  // in the document; this is its init call.
  const gaId = root.dataset.ga;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  if (gaId) {
    window.gtag("js", new Date());
    window.gtag("config", gaId);
  }
  // lib/analytics.ts track(), the analytics half.
  const track = (event, params) => {
    try {
      window.gtag("event", event, params);
    } catch {
      /* analytics must not break the page */
    }
  };

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
  const memeId = main?.dataset.memeId;
  if (memeId) {
    track("meme_view", { meme_id: memeId });
    try {
      fetch("/api/memes/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memeId }),
        keepalive: true,
      }).catch(() => {});
      const recent = JSON.parse(localStorage.getItem("mc_recent_memes") || "[]");
      localStorage.setItem(
        "mc_recent_memes",
        JSON.stringify([memeId, ...recent.filter((id) => id !== memeId)].slice(0, 6)),
      );
    } catch {
      /* storage can be unavailable */
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

    if (target?.closest("[data-save-meme]")) {
      location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }

    // components/tracked-block.tsx: a link followed inside a tracked block.
    const link = target?.closest("a");
    const block = link?.closest("[data-track]");
    if (block) {
      track(block.dataset.track, {
        short_id: block.dataset.trackShortId,
        from: block.dataset.trackFrom,
        to: link.getAttribute("href") ?? "",
      });
    }
  });

  // components/search-shortcut.tsx: "/" focuses the header search.
  document.addEventListener("keydown", (event) => {
    const typing = event.target instanceof HTMLElement
      && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
    if (event.key !== "/" || typing || event.metaKey || event.ctrlKey || event.altKey) return;
    const input = document.getElementById("header-search");
    if (input && input.offsetParent !== null) {
      event.preventDefault();
      input.focus();
    }
  });
})();
