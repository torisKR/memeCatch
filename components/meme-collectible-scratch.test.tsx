// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeCollectibleCard } from "@/lib/meme-collectible";
vi.mock("@/lib/i18n-client", () => ({ useLocale: () => ({ locale: "ko" }) }));
import { MemeCollectibleScratch } from "./meme-collectible-scratch";
const card: MemeCollectibleCard = { id: "mc-0001", cardNo: 1, edition: 1, artSeed: 1, memeId: "meme", title: "PPAP", slug: "ppap", href: "/memes/test", summary: "노래", category: "song", originYear: null, thumbnailUrl: null, artMotif: "pen-pineapple", artSymbols: ["pen", "apple", "pineapple"], artComposition: "exchange" };
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number; readonly pointerType: string;
  constructor(name: string, props: PointerEventInit = {}) { super(name, props); this.pointerId = props.pointerId ?? 1; this.pointerType = props.pointerType ?? "mouse"; }
}
let resize: (() => void) | null;
let captures: Set<number>;
let context: { [key: string]: unknown };
beforeEach(() => {
  resize = null; captures = new Set();
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 40, top: 20, width: 300, height: 420, right: 340, bottom: 440, x: 40, y: 20, toJSON: () => ({}) });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
  Object.defineProperty(HTMLCanvasElement.prototype, "setPointerCapture", { configurable: true, value: (id: number) => captures.add(id) });
  Object.defineProperty(HTMLCanvasElement.prototype, "hasPointerCapture", { configurable: true, value: (id: number) => captures.has(id) });
  Object.defineProperty(HTMLCanvasElement.prototype, "releasePointerCapture", { configurable: true, value: (id: number) => captures.delete(id) });
  context = Object.fromEntries(["setTransform", "fillRect", "beginPath", "moveTo", "lineTo", "stroke", "fill", "ellipse", "fillText"].map(key => [key, vi.fn()]));
  context.createLinearGradient = () => ({ addColorStop: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("scratch interaction", () => {
  it("supports keyboard reveal when a canvas is unavailable", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const reveal = vi.fn(); render(<MemeCollectibleScratch card={card} revealed={false} onReveal={reveal}/>);
    const user = userEvent.setup(); await user.tab(); await user.keyboard("{Enter}"); expect(reveal).toHaveBeenCalledOnce();
  });
  it("counts real scaled area, preserves progress across resize, and recovers canceled pointers", () => {
    const reveal = vi.fn(); const rendered = render(<MemeCollectibleScratch card={card} revealed={false} onReveal={reveal}/>);
    const canvas = screen.getByTestId("scratch-canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(600); expect(canvas.height).toBe(840);
    fireEvent.pointerDown(canvas, { pointerId: 3, clientX: 150, clientY: 150 });
    for (let i = 0; i < 20; i++) fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 150, clientY: 150 });
    expect(reveal).not.toHaveBeenCalled(); const progress = canvas.parentElement!.parentElement!.dataset.scratchProgress;
    resize?.(); expect(canvas.parentElement!.parentElement!.dataset.scratchProgress).toBe(progress);
    fireEvent.pointerCancel(canvas, { pointerId: 3 }); expect(captures.size).toBe(0);
    for (let y = 65; y <= 305 && !reveal.mock.calls.length; y += 40) {
      fireEvent.pointerDown(canvas, { pointerId: 4, clientX: 48, clientY: y });
      fireEvent.pointerMove(canvas, { pointerId: 4, clientX: 332, clientY: y });
      fireEvent.pointerUp(canvas, { pointerId: 4 });
    }
    expect(reveal).toHaveBeenCalledOnce(); expect(captures.size).toBe(0);
    rendered.rerender(<MemeCollectibleScratch card={card} revealed onReveal={reveal}/>);
    expect(screen.queryByTestId("scratch-canvas")).toBeNull(); expect(screen.getByRole("status").textContent).toContain("공개됐어요");
  });
  it("erases coarse connecting strokes at full opacity to match counted area, including resize replay", () => {
    const erasedStyles: unknown[][] = [];
    context.stroke = vi.fn(() => { if (context.globalCompositeOperation === "destination-out") erasedStyles.push([context.globalAlpha, context.strokeStyle]); });
    render(<MemeCollectibleScratch card={card} revealed={false} onReveal={vi.fn()}/>);
    const canvas = screen.getByTestId("scratch-canvas");
    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 55, clientY: 90 });
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 325, clientY: 90 });
    resize?.();
    expect(erasedStyles.length).toBeGreaterThanOrEqual(4);
    expect(erasedStyles.every(([alpha, stroke]) => alpha === 1 && stroke === "#000")).toBe(true);
    expect(context.fillStyle).toBe("#000");
  });
});
