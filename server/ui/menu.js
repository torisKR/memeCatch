// components/header-menu.tsx: a disclosure, not a modal, so Tab walks from
// the button into the list. core.js closes it on Escape or a press outside.
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest("[data-menu] > button");
  if (button) {
    setDisclosure(button, disclosurePanel(button), button.getAttribute("aria-expanded") !== "true");
    return;
  }
  if (target?.closest("[data-random-meme]")) track("random_meme");
});
document.addEventListener("disclosure", (event) => {
  // The open button looks pressed: `bg-surface-2` instead of on hover only.
  const button = event.target;
  if (!button.closest?.("[data-menu]")) return;
  button.classList.toggle("bg-surface-2", event.detail);
  button.classList.toggle("hover:bg-surface-2", !event.detail);
}, true);
