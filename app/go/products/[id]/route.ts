import { z } from "zod";

import { isValidAdpickBuyUrl } from "@/lib/affiliate/adpick-hotdeal";
import {
  getActiveAffiliateRedirect,
  recordAffiliateProductClick,
} from "@/lib/affiliate/repository.server";

type RedirectRepository = {
  getActiveRedirect(id: string): Promise<string | null>;
  recordClick(id: string, date: string): Promise<void>;
};

type RedirectContext = {
  params: Promise<{ id: string }>;
};

function getSeoulDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

export function createProductRedirectHandler(
  repository: RedirectRepository,
  now: () => Date,
) {
  return async function GET(
    request: Request,
    { params }: RedirectContext,
  ): Promise<Response> {
    const fallback = new URL("/products", request.url).toString();
    const parsedId = z.uuid().safeParse((await params).id);
    if (!parsedId.success) return redirect(fallback);

    let affiliateUrl: string | null;
    try {
      affiliateUrl = await repository.getActiveRedirect(parsedId.data);
    } catch {
      return redirect(fallback);
    }

    if (
      !affiliateUrl ||
      !isValidAdpickBuyUrl(affiliateUrl, process.env.ADPICK_AFFILIATE_ID)
    ) {
      return redirect(fallback);
    }

    try {
      await repository.recordClick(parsedId.data, getSeoulDate(now()));
    } catch {
      // A metrics failure must not prevent a validated purchase redirect.
    }

    return redirect(affiliateUrl);
  };
}

export const GET = createProductRedirectHandler(
  {
    getActiveRedirect: getActiveAffiliateRedirect,
    recordClick: recordAffiliateProductClick,
  },
  () => new Date(),
);
