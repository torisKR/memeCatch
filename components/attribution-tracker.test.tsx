// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttributionTracker } from "./attribution-tracker";

describe("acquisition delivery independent of GA", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    for (const name of ["localStorage", "sessionStorage"]) {
      const values = new Map<string, string>();
      vi.stubGlobal(name, { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    }
    delete window.gtag;
    window.history.replaceState(null, "", "/?utm_source=threads&utm_medium=social");
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: vi.fn(() => true) });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); delete window.gtag; });

  it("records the durable acquisition immediately when GA is unavailable", async () => {
    render(<AttributionTracker />);
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(navigator.sendBeacon).mock.calls[0][1] as Blob;
    expect(JSON.parse(await payload.text())).toMatchObject({ eventName: "traffic_source", params: { source: "threads", medium: "social" } });
    act(() => vi.advanceTimersByTime(7000));
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("sends delayed GA once without duplicating the durable event", () => {
    render(<AttributionTracker />);
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    window.gtag = vi.fn();
    act(() => vi.advanceTimersByTime(150));
    expect(window.gtag).toHaveBeenCalledWith("event", "traffic_source", expect.objectContaining({ source: "threads" }));
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate acquisition on Strict Mode effect replay", () => {
    window.gtag = vi.fn();
    render(<StrictMode><AttributionTracker /></StrictMode>);
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    expect(vi.mocked(window.gtag).mock.calls.filter(([command, name]) => command === "event" && name === "traffic_source")).toHaveLength(1);
  });
});
