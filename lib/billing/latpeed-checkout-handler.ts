import { isAllowedLatpeedCheckoutUrl } from "@/lib/billing/latpeed.server";

type Dependencies = {
  getUser: () => Promise<{ id: string } | null>;
  registerIdentity: () => Promise<void>;
  getCheckoutUrl: () => string;
  /**
   * 결제 링크 호스트 검증기. 제공자를 바꿔도(예: Unifi Pay) 흐름은 같으므로
   * 검증만 갈아끼운다. 미지정 시 기존 Latpeed 규칙을 그대로 쓴다.
   */
  isAllowedUrl?: (url: string) => boolean;
};

export function createLatpeedCheckoutHandler({
  getUser,
  registerIdentity,
  getCheckoutUrl,
  isAllowedUrl = isAllowedLatpeedCheckoutUrl,
}: Dependencies) {
  return async function handleLatpeedCheckout(request: Request): Promise<Response> {
    const user = await getUser();
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", "/pricing");
      return Response.redirect(login, 303);
    }

    const checkoutUrl = getCheckoutUrl();
    if (!isAllowedUrl(checkoutUrl)) {
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
