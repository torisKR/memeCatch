import { isAllowedLatpeedCheckoutUrl } from "@/lib/billing/latpeed.server";

type Dependencies = {
  getUser: () => Promise<{ id: string } | null>;
  registerIdentity: () => Promise<void>;
  getCheckoutUrl: () => string;
};

export function createLatpeedCheckoutHandler({
  getUser,
  registerIdentity,
  getCheckoutUrl,
}: Dependencies) {
  return async function handleLatpeedCheckout(request: Request): Promise<Response> {
    const user = await getUser();
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", "/pricing");
      return Response.redirect(login, 303);
    }

    const checkoutUrl = getCheckoutUrl();
    if (!isAllowedLatpeedCheckoutUrl(checkoutUrl)) {
      return Response.json(
        { ok: false, error: "checkout_not_configured" },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }

    try {
      await registerIdentity();
    } catch {
      return Response.json(
        { ok: false, error: "identity_registration_failed" },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }

    return Response.redirect(checkoutUrl, 303);
  };
}
