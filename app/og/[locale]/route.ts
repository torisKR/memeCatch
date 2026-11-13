import { OG_DEFAULT_LOCALES, isOgDefaultLocale } from "@/lib/og-default-image";
import { renderOgDefaultImage } from "@/lib/og-default-card";

type RouteContext = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return OG_DEFAULT_LOCALES.map((locale) => ({ locale }));
}

/** Stable locale-default preview. Home, detail, and pricing all point here. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { locale } = await params;
  if (!isOgDefaultLocale(locale)) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const image = await renderOgDefaultImage(locale);
  const headers = new Headers(image.headers);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(image.body, { status: image.status, headers });
}
