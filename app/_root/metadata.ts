import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/site";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/** Metadata that must be repeated because the app intentionally has two roots. */
export const SHARED_ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MemeCatch",
  },
  verification: {
    google: "tNpEvRKUbirAkwRA-XH0HJzDh8bCF6Waqctqu1Hak38",
    other: {
      "naver-site-verification": [
        "4973421614cb5e3682ed4c99e6deee5c66b1f587",
        "86e27030ca82a4577a7a16ed1ac0a70799c029ec",
      ],
      ...(ADSENSE_CLIENT ? { "google-adsense-account": ADSENSE_CLIENT } : {}),
    },
  },
};

export const ROOT_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f0f12",
};
