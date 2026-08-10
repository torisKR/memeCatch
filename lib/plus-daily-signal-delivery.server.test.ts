import { describe, expect, it, vi } from "vitest";
import {
  buildPlusDailySignalCandidates,
  runPlusDailySignal,
  type PlusDailySignalAlertRow,
  type PlusDailySignalTranslationRow,
} from "@/lib/plus-daily-signal-delivery.server";

vi.mock("server-only", () => ({}));

function alert(overrides: Partial<PlusDailySignalAlertRow> = {}): PlusDailySignalAlertRow {
  return {
    meme_id: "saved-id",
    kind: "saved_rising",
    trend_score: 90,
    created_at: "2026-08-09T00:00:00.000Z",
    memes: {
      id: "saved-id",
      short_id: "saved123",
      slug: "saved-meme",
      title: "Saved meme",
      summary: "Saved summary",
      description: "Saved description",
      origin: "Saved origin",
      usage_note: "Use with close friends.",
      caution: "Do not target a real person.",
      updated_at: "2026-08-08T00:00:00.000Z",
      lifecycle_status: "rising",
      moderation_status: "approved",
      safety_level: "green",
    },
    ...overrides,
  };
}

describe("Plus Daily Signal candidate selection", () => {
  it("prioritizes saved rising signals and requires a current reviewed translation", () => {
    const alerts = [
      alert(),
      alert({
        meme_id: "interest-id",
        kind: "rising",
        trend_score: 99,
        memes: {
          ...alert().memes!,
          id: "interest-id",
          short_id: "interest1",
          slug: "interest-meme",
          title: "Interest meme",
          summary: "Interest summary",
        },
      }),
      alert({
        meme_id: "red-id",
        memes: { ...alert().memes!, id: "red-id", safety_level: "red" },
      }),
    ];
    const translations: PlusDailySignalTranslationRow[] = [
      {
        meme_id: "saved-id",
        locale: "en",
        localized_slug: "saved-meme-en",
        title: "Saved meme EN",
        summary: "Saved summary EN",
        description: "Saved description EN",
        origin: "Saved origin EN",
        usage_note: "Use it with close friends.",
        caution: "Do not target a real person.",
        status: "reviewed",
        source_updated_at: "2026-08-08T00:00:00.000Z",
      },
      {
        meme_id: "interest-id",
        locale: "en",
        localized_slug: "interest-meme-en",
        title: "Interest meme EN",
        summary: "Interest summary EN",
        description: "Interest description EN",
        origin: "Interest origin EN",
        usage_note: "Use it in a familiar context.",
        caution: "Avoid using it at work.",
        status: "reviewed",
        source_updated_at: "2026-08-07T00:00:00.000Z",
      },
    ];

    const candidates = buildPlusDailySignalCandidates("en", alerts, translations);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "saved-id",
      title: "Saved meme EN",
      source: "saved_rising",
      usageNote: "Use it with close friends.",
      caution: "Do not target a real person.",
      shareReady: true,
    });
  });

  it("keeps an incomplete current translation visible but disables its share action", () => {
    const candidates = buildPlusDailySignalCandidates(
      "en",
      [alert()],
      [
        {
          meme_id: "saved-id",
          locale: "en",
          localized_slug: "saved-meme-en",
          title: "Saved meme EN",
          summary: "Saved summary EN",
          description: "",
          origin: "Saved origin EN",
          usage_note: null,
          caution: null,
          status: "reviewed",
          source_updated_at: "2026-08-08T00:00:00.000Z",
        },
      ],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].shareReady).toBe(false);
  });

  it("keeps only approved or limited rising signals with green or yellow safety", () => {
    const candidates = buildPlusDailySignalCandidates("ko", [
      alert(),
      alert({
        meme_id: "limited-id",
        memes: { ...alert().memes!, id: "limited-id", moderation_status: "limited", safety_level: "yellow" },
      }),
      alert({
        meme_id: "archived-id",
        memes: { ...alert().memes!, id: "archived-id", lifecycle_status: "archived" },
      }),
    ]);

    expect(candidates.map((item) => item.id).sort()).toEqual(["limited-id", "saved-id"]);
  });
});

function queryBuilder<T>(data: T, error: { message: string } | null = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    overrideTypes: vi.fn().mockResolvedValue({ data, error }),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

describe("Plus Daily Signal delivery loop", () => {
  it("does not require a database client when the relay is not configured", async () => {
    await expect(
      runPlusDailySignal({ deliveryUrl: undefined, fromEmail: undefined }),
    ).resolves.toMatchObject({ status: "not_configured", claimed: 0 });
  });

  it("queues, claims, renders, sends, and marks one localized delivery sent", async () => {
    const delivery = {
      delivery_id: "delivery-1",
      user_id: "user-1",
      delivery_date: "2026-08-09",
      locale: "en",
      status: "processing",
    };
    const alertRows = [alert()];
    const translationRows = [
      {
        meme_id: "saved-id",
        locale: "en",
        localized_slug: "saved-meme-en",
        title: "Saved meme EN",
        summary: "Saved summary EN",
        description: "Saved description EN",
        origin: "Saved origin EN",
        usage_note: "Use it with close friends.",
        caution: "Do not target a real person.",
        status: "reviewed",
        source_updated_at: "2026-08-08T00:00:00.000Z",
      },
    ];
    const alertQuery = queryBuilder(alertRows);
    const translationQuery = queryBuilder(translationRows);
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: [delivery], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const admin = {
      rpc,
      from: vi.fn().mockReturnValueOnce(alertQuery).mockReturnValueOnce(translationQuery),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "user@example.com" } } }) } },
    } as unknown as NonNullable<Parameters<typeof runPlusDailySignal>[0]>["admin"];
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "provider-1" }), { status: 202 }),
    );

    const result = await runPlusDailySignal({
      now: new Date("2026-08-09T01:00:00.000Z"),
      admin,
      fetchImpl,
      deliveryUrl: "https://relay.example.test/send",
      deliveryToken: "relay-token",
      fromEmail: "signals@catchmeme.com",
    });

    expect(result).toMatchObject({ status: "ok", queued: 1, claimed: 1, sent: 1, failed: 0 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({
      from: "signals@catchmeme.com",
      to: ["user@example.com"],
      metadata: { deliveryId: "delivery-1", locale: "en" },
    });
    expect(payload.html).toContain("Saved meme EN");
    expect(rpc).toHaveBeenLastCalledWith("finish_plus_daily_signal_delivery", {
      p_delivery_id: "delivery-1",
      p_status: "sent",
      p_error_code: null,
      p_provider_message_id: "provider-1",
    });
  });

  it("does not count provider success when the delivery ledger cannot be finalized", async () => {
    const delivery = {
      delivery_id: "delivery-2",
      user_id: "user-2",
      delivery_date: "2026-08-09",
      locale: "ko",
      status: "processing",
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: [delivery], error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    const admin = {
      rpc,
      from: vi.fn().mockReturnValue(queryBuilder([alert()])),
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "user@example.com" } } }) } },
    } as unknown as NonNullable<Parameters<typeof runPlusDailySignal>[0]>["admin"];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));

    await expect(
      runPlusDailySignal({
        now: new Date("2026-08-09T01:00:00.000Z"),
        admin,
        fetchImpl,
        deliveryUrl: "https://relay.example.test/send",
        fromEmail: "signals@catchmeme.com",
      }),
    ).resolves.toMatchObject({ status: "failed", sent: 0, failed: 1 });
  });
});
