// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchShortcut } from "./search-shortcut";

function press(target: Element, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = '<input id="header-search" /><textarea id="comment"></textarea><button id="other">x</button>';
  // jsdom has no layout: report the header search as visible.
  Object.defineProperty(document.getElementById("header-search")!, "offsetParent", { configurable: true, get: () => document.body });
});

afterEach(cleanup);

describe("SearchShortcut", () => {
  it("moves focus to the header search when / is pressed outside a field", () => {
    render(<SearchShortcut />);
    const event = press(document.getElementById("other")!);
    expect(document.activeElement?.id).toBe("header-search");
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves / alone while the reader is typing", () => {
    render(<SearchShortcut />);
    const comment = document.getElementById("comment") as HTMLTextAreaElement;
    comment.focus();
    const event = press(comment);
    expect(document.activeElement?.id).toBe("comment");
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores the key with a modifier or when the header search is hidden", () => {
    render(<SearchShortcut />);
    press(document.getElementById("other")!, { ctrlKey: true });
    expect(document.activeElement?.id).not.toBe("header-search");

    Object.defineProperty(document.getElementById("header-search")!, "offsetParent", { configurable: true, get: () => null });
    press(document.getElementById("other")!);
    expect(document.activeElement?.id).not.toBe("header-search");
  });
});
