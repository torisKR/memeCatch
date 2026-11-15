import { describe, expect, it, vi } from "vitest";

import { createLatpeedCheckoutHandler } from "@/lib/billing/latpeed-checkout-handler";

const request = new Request("https://catchmeme.com/api/billing/checkout", { method: "POST" });

describe("createLatpeedCheckoutHandler", () => {
  it("redirects signed-out visitors to login", async () => {
    const registerIdentity = vi.fn();
    const handler = createLatpeedCheckoutHandler({
      getUser: vi.fn().mockResolvedValue(null),
      registerIdentity,
      getCheckoutUrl: () => "https://latpeed.com/products/plus1",
    });

    const response = await handler(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://catchmeme.com/login?next=%2Fpricing",
    );
    expect(registerIdentity).not.toHaveBeenCalled();
  });

  it("fails closed when the product URL is missing or unsafe", async () => {
    const registerIdentity = vi.fn();
    const handler = createLatpeedCheckoutHandler({
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      registerIdentity,
      getCheckoutUrl: () => "https://example.com/fake-checkout",
    });

    const response = await handler(request);

    expect(response.status).toBe(503);
    expect(registerIdentity).not.toHaveBeenCalled();
  });

  it("registers the authenticated identity before redirecting to Latpeed", async () => {
    const registerIdentity = vi.fn().mockResolvedValue(undefined);
    const handler = createLatpeedCheckoutHandler({
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      registerIdentity,
      getCheckoutUrl: () => "https://www.latpeed.com/products/plus1",
    });

    const response = await handler(request);

    expect(registerIdentity).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://www.latpeed.com/products/plus1",
    );
  });

  it("does not redirect when identity registration fails", async () => {
    const handler = createLatpeedCheckoutHandler({
      getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
      registerIdentity: vi.fn().mockRejectedValue(new Error("database unavailable")),
      getCheckoutUrl: () => "https://latpeed.com/products/plus1",
    });

    const response = await handler(request);

    expect(response.status).toBe(500);
  });
});
