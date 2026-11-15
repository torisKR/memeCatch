export type ChromeVisibility = "shown" | "hidden";

export type ScrollListenerTarget = {
  scrollY: number;
  addEventListener(
    type: "scroll" | "resize",
    listener: () => void,
    options?: { passive?: boolean },
  ): void;
  removeEventListener(type: "scroll" | "resize", listener: () => void): void;
};

export type ChromeRoot = {
  dataset: { chrome?: string };
};

const TOP_ALWAYS_SHOWN = 8;
const DELTA = 6;

/**
 * Downward window scroll hides the header and bottom nav. Upward scroll, or
 * sitting at the top, shows them. Sub-threshold noise keeps the last state.
 */
export function reduceScrollChrome(
  previousY: number,
  previous: ChromeVisibility,
  nextY: number,
): ChromeVisibility {
  if (nextY <= TOP_ALWAYS_SHOWN) return "shown";
  const delta = nextY - previousY;
  if (delta > DELTA) return "hidden";
  if (delta < -DELTA) return "shown";
  return previous;
}

export function attachScrollChrome(
  target: ScrollListenerTarget,
  root: ChromeRoot,
  enabled: () => boolean = () => true,
): () => void {
  let y = target.scrollY;
  let visibility: ChromeVisibility = "shown";

  const publish = (next: ChromeVisibility) => {
    visibility = next;
    y = target.scrollY;
    root.dataset.chrome = next;
    if (typeof document === "undefined") return;
    const inert = next === "hidden";
    for (const element of document.querySelectorAll("[data-site-header], [data-site-bottom-nav]")) {
      element.toggleAttribute("inert", inert);
    }
  };

  const apply = () => {
    if (!enabled()) {
      publish("shown");
      return;
    }
    publish(reduceScrollChrome(y, visibility, target.scrollY));
  };

  target.addEventListener("scroll", apply, { passive: true });
  target.addEventListener("resize", apply);
  apply();

  return () => {
    target.removeEventListener("scroll", apply);
    target.removeEventListener("resize", apply);
  };
}
