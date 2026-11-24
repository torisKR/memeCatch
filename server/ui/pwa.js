// components/pwa-install.tsx: from the second visit (or the second saved
// meme), an install banner in the chat launcher's place; on an iPhone, a
// sheet with the steps. Dismissed, it stays away for 14 days.
{
  const KEY_VISITS = "mc:visits";
  const KEY_SAVES = "mc:saves";
  const KEY_DISMISSED_AT = "mc:install-dismissed-at";
  const KEY_INSTALLED = "mc:installed";
  const SESSION_COUNTED = "mc:visit-counted";
  const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

  const count = (key) => Number.parseInt(storage.get("localStorage", key) ?? "0", 10) || 0;
  if (!storage.get("sessionStorage", SESSION_COUNTED)) {
    storage.set("sessionStorage", SESSION_COUNTED, "1");
    storage.set("localStorage", KEY_VISITS, String(count(KEY_VISITS) + 1));
  }
  window.addEventListener("memecatch:save", () => storage.set("localStorage", KEY_SAVES, String(count(KEY_SAVES) + 1)));

  const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const eligible = () => {
    if (standalone()) return false;
    const dismissedAt = count(KEY_DISMISSED_AT);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return false;
    if (storage.get("localStorage", KEY_INSTALLED) === "1") return false;
    return count(KEY_VISITS) >= 2 || count(KEY_SAVES) >= 2;
  };

  let banner = null;
  let sheet = null;
  let deferredPrompt = null;
  // The chatbot renders nothing while the banner is there.
  const setChatHidden = (hidden) => {
    const box = document.querySelector("[data-chat]");
    if (box) box.hidden = hidden;
  };
  const hide = () => {
    sheet?.close();
    banner?.remove();
    banner = null;
    setChatHidden(false);
  };
  const dismiss = () => {
    storage.set("localStorage", KEY_DISMISSED_AT, String(Date.now()));
    hide();
  };
  const show = () => {
    const template = document.querySelector("template[data-pwa-banner]");
    if (banner || !template) return;
    banner = template.content.firstElementChild.cloneNode(true);
    const install = banner.querySelector("[data-install]");
    if (ios) install.textContent = install.dataset.iosLabel;
    install.addEventListener("click", async () => {
      if (ios) {
        const sheetTemplate = document.querySelector("template[data-pwa-sheet]");
        sheet = openModal(sheetTemplate, { onClose: () => (sheet = null) });
        sheet.dialog.querySelector("[data-dismiss]").addEventListener("click", dismiss);
        return;
      }
      if (!deferredPrompt) return;
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") storage.set("localStorage", KEY_INSTALLED, "1");
      } catch {
        /* the prompt failed: close quietly */
      }
      deferredPrompt = null;
      hide();
    });
    banner.querySelector("[data-dismiss]").addEventListener("click", dismiss);
    document.body.append(banner);
    setChatHidden(true);
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (!eligible()) return;
    deferredPrompt = event;
    show();
  });
  window.addEventListener("appinstalled", () => {
    storage.set("localStorage", KEY_INSTALLED, "1");
    deferredPrompt = null;
    hide();
  });
  setTimeout(() => ios && eligible() && show(), 0);
  // What @serwist/next adds to every Next page (`register`, `reloadOnOnline`):
  // the worker at /sw.js, Next's while Next serves it and the Axum one after
  // the cutover (server/src/standalone/worker.js), and a reload when the
  // connection comes back.
  if ("serviceWorker" in navigator) {
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    window.addEventListener("online", () => location.reload());
  }
  // A frame in another language brings its chat back: keep it hidden.
  onFrame(() => banner && setChatHidden(true));
}
