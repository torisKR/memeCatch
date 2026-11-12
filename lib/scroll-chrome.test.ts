import { describe, expect, it } from "vitest";
import { attachScrollChrome, reduceScrollChrome, type ScrollListenerTarget } from "@/lib/scroll-chrome";

function fakeWindow(initial = 0) {
  let y = initial;
  const listeners = new Set<() => void>();
  const target: ScrollListenerTarget = {
    get scrollY() {
      return y;
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
  };
  return {
    target,
    scrollTo(next: number) {
      y = next;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

describe("scroll chrome", () => {
  it("hides on the way down and shows on the way up or at the top", () => {
    expect(reduceScrollChrome(0, "shown", 40)).toBe("hidden");
    expect(reduceScrollChrome(40, "hidden", 20)).toBe("shown");
    expect(reduceScrollChrome(20, "shown", 24)).toBe("shown");
    expect(reduceScrollChrome(80, "hidden", 0)).toBe("shown");
  });

  it("writes the visibility the header and bottom nav read", () => {
    const windowLike = fakeWindow(0);
    const root = { dataset: {} as { chrome?: string } };
    const stop = attachScrollChrome(windowLike.target, root, () => true);

    expect(root.dataset.chrome).toBe("shown");
    windowLike.scrollTo(80);
    expect(root.dataset.chrome).toBe("hidden");
    windowLike.scrollTo(40);
    expect(root.dataset.chrome).toBe("shown");

    stop();
    windowLike.scrollTo(200);
    expect(root.dataset.chrome).toBe("shown");
    expect(windowLike.listenerCount()).toBe(0);
  });

  it("keeps chrome shown when the viewport is not a phone", () => {
    const windowLike = fakeWindow(0);
    const root = { dataset: {} as { chrome?: string } };
    attachScrollChrome(windowLike.target, root, () => false);
    windowLike.scrollTo(200);
    expect(root.dataset.chrome).toBe("shown");
  });
});
