// components/meme-thumbnail.tsx: a thumbnail whose image fails, before the
// script runs or after, is replaced by its title card.
{
  const IMAGE = 'img[data-thumbnail-state="image"]';
  const toFallback = (image) => {
    const template = image.nextElementSibling;
    if (!(template instanceof HTMLTemplateElement) || !template.hasAttribute("data-thumbnail-fallback")) return;
    image.replaceWith(template.content.firstElementChild.cloneNode(true));
    template.remove();
  };
  for (const image of document.querySelectorAll(IMAGE)) {
    if (image.complete && image.naturalWidth === 0) toFallback(image);
  }
  document.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement && event.target.matches(IMAGE)) toFallback(event.target);
  }, true);
}
