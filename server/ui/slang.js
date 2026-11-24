// components/slang-dictionary.tsx: the panel of `?era=` is shown once the
// page has loaded (the document always shows the first), and a tab switches
// panels in place, keeping the scroll, as Next's client router does.
{
  const dictionary = document.querySelector("[data-slang]");
  if (dictionary) {
    const tabs = [...dictionary.querySelectorAll("[data-era-tab]")];
    const panels = [...dictionary.querySelectorAll("section[data-era]")];
    const current = dictionary.dataset.tabCurrent.split(" ");
    const idle = dictionary.dataset.tabIdle.split(" ");
    const KEYS = ["now", "2010s", "2000s", "1990s", "risky"];

    const fromAddress = () => {
      const era = new URLSearchParams(location.search).get("era");
      return KEYS.includes(era) && tabs.some((tab) => tab.dataset.eraTab === era) ? era : "now";
    };

    const show = (era) => {
      for (const panel of panels) panel.hidden = panel.dataset.era !== era;
      for (const tab of tabs) {
        const on = tab.dataset.eraTab === era;
        if (on) tab.setAttribute("aria-current", "page");
        else tab.removeAttribute("aria-current");
        tab.classList.remove(...(on ? idle : current));
        tab.classList.add(...(on ? current : idle));
        tab.querySelector("span")?.classList.toggle("text-white/90", on);
        if (on) {
          try {
            tab.scrollIntoView({ inline: "center", block: "nearest" });
          } catch {
            /* not every browser takes the options */
          }
        }
      }
    };

    dictionary.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-era-tab]");
      if (!tab || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      if (tab.href !== location.href) history.pushState(null, "", tab.href);
      show(fromAddress());
    });
    addEventListener("popstate", () => show(fromAddress()));
    if (fromAddress() !== "now") show(fromAddress());
  }
}
