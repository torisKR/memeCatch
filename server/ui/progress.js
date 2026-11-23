// components/nav-progress.tsx: a bar along the top edge while the next page
// loads. Every navigation here is a page load, so the bar stays until the
// page goes; a page restored from the back-forward cache starts without it.
{
  const APPEAR_DELAY = 120;
  const TRICKLE_INTERVAL = 300;
  let started = false;
  let timers = [];
  const bar = () => document.querySelector("[data-nav-progress]");
  const reset = () => {
    started = false;
    timers.forEach(clearTimeout);
    timers = [];
    const element = bar();
    if (!element) return;
    element.dataset.visible = "false";
    element.firstElementChild.style.width = "0%";
  };
  const start = () => {
    if (started) return;
    started = true;
    timers.push(setTimeout(() => {
      const element = bar();
      if (!element) return;
      let value = 8;
      element.dataset.visible = "true";
      element.firstElementChild.style.width = `${value}%`;
      const tick = () => {
        value = Math.min(value + (90 - value) * 0.12, 89.5);
        element.firstElementChild.style.width = `${value}%`;
        timers.push(setTimeout(tick, TRICKLE_INTERVAL));
      };
      timers.push(setTimeout(tick, TRICKLE_INTERVAL));
    }, APPEAR_DELAY));
  };
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a") : null;
    const href = anchor?.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    if (anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.getAttribute("rel") === "external") return;
    try {
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    } catch {
      /* not a URL */
    }
  }, true);
  window.addEventListener("pageshow", (event) => event.persisted && reset());
}
