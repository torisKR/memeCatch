import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import { NextResponse, type NextRequest } from "next/server";
import {
  RETIRED_PRODUCT_SHELL_HEADER,
  retiredProductRewritePath,
  type RetiredProductLocale,
} from "@/lib/retired-products";

const RENDER_TIMEOUT_MS = 4_000;

const COPY = {
  ko: {
    lang: "ko",
    title: "밈상품 페이지는 더 이상 운영하지 않아요",
    message: "밈상품 페이지는 더 이상 운영하지 않아요.",
    explore: "밈 탐색",
    exploreHref: "/explore",
  },
  en: {
    lang: "en",
    title: "Meme product pages are no longer available",
    message: "Meme product pages are no longer available.",
    explore: "Explore memes",
    exploreHref: "/en/explore",
  },
} as const satisfies Record<
  RetiredProductLocale,
  {
    lang: string;
    title: string;
    message: string;
    explore: string;
    exploreHref: string;
  }
>;

export type RetiredShellResult = { status: number; html: string };

/**
 * Listen port of this process. Behind a TLS proxy the public origin is
 * `https://<bind-host>:<port>`, and a request there fails the handshake.
 * The tombstone page is rendered once, over loopback HTTP.
 */
export function retiredProductLoopbackUrl(
  request: NextRequest,
  locale: RetiredProductLocale,
): string {
  const port = request.nextUrl.port || process.env.PORT || "3000";
  return `http://127.0.0.1:${port}${retiredProductRewritePath(locale)}`;
}

function fallbackDocument(locale: RetiredProductLocale): string {
  const copy = COPY[locale];
  return `<!DOCTYPE html>
<html lang="${copy.lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, follow"/>
<title>${copy.title}</title>
</head>
<body>
<main>
<h1>${copy.message}</h1>
<a href="${copy.exploreHref}">${copy.explore}</a>
</main>
</body>
</html>`;
}

function stripScripts(html: string): string {
  // Keep the inline $RC swap that replaces the loading shell. Drop the app
  // bundle so the tombstone does not hydrate against the retired URL.
  return html
    .replace(/<link\b[^>]*\bas=["']script["'][^>]*>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (script) => {
      if (/\bsrc\s*=/.test(script) || script.includes("__next_f")) return "";
      return script;
    });
}

function readResponse(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    response.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    response.on("error", reject);
  });
}

function requestDocument(url: URL): Promise<RetiredShellResult> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      url,
      {
        headers: {
          accept: "text/html",
          [RETIRED_PRODUCT_SHELL_HEADER]: "1",
        },
        timeout: RENDER_TIMEOUT_MS,
      },
      (response) => {
        void readResponse(response).then(
          (html) => resolve({ status: response.statusCode ?? 0, html }),
          reject,
        );
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("retired product shell timed out"));
    });
    req.on("error", reject);
    req.end();
  });
}

async function renderedShell(
  request: NextRequest,
  locale: RetiredProductLocale,
  load: (url: URL) => Promise<RetiredShellResult>,
): Promise<string | null> {
  if (request.headers.get(RETIRED_PRODUCT_SHELL_HEADER) === "1") return null;
  const url = new URL(retiredProductLoopbackUrl(request, locale));
  try {
    const rendered = await load(url);
    if (rendered.status !== 200 || !rendered.html.includes("<h1")) return null;
    return stripScripts(rendered.html);
  } catch {
    return null;
  }
}

/** 410 document. One loopback render of the App Router page; tests can inject it. */
export async function retiredProductDocument(
  request: NextRequest,
  locale: RetiredProductLocale,
  load: (url: URL) => Promise<RetiredShellResult> = requestDocument,
): Promise<NextResponse> {
  const html = (await renderedShell(request, locale, load)) ?? fallbackDocument(locale);
  return new NextResponse(html, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "x-robots-tag": "noindex",
    },
  });
}
