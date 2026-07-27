import { describe, expect, it } from "vitest";
import {
  type StoredAttribution,
  SESSION_TIMEOUT_MS,
  classifyReferrerHost,
  decideTouches,
  detectInAppBrowser,
  hostOf,
  parseUtm,
  resolveAttribution,
  toGtagParams,
} from "./attribution";

/** 실제 앱이 보내는 UA 원문 — 토큰 순서 회귀를 잡기 위해 그대로 둔다. */
const UA = {
  // 스레드 UA에는 Instagram 토큰이 함께 들어 있다. Barcelona가 먼저 매칭돼야 한다.
  threads:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.109 (iPhone14,2; iOS 17_0; ko_KR) Barcelona 302.0.0.23.109",
  instagram:
    "Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Instagram 302.0.0.23.109 Android",
  kakaotalk:
    "Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 KAKAOTALK 10.4.3",
  naverApp:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 NAVER(inapp; search; 2000; 12.9.4; 12)",
  facebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/440.0.0.32.108;FBBV/123]",
  safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

const SELF = "catchmeme.com";

describe("detectInAppBrowser", () => {
  it("스레드 UA는 Instagram 토큰이 섞여 있어도 threads로 판별한다", () => {
    // 이 순서가 뒤집히면 스레드 유입이 전부 instagram으로 오분류된다.
    expect(detectInAppBrowser(UA.threads)).toEqual({
      app: "threads",
      source: "threads",
    });
  });

  it("인스타그램·카카오톡·네이버앱·페이스북을 각각 판별한다", () => {
    expect(detectInAppBrowser(UA.instagram)?.source).toBe("instagram");
    expect(detectInAppBrowser(UA.kakaotalk)?.source).toBe("kakaotalk");
    expect(detectInAppBrowser(UA.naverApp)?.source).toBe("naver");
    expect(detectInAppBrowser(UA.facebook)?.source).toBe("facebook");
  });

  it("일반 브라우저와 빈 UA는 null", () => {
    expect(detectInAppBrowser(UA.safari)).toBeNull();
    expect(detectInAppBrowser("")).toBeNull();
    expect(detectInAppBrowser(undefined)).toBeNull();
  });
});

