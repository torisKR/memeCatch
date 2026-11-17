import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { withPreviewDeadline } from "./explore-preview-deadline.server";

afterEach(() => vi.useRealTimers());

describe("explore preview deadline", () => {
  it("returns promptly and aborts when a request disconnects", async () => {
    const controller = new AbortController();
    let received: AbortSignal | undefined;
    let finish!: () => void;
    const work = new Promise<void>((resolve) => { finish = resolve; });
    const result = withPreviewDeadline(async (signal) => { received = signal; await work; return 1; }, controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await result).toBeNull();
    expect(received?.aborted).toBe(true);
    finish();
    await work;
  });

  it("times out stalled work and keeps its bounded slots until it settles", async () => {
    vi.useFakeTimers();
    const releases: Array<() => void> = [];
    const signals: AbortSignal[] = [];
    const requests = Array.from({ length: 4 }, () => withPreviewDeadline(async (signal) => {
      signals.push(signal);
      await new Promise<void>((resolve) => releases.push(resolve));
      return 1;
    }));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(await Promise.all(requests)).toEqual([null, null, null, null]);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(await withPreviewDeadline(async () => 2)).toBeNull();
    releases.forEach((release) => release());
    await vi.waitFor(async () => expect(await withPreviewDeadline(async () => 2)).toBe(2));
  });
});
