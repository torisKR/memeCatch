import type { Metadata } from "next";
import NotFound from "@/app/(default)/not-found";

export const metadata: Metadata = {
  title: "이 밈은 아직 없어요",
  robots: { index: false, follow: false },
};

export default function MissingPublicMemePage() {
  return <NotFound />;
}
