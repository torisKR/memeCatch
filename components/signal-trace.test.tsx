import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignalTrace } from "@/components/signal-trace";
import type { LifecycleStatus } from "@/lib/labels";

function markup(status: LifecycleStatus) {
  return renderToStaticMarkup(<SignalTrace status={status} />);
}

/** 파형의 진폭 추이 — 좌표에서 기준선(16) 대비 최대 이탈을 앞/뒤 절반으로 잰다. */
function amplitudeProfile(status: LifecycleStatus) {
  const points = /<polyline points="([^"]+)"/.exec(markup(status))?.[1] ?? "";
  const deviations = points.split(" ").map((pair) => {
    const [, y] = pair.split(",").map(Number);
    return Math.abs(16 - y);
  });
  const half = Math.floor(deviations.length / 2);
  return {
    first: Math.max(...deviations.slice(0, half)),
    last: Math.max(...deviations.slice(half)),
  };
}

describe("SignalTrace", () => {
  it("draws a growing wave for a rising meme", () => {
    const { first, last } = amplitudeProfile("rising");
    expect(last).toBeGreaterThan(first * 1.5);
  });

  it("draws a decaying wave for a cooling meme", () => {
    const { first, last } = amplitudeProfile("cooling");
    expect(first).toBeGreaterThan(last * 1.5);
  });

  it("holds a steady wave while a meme is trending", () => {
    const { first, last } = amplitudeProfile("active");
    expect(Math.abs(first - last)).toBeLessThan(1);
  });

  it("flattens the wave for an archived meme", () => {
    expect(amplitudeProfile("archived").first).toBeLessThan(2);
  });

  it("starts a rising wave above sub-pixel amplitude so the growth stays visible", () => {
    // 초반 진폭이 0에 가까우면 급상승이 "평평한 선"으로 읽힌다(실제 회귀 사례).
    expect(amplitudeProfile("rising").first).toBeGreaterThan(1.5);
  });

  it("marks only live stages with a leading dot", () => {
    expect(markup("rising")).toContain("<circle");
    expect(markup("active")).toContain("<circle");
    expect(markup("cooling")).not.toContain("<circle");
    expect(markup("archived")).not.toContain("<circle");
  });

  it("animates the draw only while a meme is rising", () => {
    expect(markup("rising")).toContain("signal-draw");
    expect(markup("active")).not.toContain("signal-draw");
  });

  it("names the stage for screen readers", () => {
    expect(markup("rising")).toContain("급상승");
    expect(markup("archived")).toContain("추억");
  });
});