describe("hostOf", () => {
  it("호스트만 뽑고 www.를 제거한다", () => {
    expect(hostOf("https://www.naver.com/search?q=1")).toBe("naver.com");
  });

  it("빈 문자열·잘못된 URL은 null", () => {
    expect(hostOf("")).toBeNull();
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
});

describe("classifyReferrerHost", () => {
  it("검색엔진은 organic으로 분류한다", () => {
    expect(classifyReferrerHost("naver.com", SELF)).toEqual({
      source: "naver",
      medium: "organic",
    });
    expect(classifyReferrerHost("google.co.kr", SELF)?.medium).toBe("organic");
  });

  it("AI 검색도 별도 source로 분류한다", () => {
    expect(classifyReferrerHost("chatgpt.com", SELF)).toEqual({
      source: "chatgpt",
      medium: "organic",
    });
  });

  it("스레드 리다이렉터(l.threads.com)를 threads로 접는다", () => {
    expect(classifyReferrerHost("l.threads.com", SELF)).toEqual({
      source: "threads",
      medium: "social",
    });
  });

  it("모르는 외부 도메인은 referral, 호스트를 source로 쓴다", () => {
    expect(classifyReferrerHost("example.co.kr", SELF)).toEqual({
      source: "example.co.kr",
      medium: "referral",
    });
  });

  it("자사 도메인과 서브도메인은 유입원이 아니다", () => {
    expect(classifyReferrerHost(SELF, SELF)).toBeNull();
    expect(classifyReferrerHost(`blog.${SELF}`, SELF)).toBeNull();
  });
});

describe("parseUtm", () => {
  it("UTM 5종을 읽고 소문자로 정규화한다", () => {
    expect(
      parseUtm("?utm_source=Threads&utm_medium=Social&utm_campaign=Launch"),
    ).toMatchObject({
      source: "threads",
      medium: "social",
      campaign: "launch",
    });
  });

  it("utm_source가 없으면 ref, source 순으로 폴백한다", () => {
    expect(parseUtm("?ref=threads").source).toBe("threads");
    expect(parseUtm("?source=newsletter").source).toBe("newsletter");
  });

  it("빈 값은 undefined로 떨어뜨린다", () => {
    expect(parseUtm("?utm_source=&utm_medium=   ").source).toBeUndefined();
    expect(parseUtm("").medium).toBeUndefined();
  });
});

describe("resolveAttribution", () => {
  it("UTM이 있으면 최우선으로 쓰고 근거를 utm으로 남긴다", () => {
    const result = resolveAttribution({
      search: "?utm_source=threads&utm_medium=organic_social&utm_content=post_01",
      referrer: "",
      userAgent: UA.threads,
      selfHost: SELF,
    });

    expect(result).toMatchObject({
      source: "threads",
      medium: "organic_social",
      content: "post_01",
      resolvedBy: "utm",
      // UTM으로 판별이 끝나도 인앱 여부는 별도 정보로 함께 싣는다.
      inAppBrowser: "threads",
    });
  });

  it("리퍼러가 비어도 인앱 브라우저로 유입원을 복원한다", () => {
    // 이게 핵심: GA4 기본 수집이라면 이 요청은 (direct)/(none)이 된다.
    const result = resolveAttribution({
      search: "",
      referrer: "",
      userAgent: UA.kakaotalk,
      selfHost: SELF,
    });

    expect(result).toMatchObject({
      source: "kakaotalk",
      medium: "social",
      resolvedBy: "inapp",
      inAppBrowser: "kakaotalk",
    });
  });

  it("UTM·인앱 단서가 없으면 리퍼러로 판별한다", () => {
    const result = resolveAttribution({
      search: "",
      referrer: "https://search.naver.com/search.naver?query=밈",
      userAgent: UA.safari,
      selfHost: SELF,
    });

    expect(result).toMatchObject({
      source: "naver",
      medium: "organic",
      referrerHost: "search.naver.com",
      resolvedBy: "referrer",
    });
  });

  it("광고 클릭 ID는 UTM 다음 순위로 쓴다", () => {
    const result = resolveAttribution({
      search: "?gclid=abc123",
      referrer: "",
      userAgent: UA.safari,
      selfHost: SELF,
    });

    expect(result).toMatchObject({
      source: "google",
      medium: "cpc",
      resolvedBy: "click_id",
    });
  });

  it("사이트 내부 이동은 유입으로 잡지 않는다", () => {
    const result = resolveAttribution({
      search: "",
      referrer: `https://${SELF}/memes/abc`,
      userAgent: UA.safari,
      selfHost: SELF,
    });

    expect(result).toMatchObject({
      source: "(direct)",
      medium: "(none)",
      resolvedBy: "direct",
    });
  });

  it("단서가 전혀 없으면 (direct)/(none)", () => {
    const result = resolveAttribution({
      search: "",
      referrer: "",
      userAgent: UA.safari,
      selfHost: SELF,
    });

    expect(result).toMatchObject({
      source: "(direct)",
      medium: "(none)",
      resolvedBy: "direct",
    });
  });
});

describe("decideTouches", () => {
  const NOW = 1_700_000_000_000;

  const threads: StoredAttribution = {
    source: "threads",
    medium: "social",
    resolvedBy: "inapp",
    ts: NOW - 60_000,
  };
  const direct = {
    source: "(direct)",
    medium: "(none)",
    resolvedBy: "direct" as const,
  };

  it("최초 유입은 한 번 기록되면 덮어쓰지 않는다", () => {
    const result = decideTouches({
      current: { source: "naver", medium: "organic", resolvedBy: "referrer" },
      storedFirst: threads,
      storedSession: null,
      now: NOW,
    });

    // 지금은 네이버로 들어왔어도 이 사용자를 처음 데려온 건 스레드다.
    expect(result.firstTouch.source).toBe("threads");
    expect(result.isNewUser).toBe(false);
  });

  it("첫 방문이면 현재 유입을 최초 유입으로 기록한다", () => {
    const result = decideTouches({
      current: { source: "threads", medium: "social", resolvedBy: "inapp" },
      storedFirst: null,
      storedSession: null,
      now: NOW,
    });

    expect(result.firstTouch).toMatchObject({ source: "threads", ts: NOW });
    expect(result.isNewUser).toBe(true);
    expect(result.sessionExpired).toBe(true);
  });

  it("세션 중 새로고침은 기존 세션 유입원을 유지한다", () => {
    // 이 규칙이 없으면 사이트 내 새로고침마다 threads → (direct)로 덮여
    // 소셜 유입이 통째로 증발한다.
    const result = decideTouches({
      current: direct,
      storedFirst: threads,
      storedSession: threads,
      now: NOW,
    });

    expect(result.sessionTouch.source).toBe("threads");
    expect(result.sessionExpired).toBe(false);
  });

  it("세션 중이라도 새 단서가 있으면 세션 유입원을 갱신한다", () => {
    const result = decideTouches({
      current: { source: "naver", medium: "organic", resolvedBy: "referrer" },
      storedFirst: threads,
      storedSession: threads,
      now: NOW,
    });

    expect(result.sessionTouch.source).toBe("naver");
  });

  it("30분이 지나면 새 세션으로 본다", () => {
    const result = decideTouches({
      current: direct,
      storedFirst: threads,
      storedSession: { ...threads, ts: NOW - SESSION_TIMEOUT_MS - 1 },
      now: NOW,
    });

    expect(result.sessionExpired).toBe(true);
    expect(result.sessionTouch.source).toBe("(direct)");
  });
});

describe("toGtagParams", () => {
  it("undefined 값을 빼고 prefix를 붙인다", () => {
    const params = toGtagParams(
      {
        source: "threads",
        medium: "social",
        resolvedBy: "inapp",
        inAppBrowser: "threads",
      },
      "first_",
    );

    expect(params).toEqual({
      first_source: "threads",
      first_medium: "social",
      first_resolved_by: "inapp",
      first_in_app_browser: "threads",
    });
    expect(params).not.toHaveProperty("first_campaign");
  });

  it("GA4 파라미터 상한(100자)을 넘지 않는다", () => {
    const params = toGtagParams({
      source: "a".repeat(300),
      medium: "referral",
      resolvedBy: "referrer",
    });

    expect(params.source).toHaveLength(100);
  });
});
