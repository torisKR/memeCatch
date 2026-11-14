import type { Metadata } from "next";

export { default } from "@/app/(default)/not-found";

// A missing Arabic meme is not a published meme. `images: []` is set so the
// root `app/opengraph-image` file is not merged in (`hasOwnProperty("images")`).
export const metadata: Metadata = {
  title: "이 밈은 아직 없어요",
  robots: { index: false, follow: true },
  openGraph: { images: [] },
  twitter: { images: [] },
};
