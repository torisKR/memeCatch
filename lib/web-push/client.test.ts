// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToWebPush } from "./client";

describe("web push subscription", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: {} }) },
    });
    Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: vi.fn() },
    });
  });

  it("does not request browser permission when VAPID is not configured", async () => {
    await expect(subscribeToWebPush("")).rejects.toThrow("invalid_vapid_key");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
});
