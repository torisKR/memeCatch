// components/language-selector.tsx with persistLocale of lib/i18n-client.ts.
// An option the server marked with `data-dest` goes to that page. The others
// change the frame in place: its parts come rendered in the new language
// from GET /_axum/frame/{locale}, and the page itself stays as it is. As on
// Next, the choice lasts for this document; a reload follows the URL again.
{
  const LOCALE_COOKIE = "memecatch_locale";
  const DESTINATION_KEY = "memecatch:locale-destination";

  const persist = (code, destination) => {
    document.cookie = `${LOCALE_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
    storage.set("localStorage", LOCALE_COOKIE, code);
    if (destination && destination !== location.pathname) {
      storage.set("sessionStorage", DESTINATION_KEY, JSON.stringify({ locale: code, path: destination, at: Date.now() }));
    }
  };

  const swapFrame = async (code) => {
    const path = `${location.pathname}${location.search}`;
    const response = await fetch(`/_axum/frame/${encodeURIComponent(code)}?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error(`frame ${response.status}`);
    const frame = await response.json();
    root.lang = frame.lang;
    root.dir = frame.dir;
    for (const [name, html] of Object.entries(frame.parts)) {
      const part = document.querySelector(`[data-frame="${name}"]`);
      if (part) part.outerHTML = html;
    }
    for (const button of document.querySelectorAll("[data-save-meme]")) {
      button.dataset.saveCopy = JSON.stringify(frame.save);
    }
    for (const button of document.querySelectorAll("[data-export]")) {
      button.dataset.exportCopy = JSON.stringify(frame.export);
      button.dataset.exportLocale = frame.locale;
    }
    frameChanged();
    document.querySelector("[data-locale-select]")?.focus();
  };

  document.addEventListener("change", (event) => {
    const select = event.target instanceof Element ? event.target.closest("[data-locale-select]") : null;
    if (!select) return;
    const code = select.value;
    const destination = select.selectedOptions[0]?.dataset.dest;
    persist(code, destination && new URL(destination, location.href).pathname);
    if (destination) {
      location.assign(destination);
      return;
    }
    // Without the fragment, a reload still shows a complete page.
    swapFrame(code).catch(() => location.reload());
  });
}
