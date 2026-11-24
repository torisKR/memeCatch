// components/house-original-visual.tsx: a house original's card and its
// short-form storyboard, one tab at a time.
for (const visual of document.querySelectorAll("[data-house-visual]")) {
  const on = visual.dataset.tabOn.split(" ");
  const off = visual.dataset.tabOff.split(" ");
  const panels = {
    card: visual.querySelector('[data-house-panel="card"]'),
    storyboard: visual.querySelector("template[data-house-storyboard]").content.firstElementChild.cloneNode(true),
  };
  visual.addEventListener("click", (event) => {
    const tab = event.target instanceof Element ? event.target.closest("[data-house-tab]") : null;
    if (!tab) return;
    for (const button of visual.querySelectorAll("[data-house-tab]")) {
      const active = button === tab;
      button.classList.remove(...(active ? off : on));
      button.classList.add(...(active ? on : off));
    }
    const shown = panels[tab.dataset.houseTab];
    if (!shown.isConnected) {
      const current = Object.values(panels).find((panel) => panel.isConnected);
      current.replaceWith(shown);
    }
  });
}
