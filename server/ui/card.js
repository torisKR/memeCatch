// A failed video still falls back to approved editorial art when available,
// then the poster. The official TikTok/Instagram player opens in a dialog.
{
  const recoverArt = (image) => {
    const card = image.closest("[data-card]");
    const alternate = card?.querySelector("template[data-card-alt-image]");
    if (alternate) {
      const replacement = alternate.content.cloneNode(true);
      alternate.remove();
      image.replaceWith(replacement);
      return;
    }
    const fallback = card?.querySelector("template[data-card-fallback]");
    if (!fallback) return;
    const [poster, bubble] = fallback.content.cloneNode(true).children;
    image.replaceWith(poster);
    const face = card.querySelector(".meme-card-face");
    face.classList.add("meme-card-fallback");
    face.prepend(bubble);
    fallback.remove();
  };
  // Delegated, so that cards a list adds later (the explore grid) behave too.
  const ART = "[data-card] img[data-meme-card-art]";
  for (const image of document.querySelectorAll(ART)) {
    if (image.complete && image.naturalWidth === 0) recoverArt(image);
  }
  document.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement && event.target.matches(ART)) recoverArt(event.target);
  }, true);

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
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element && event.target.closest("[data-card-preview]");
    if (button) openPreview(button);
  });
}
