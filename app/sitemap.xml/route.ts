import sitemap, {
  renderSitemapXml,
  SITEMAP_SUCCESS_CACHE,
} from "@/lib/sitemap-document";

export const dynamic = "force-dynamic";

function memeUrlCount(xml: string): number {
  return xml.split("/memes/").length - 1;
}

export async function GET() {
  const entries = await sitemap();
  const xml = renderSitemapXml(entries);
  if (memeUrlCount(xml) === 0) {
    return new Response("Sitemap catalog unavailable\n", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_SUCCESS_CACHE,
    },
  });
}
