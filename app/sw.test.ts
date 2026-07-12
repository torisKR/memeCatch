import type { RuntimeCaching, SerwistOptions } from "serwist";
import { NetworkFirst, NetworkOnly } from "serwist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: undefined as SerwistOptions | undefined,
}));

vi.mock("serwist", async (importOriginal) => {
  const actual = await importOriginal<typeof import("serwist")>();

  return {
    ...actual,
    Serwist: class {
      constructor(config: SerwistOptions) {
        state.config = config;
      }

      addEventListeners() {}
    },
  };
});

const ORIGIN = "https://memecatch.test";

function navigationRequest(path: string, headers: HeadersInit = {}): Request {
  const request = new Request(`${ORIGIN}${path}`, { headers });
  Object.defineProperty(request, "mode", { value: "navigate" });
  return request;
}

function rscRequest(
  path: string,
  { cookie, prefetch = false }: { cookie: string; prefetch?: boolean },
): Request {
  return new Request(`${ORIGIN}${path}`, {
    headers: {
      RSC: "1",
      ...(prefetch ? { "Next-Router-Prefetch": "1" } : {}),
      cookie,
    },
  });
}

function firstMatchingRoute(request: Request): RuntimeCaching {
  const url = new URL(request.url);
  const sameOrigin = url.origin === ORIGIN;
  const routes = state.config?.runtimeCaching ?? [];
  const route = routes.find(({ matcher, method = "GET" }) => {
    if (method !== request.method) return false;
    if (typeof matcher === "function") {
      return Boolean(matcher({ event: {} as ExtendableEvent, request, sameOrigin, url }));
    }
    if (typeof matcher === "string") return matcher === url.href;
    matcher.lastIndex = 0;
    return matcher.test(url.href);
  });

  if (!route) throw new Error(`No service-worker route matched ${request.url}`);
  return route;
}

describe("service-worker runtime caching", () => {
  beforeEach(async () => {
    vi.resetModules();
    state.config = undefined;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("self", {
      __SW_MANIFEST: [],
      location: { origin: ORIGIN },
    });
    await import("@/app/sw");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("never handles request-dependent document navigations with an HTML cache", () => {
    const requests = [
      navigationRequest("/products", { cookie: "memecatch_locale=ko" }),
      navigationRequest("/products", { cookie: "memecatch_locale=en" }),
      navigationRequest("/my", { cookie: "memecatch_locale=ko" }),
      navigationRequest("/my", { cookie: "memecatch_locale=ko; sb-session=authenticated" }),
      navigationRequest("/submit", { cookie: "memecatch_locale=en; sb-session=authenticated" }),
      navigationRequest("/login", { cookie: "memecatch_locale=en" }),
    ];

    for (const request of requests) {
      const route = firstMatchingRoute(request);
      expect(route.handler, request.url).toBeInstanceOf(NetworkOnly);
      expect(route.handler, request.url).not.toBeInstanceOf(NetworkFirst);
    }
  });

  it("never caches request-dependent RSC payloads for client transitions, refreshes, or prefetches", () => {
    const requests = [false, true].flatMap((prefetch) => [
      rscRequest("/products?_rsc=same", { cookie: "memecatch_locale=ko", prefetch }),
      rscRequest("/products?_rsc=same", { cookie: "memecatch_locale=en", prefetch }),
      rscRequest("/my?_rsc=same", { cookie: "memecatch_locale=ko", prefetch }),
      rscRequest("/my?_rsc=same", {
        cookie: "memecatch_locale=ko; sb-session=authenticated",
        prefetch,
      }),
    ]);

    for (const request of requests) {
      const route = firstMatchingRoute(request);
      expect(route.handler, request.url).toBeInstanceOf(NetworkOnly);
      expect(route.handler, request.url).not.toBeInstanceOf(NetworkFirst);
    }
  });

  it("preserves runtime caching for non-document API and static assets", () => {
    const apiRoute = firstMatchingRoute(
      new Request(`${ORIGIN}/api/memes`, {
        headers: { RSC: "1", "Next-Router-Prefetch": "1" },
      }),
    );
    const imageRoute = firstMatchingRoute(new Request(`${ORIGIN}/meme.webp`));

    expect(apiRoute.handler).toBeInstanceOf(NetworkFirst);
    expect(apiRoute.handler).toMatchObject({ cacheName: "apis" });
    expect(imageRoute.handler).toMatchObject({ cacheName: "static-image-assets" });
  });
});
