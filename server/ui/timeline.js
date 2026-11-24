// components/timeline-view.tsx: the year rows after the first four are
// mounted four at a time as the sentinel nears the viewport (the infinite
// scroll), up to a decade when its tab is pressed or the page opens on its
// `#decade-…`, and a card followed is reported as `timeline_click`.
{
  const view = document.querySelector("[data-timeline]");
  if (view) {
    const ROWS_PER_BATCH = 4;
    const total = Number(view.dataset.total);
    let visible = Number(view.dataset.initial);
    const sentinel = view.querySelector("[data-timeline-sentinel]");
    let observer = null;

    // The first template in document order is the next row: either a row of
    // a shown decade or a decade not shown yet, whose first row then follows.
    const mountRow = () => {
      let next = view.querySelector("template[data-row], template[data-section]");
      if (!next) return false;
      if (next.hasAttribute("data-section")) {
        const section = next.content.firstElementChild;
        next.replaceWith(section);
        next = section.querySelector("template[data-row]");
      }
      next.replaceWith(next.content.firstElementChild);
      visible += 1;
      return true;
    };

    const showRows = (count) => {
      while (visible < Math.min(count, total) && mountRow());
      if (visible >= total) {
        observer?.disconnect();
        sentinel?.remove();
      }
    };

    // A new observer after each batch: one reports a change of crossing only,
    // and the sentinel may still be inside the margin after a batch.
    const observe = () => {
      observer?.disconnect();
      if (visible >= total || !sentinel) return;
      if (typeof IntersectionObserver === "undefined") return showRows(total);
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        showRows(visible + ROWS_PER_BATCH);
        observe();
      }, { rootMargin: "600px 0px" });
      observer.observe(sentinel);
    };

    // The first row of a decade not shown yet; a shown decade has it already.
    const startOf = (key) => {
      const pending = view.querySelector(`template[data-section="${key}"]`);
      return pending ? Number(pending.dataset.start) : null;
    };

    const revealDecade = (key, scroll) => {
      const start = startOf(key);
      if (start !== null) showRows(start + 1);
      observe();
      if (!scroll) return;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const target = document.getElementById(`decade-${key}`);
        if (!target) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }));
    };

    view.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-decade-tab]");
      if (tab) {
        event.preventDefault();
        history.replaceState(null, "", `#decade-${tab.dataset.decadeTab}`);
        revealDecade(tab.dataset.decadeTab, true);
        return;
      }
      const card = event.target.closest("[data-timeline-card]");
      if (card) {
        track("timeline_click", { meme_id: card.dataset.timelineCard, year: Number(card.dataset.year), decade: card.dataset.decade });
      }
    });

    const hash = location.hash.match(/^#decade-(.+)$/);
    const known = (key) => view.querySelector(`[data-decade-tab="${key}"], section[data-decade="${key}"], template[data-section="${key}"]`);
    if (hash && known(hash[1])) requestAnimationFrame(() => revealDecade(hash[1], true));
    observe();
  }
}
