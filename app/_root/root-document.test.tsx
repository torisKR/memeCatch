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

it("does not interrupt reading with automatic release or install popups", async () => {
  const { RootDocument } = await import("./root-document");
  const { ChangelogModal } = await import("@/components/changelog-modal");
  const { PwaInstall } = await import("@/components/pwa-install");
  const document = RootDocument({ locale: "ko", children: null });
  expect(includesComponent(document, ChangelogModal)).toBe(false);
  expect(includesComponent(document, PwaInstall)).toBe(false);
});
