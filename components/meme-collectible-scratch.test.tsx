// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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
    const reveal = vi.fn(); const start = vi.fn(); render(<MemeCollectibleScratch cardId={card.id} card={card} revealed={false} onStart={start} onReveal={reveal}/>);
    expect(screen.queryByText("PPAP")).toBeNull(); expect(screen.getByTestId("scratch-canvas").dataset.canvasState).toBe("unavailable");
    const user = userEvent.setup(); await user.tab(); expect(document.activeElement).toBe(screen.getByTestId("scratch-canvas")); await user.keyboard("{Enter}"); expect(reveal).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });
  it("counts real scaled area, preserves progress across resize, and recovers canceled pointers", async () => {
    const reveal = vi.fn(); const start = vi.fn(); const rendered = render(<MemeCollectibleScratch cardId={card.id} card={card} revealed={false} onStart={start} onReveal={reveal}/>);
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
    expect(start).toHaveBeenCalledOnce(); await waitFor(() => expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100"));
    rendered.rerender(<MemeCollectibleScratch cardId={card.id} card={card} revealed onStart={start} onReveal={reveal}/>);
    expect(screen.getByTestId("scratch-canvas").dataset.complete).toBe("true");
    await waitFor(() => expect(screen.queryByTestId("scratch-canvas")).toBeNull()); expect(screen.getByRole("status").textContent).toContain("공개됐어요");
  });
  it("erases coarse connecting strokes at full opacity to match counted area, including resize replay", () => {
    const erasedStyles: unknown[][] = [];
    context.stroke = vi.fn(() => { if (context.globalCompositeOperation === "destination-out") erasedStyles.push([context.globalAlpha, context.strokeStyle]); });
    render(<MemeCollectibleScratch cardId={card.id} card={card} revealed={false} onStart={vi.fn()} onReveal={vi.fn()}/>);
    const canvas = screen.getByTestId("scratch-canvas");
    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 55, clientY: 90 });
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 325, clientY: 90 });
    resize?.();
    expect(erasedStyles.length).toBeGreaterThanOrEqual(4);
    expect(erasedStyles.every(([alpha, stroke]) => alpha === 1 && stroke === "#000")).toBe(true);
    expect(context.fillStyle).toBe("#000");
  });
  it("consumes coalesced pointer samples so fast swipes leave a continuous scratch trail", () => {
    render(<MemeCollectibleScratch cardId={card.id} card={card} revealed={false} onStart={vi.fn()} onReveal={vi.fn()}/>);
    const canvas = screen.getByTestId("scratch-canvas");
    fireEvent.pointerDown(canvas, { pointerId: 12, clientX: 55, clientY: 80 });
    const move = new TestPointerEvent("pointermove", { bubbles: true, pointerId: 12, clientX: 325, clientY: 80 });
    Object.defineProperty(move, "getCoalescedEvents", { value: () => [
      new TestPointerEvent("pointermove", { pointerId: 12, clientX: 120, clientY: 80 }),
      new TestPointerEvent("pointermove", { pointerId: 12, clientX: 220, clientY: 80 }),
      new TestPointerEvent("pointermove", { pointerId: 12, clientX: 325, clientY: 80 }),
    ] });
    fireEvent(canvas, move);
    expect(Number(canvas.parentElement!.parentElement!.dataset.scratchProgress)).toBeGreaterThan(4);
    expect((context.ellipse as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(7);
  });
  it("ships an opaque generic back in SSR even if a full card was supplied", () => {
    const markup = renderToStaticMarkup(<MemeCollectibleScratch cardId={card.id} card={card} revealed={false} onStart={vi.fn()} onReveal={vi.fn()}/>);
    for (const identifying of ["PPAP", "pen-pineapple", "pineapple", "NO. 0001", "<svg", "/memes/test"]) expect(markup).not.toContain(identifying);
    expect(markup).toContain("아직 모르는 한 장"); expect(markup).toContain('data-canvas-state="pending"');
  });
  it("shows a pointer-follow brush without fetching or erasing on hover, then starts once", async () => {
    const start = vi.fn(); const reveal = vi.fn();
    const rendered = render(<MemeCollectibleScratch cardId={card.id} card={null} revealed={false} onStart={start} onReveal={reveal}/>);
    const canvas = screen.getByTestId("scratch-canvas");
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 180, clientY: 200 });
    await waitFor(() => expect(canvas.parentElement!.dataset.pointer).toBe("true"));
    expect(start).not.toHaveBeenCalled(); expect(reveal).not.toHaveBeenCalled();
    expect(canvas.parentElement!.parentElement!.dataset.scratchProgress).toBe("0");
    expect(canvas.parentElement!.style.getPropertyValue("--scratch-x")).toBeTruthy();
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 180, clientY: 200 }); fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(start).toHaveBeenCalledOnce();
    expect(screen.queryByText("PPAP")).toBeNull();
    rendered.rerender(<MemeCollectibleScratch cardId={card.id} card={card} revealed={false} onStart={start} onReveal={reveal}/>);
    expect(screen.getByText("PPAP").closest('[aria-hidden="true"]')).toBeTruthy();
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 190, clientY: 220 }); fireEvent.pointerCancel(canvas, { pointerId: 2 });
    expect(start).toHaveBeenCalledOnce(); expect(captures.size).toBe(0);
  });
  it("cleans up motion, dust and pointer capture on unmount and suppresses tilt for reduced motion", async () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: true })) });
    const rendered = render(<MemeCollectibleScratch cardId={card.id} card={null} revealed={false} onStart={vi.fn()} onReveal={vi.fn()}/>);
    const canvas = screen.getByTestId("scratch-canvas");
    fireEvent.pointerDown(canvas, { pointerId: 9, clientX: 200, clientY: 170 });
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
    expect(canvas.parentElement!.style.getPropertyValue("--tilt-x")).toBe("0deg");
    expect(document.querySelector("[data-scratch-dust]")?.children.length).toBe(0);
    expect(captures.size).toBe(1); rendered.unmount(); expect(captures.size).toBe(0);
    Reflect.deleteProperty(window, "matchMedia");
  });
});
