// components/export-button.tsx: the card export panel of the meme page. The
// button opens the panel in its place and the close button puts it back, as
// the component swaps one for the other. The choices are kept while the page
// lives. The PNG comes from Next's /memes/{short_id}/export, as a download.
{
  const opener = document.querySelector("[data-export]");
  const template = opener?.nextElementSibling;
  if (opener && template?.matches("template[data-export-panel]")) {
    const SELECTED = ["border-accent", "bg-accent/10", "text-foreground"];
    const IDLE = ["border-border", "bg-surface", "text-text-muted"];
    // SEO_CONTENT_LOCALES of lib/i18n-routing.ts: the export speaks them.
    const SEO_LOCALES = new Set(["en", "ja", "zh", "zh-tw"]);
    const shortId = opener.dataset.export;
    const state = { template: "classic", format: "card", busy: false, error: false };
    let panel = null;
    let failure = null;
    let objectUrl = null;

    const copy = () => JSON.parse(opener.dataset.exportCopy);

    const mark = (selector, key, value) => {
      for (const choice of panel.querySelectorAll(selector)) {
        const pressed = choice.dataset[key] === value;
        choice.setAttribute("aria-pressed", String(pressed));
        choice.classList.remove(...(pressed ? IDLE : SELECTED));
        choice.classList.add(...(pressed ? SELECTED : IDLE));
      }
    };

    const render = () => {
      const text = copy();
      opener.lastChild.textContent = text.open;
      if (!panel) return;
      panel.setAttribute("aria-label", text.title);
      panel.querySelector("[data-export-close]").setAttribute("aria-label", text.close);
      for (const element of panel.querySelectorAll("[data-copy-key]")) {
        element.textContent = text[element.dataset.copyKey];
      }
      mark("[data-export-template]", "exportTemplate", state.template);
      mark("[data-export-format]", "exportFormat", state.format);
      const download = panel.querySelector("[data-export-download]");
      // Absent rather than hidden, as the component renders it.
      failure.textContent = text.failed;
      if (state.error) download.before(failure);
      else failure.remove();
      download.disabled = state.busy;
      download.textContent = state.busy ? text.downloading : text.download;
    };

    const download = async () => {
      state.busy = true;
      state.error = false;
      render();
      try {
        const query = new URLSearchParams({ template: state.template, format: state.format });
        const locale = opener.dataset.exportLocale;
        if (SEO_LOCALES.has(locale)) query.set("locale", locale);
        const response = await fetch(`/memes/${shortId}/export?${query}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`export ${response.status}`);
        const blob = await response.blob();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `memecatch-${shortId}-${state.template}-${state.format}.png`;
        document.body.append(link);
        link.click();
        link.remove();
      } catch {
        state.error = true;
      } finally {
        state.busy = false;
        render();
      }
    };

    opener.addEventListener("click", () => {
      panel = template.content.firstElementChild.cloneNode(true);
      failure = panel.querySelector("[data-export-error]");
      panel.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const choice = target?.closest("[data-export-template], [data-export-format]");
        if (choice) {
          state.error = false;
          if (choice.dataset.exportTemplate) state.template = choice.dataset.exportTemplate;
          else state.format = choice.dataset.exportFormat;
          render();
        } else if (target?.closest("[data-export-close]")) {
          panel.replaceWith(opener);
          panel = null;
        } else if (target?.closest("[data-export-download]") && !state.busy) {
          download();
        }
      });
      render();
      opener.replaceWith(panel);
    });
    onFrame(render);
  }
}
