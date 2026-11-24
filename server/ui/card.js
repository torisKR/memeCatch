// components/meme-card.tsx: a card whose image fails to load shows the poster
// instead, and the official TikTok or Instagram player opens in a dialog
// (components/social-video-preview-dialog.tsx).
{
  const toPoster = (image) => {
    const card = image.closest("[data-card]");
    const fallback = card?.querySelector("template[data-card-fallback]");
    if (!fallback) return;
    const [poster, bubble] = fallback.content.cloneNode(true).children;
    image.replaceWith(poster);
    const face = card.querySelector(".meme-card-face");
    face.classList.add("meme-card-fallback");
    face.prepend(bubble);
    fallback.remove();
  };
  for (const image of document.querySelectorAll("[data-card] img[data-meme-card-art]")) {
    if (image.complete && image.naturalWidth === 0) toPoster(image);
    else image.addEventListener("error", () => toPoster(image), { once: true });
  }

  let previews = 0;
  const openPreview = (button) => {
    const dialog = button.nextElementSibling;
    const template = dialog.nextElementSibling;
    const content = template.content.firstElementChild.cloneNode(true);
    const unavailable = template.content.lastElementChild;
    const heading = content.querySelector("[data-card-dialog-title]");
    heading.id = `card-preview-${(previews += 1)}`;
    dialog.setAttribute("aria-labelledby", heading.id);
    dialog.replaceChildren(content);
    const player = content.querySelector("iframe");
    let onMessage = null;
    if (template.hasAttribute("data-tiktok")) {
      // Listen before the player loads, so its first error is not missed.
      onMessage = (event) => {
        if (event.origin !== "https://www.tiktok.com" || event.source !== player.contentWindow) return;
        const data = event.data;
        if (!data || typeof data !== "object" || Array.isArray(data)) return;
        const value = data.value;
        if (data["x-tiktok-player"] !== true || data.type !== "onPlayerError" || !value || typeof value !== "object" || Array.isArray(value)) return;
        if (value.errorCode === 1001 && value.errorType === "INVALID_VIDEO") {
          player.replaceWith(unavailable.cloneNode(true));
          window.removeEventListener("message", onMessage);
        }
      };
      window.addEventListener("message", onMessage);
      player.src = template.dataset.embed;
    }
    content.querySelector("[data-card-dialog-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      if (onMessage) window.removeEventListener("message", onMessage);
      dialog.replaceChildren();
      dialog.removeAttribute("aria-labelledby");
    }, { once: true });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };
  for (const button of document.querySelectorAll("[data-card-preview]")) {
    button.addEventListener("click", () => openPreview(button));
  }
}
