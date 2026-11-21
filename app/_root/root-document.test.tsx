import { Children, isValidElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

function includesComponent(node: ReactNode, component: unknown): boolean {
  return Children.toArray(node).some((child) => isValidElement<{ children?: ReactNode }>(child)
    && (child.type === component || includesComponent(child.props.children, component)));
}

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("mounts durable acquisition even when GA has no measurement ID", async () => {
  vi.stubEnv("NEXT_PUBLIC_GA_ID", "");
  vi.resetModules();
  const { RootDocument } = await import("./root-document");
  const { AttributionTracker } = await import("@/components/attribution-tracker");
  expect(includesComponent(RootDocument({ locale: "ko", children: null }), AttributionTracker)).toBe(true);
});

function findElements(node: ReactNode, type: string): { props: Record<string, unknown> }[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    const self = child.type === type ? [child as unknown as { props: Record<string, unknown> }] : [];
    return [...self, ...findElements(child.props.children, type)];
  });
}

it("advertises both meme RSS feeds on the Korean root only", async () => {
  const { RootDocument } = await import("./root-document");
  const feeds = (locale: "ko" | "en") =>
    findElements(RootDocument({ locale, children: null }), "link")
      .filter((link) => link.props.type === "application/rss+xml")
      .map((link) => [link.props.rel, link.props.href]);

  expect(feeds("ko")).toEqual([
    ["alternate", "/feed.xml"],
    ["alternate", "/feed/updated.xml"],
  ]);
  expect(feeds("en")).toEqual([]);
});
