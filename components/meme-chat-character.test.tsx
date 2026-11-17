// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MemeChatCharacter } from "./meme-chat-character";
afterEach(cleanup);
it("uses a real GIF loop with a static reduced-motion alternative", () => {
  const { container } = render(<MemeChatCharacter />);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/images/meme-chat/mascot-wave.gif");
  expect(container.querySelector("source")?.getAttribute("media")).toBe("(prefers-reduced-motion: reduce)");
  expect(container.querySelector("source")?.getAttribute("srcset")).toBe("/images/meme-chat/mascot-idle.png");
});
it("keeps completed avatars still and falls back if an animation fails", () => {
  const { container, rerender } = render(<MemeChatCharacter state="ready" />);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/images/meme-chat/mascot-idle.png");
  rerender(<MemeChatCharacter state="searching" />);
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")?.getAttribute("src")).toBe("/images/meme-chat/mascot-idle.png");
});
