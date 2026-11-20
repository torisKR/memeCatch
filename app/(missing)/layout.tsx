import type { Metadata, Viewport } from "next";
import { RootDocument } from "@/app/_root/root-document";
import { ROOT_VIEWPORT, SHARED_ROOT_METADATA } from "@/app/_root/metadata";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import "../globals.css";

export const metadata: Metadata = {
  ...SHARED_ROOT_METADATA,
  title: { default: "이 밈은 아직 없어요", template: "%s | 밈캐치" },
};

export const viewport: Viewport = ROOT_VIEWPORT;

/**
 * Root layout for the missing-meme rewrite target only. It has no loading.tsx
 * on purpose: a Suspense boundary above the page would start streaming before
 * notFound() runs, and a streamed response keeps status 200 (a soft 404).
 */
export default function MissingLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument locale={DEFAULT_LOCALE}>{children}</RootDocument>;
}
