# Adpick Hotdeal Daily Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 애드픽 공식 핫딜 API를 하루 1회 동기화해 `/products`에 최신 제휴 상품을 표시하고, 안전한 클릭 집계 후 구매 추적 링크로 연결한다.

**Architecture:** Vercel Cron이 보호된 Route Handler를 하루 한 번 호출하고, 서버 전용 동기화 서비스가 애드픽 응답을 검증·정규화한 뒤 Supabase RPC로 원자 적용한다. 상품 페이지는 마지막 정상 스냅샷을 읽으며, 구매 버튼은 내부 상품 ID만 받는 리다이렉트 Route Handler를 거쳐 일별 클릭 수를 증가시킨다.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript, Zod 4, Supabase/PostgreSQL, Vercel Cron, Vitest, Tailwind CSS 4

## Global Constraints

- 동기화 원본은 `https://adpick.co.kr/apis/sdk_shopping_hotdeal.php` 하나로 고정한다.
- 동기화 주기는 하루 1회이며 `vercel.json`의 `0 21 * * *` 스케줄을 사용한다.
- `ADPICK_AFFILIATE_ID`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 환경변수다.
- 로그인 쿠키, 비밀번호, 브라우저 세션을 저장하거나 자동화에 사용하지 않는다.
- 외부 API 실패나 빈 목록은 기존 활성 상품을 변경하지 않는다.
- `판매 1위`, `베스트셀러`, `구매 폭주`처럼 판매량을 암시하는 문구를 사용하지 않는다.
- `밈캐치 인기`는 최근 7일 내부 클릭 수로만 정의하고 화면에 기준을 설명한다.
- API 상품명은 원문을 유지하고 UI·고지·버튼만 한국어·영어·일본어·중국어로 번역한다.
- 새 동기화 함수와 라우트 동작은 실패하는 테스트를 먼저 작성하고 RED를 확인한 뒤 구현한다.
- 기존 미커밋 상품·소식·다국어 작업을 보존하고 관련 파일의 변경을 덮어쓰지 않는다.

---

## File Map

### Create

- `vitest.config.mts` — Node 테스트 환경과 `@` 경로 별칭
- `lib/affiliate/types.ts` — 상품, 동기화, storefront 공용 타입
- `lib/affiliate/adpick-hotdeal.ts` — 애드픽 응답 스키마, 가격·URL·상품 키 정규화
- `lib/affiliate/adpick-hotdeal.test.ts` — 순수 파서 RED/GREEN 테스트
- `lib/affiliate/sync.server.ts` — API fetch, 오류 분류, RPC 기반 동기화 오케스트레이션
- `lib/affiliate/sync.server.test.ts` — 인증 이후 동기화 성공·실패·멱등 테스트
- `lib/affiliate/repository.server.ts` — Supabase 상품·동기화·클릭 데이터 접근
- `lib/affiliate/storefront.ts` — 할인율, 갱신 지연, 7일 클릭 순위 순수 계산
- `lib/affiliate/storefront.test.ts` — storefront 계산 테스트
- `app/api/cron/adpick-hotdeals/route.ts` — `CRON_SECRET` 보호 Cron GET
- `app/api/cron/adpick-hotdeals/route.test.ts` — 인증과 상태 코드 테스트
- `app/go/products/[id]/route.ts` — 클릭 기록 후 안전한 외부 리다이렉트
- `app/go/products/[id]/route.test.ts` — 오픈 리다이렉트·비활성 상품 방어 테스트
- `components/affiliate-product-card.tsx` — 핫딜 상품 카드
- `components/affiliate-product-card.test.tsx` — 서버 마크업 회귀 테스트
- `components/affiliate-product-grid.tsx` — 인기·핫딜 섹션과 빈 상태
- `supabase/migrations/20260713090000_affiliate_hotdeals.sql` — 테이블·RPC·권한
- `supabase/tests/affiliate_hotdeals.test.sql` — pgTAP 스키마·RPC 동작 테스트
- `vercel.json` — 하루 1회 Cron 등록

### Modify

- `package.json` — `test` 스크립트와 Vitest 개발 의존성
- `pnpm-lock.yaml` — 의존성 잠금
- `.env.example` — 서버 환경변수 이름과 설명
- `lib/database.types.ts` — migration 적용 후 Supabase 타입 재생성
- `lib/analytics.ts` — `affiliate_product_click` 이벤트 허용
- `lib/i18n-pages.ts` — 네 언어 핫딜·가격·갱신 문구
- `app/products/page.tsx` — 동적 핫딜, 인기, 기존 CPA 섹션 조합
- `app/products/loading.tsx` — 이미지 카드형 skeleton
- `README.md` — 로컬 동기화·환경변수·Cron 검증 절차

---

### Task 1: Vitest 기반과 애드픽 핫딜 파서

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vitest.config.mts`
- Create: `lib/affiliate/types.ts`
- Create: `lib/affiliate/adpick-hotdeal.test.ts`
- Create: `lib/affiliate/adpick-hotdeal.ts`

**Interfaces:**
- Produces: `NormalizedAffiliateProduct`
- Produces: `normalizeAdpickHotdeals(input: unknown, syncedAt: Date, affiliateId: string): NormalizedAffiliateProduct[]`
- Produces: `parseMoney(value: string): number | null`
- Produces: `isValidAdpickBuyUrl(value: string, affiliateId?: string): boolean`

- [ ] **Step 1: 테스트 러너를 설치하고 설정한다**

Run:

```bash
pnpm add -D vitest
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.mts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
```

- [ ] **Step 2: 파서의 실패 테스트를 작성한다**

Create `lib/affiliate/adpick-hotdeal.test.ts` with tests that import the missing functions and assert:

```ts
import { describe, expect, it } from "vitest";
import {
  isValidAdpickBuyUrl,
  normalizeAdpickHotdeals,
  parseMoney,
} from "@/lib/affiliate/adpick-hotdeal";

const validPayload = [{
  title: "실시간 핫딜",
  theme_code: 20,
  description: "현재 판매 가능한 상품",
  list: [{
    product_name: "테스트 상품",
    photo: "https://img.podgate.com/product.jpg",
    mall: "shop.example.com",
    mall_name: "테스트몰",
    mall_icon: "https://img.podgate.com/mall.png",
    price_sale: "12,900",
    price_org: "25,800",
    commission: "10%",
    buyurl: "https://adpick.co.kr/apis/goshopping.php?affid=member123&offer=abc12&url=https%3A%2F%2Fshop.example.com%2Fp%2F1",
  }],
}];

describe("parseMoney", () => {
  it.each([
    ["12,900", 12900],
    ["0", null],
    ["", null],
    ["가격문의", null],
  ])("converts %s", (value, expected) => {
    expect(parseMoney(value)).toBe(expected);
  });
});

describe("isValidAdpickBuyUrl", () => {
  it("accepts only the official HTTPS redirect with the configured affiliate id", () => {
    expect(isValidAdpickBuyUrl(validPayload[0].list[0].buyurl, "member123")).toBe(true);
    expect(isValidAdpickBuyUrl("https://evil.example/redirect", "member123")).toBe(false);
    expect(isValidAdpickBuyUrl(validPayload[0].list[0].buyurl, "other-member")).toBe(false);
  });
});

describe("normalizeAdpickHotdeals", () => {
  it("normalizes prices, removes affid from the key, and keeps source order", () => {
    const products = normalizeAdpickHotdeals(validPayload, new Date("2026-07-13T00:00:00Z"), "member123");
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      productName: "테스트 상품",
      salePrice: 12900,
      originalPrice: 25800,
      sourceRank: 0,
      provider: "adpick",
      sourceType: "hotdeal",
    });
    expect(products[0].externalKey).not.toContain("member123");
  });

  it("rejects empty lists and unsafe URLs", () => {
    expect(() => normalizeAdpickHotdeals([], new Date(), "member123")).toThrow("ADPICK_EMPTY_LIST");
    const unsafe = structuredClone(validPayload);
    unsafe[0].list[0].buyurl = "https://evil.example/redirect";
    expect(() => normalizeAdpickHotdeals(unsafe, new Date(), "member123")).toThrow("ADPICK_INVALID_PRODUCT");
  });
});
```

- [ ] **Step 3: RED를 확인한다**

Run:

```bash
pnpm test lib/affiliate/adpick-hotdeal.test.ts
```

Expected: FAIL because `@/lib/affiliate/adpick-hotdeal` does not exist.

- [ ] **Step 4: 타입과 최소 파서를 구현한다**

Create `lib/affiliate/types.ts` with exact public types:

```ts
export type AffiliateProvider = "adpick";
export type AffiliateSourceType = "hotdeal";

export type NormalizedAffiliateProduct = {
  provider: AffiliateProvider;
  sourceType: AffiliateSourceType;
  externalKey: string;
  themeCode: string | null;
  themeTitle: string;
  themeDescription: string;
  sourceRank: number;
  productName: string;
  imageUrl: string | null;
  mallDomain: string | null;
  mallName: string | null;
  mallIconUrl: string | null;
  salePrice: number | null;
  originalPrice: number | null;
  commissionLabel: string;
  affiliateUrl: string;
  syncedAt: string;
};

export type AffiliateStorefrontProduct = Omit<
  NormalizedAffiliateProduct,
  "commissionLabel" | "affiliateUrl" | "syncedAt"
> & {
  id: string;
  clickCount7d: number;
};

export type AffiliateStorefrontData = {
  hotdeals: AffiliateStorefrontProduct[];
  popular: AffiliateStorefrontProduct[];
  lastSuccessfulSyncAt: string | null;
  isStale: boolean;
};
```

Create `lib/affiliate/adpick-hotdeal.ts` using `z.array(themeSchema).min(1)`, `node:crypto#createHash("sha256")`, `URL`, and these rules:

```ts
export function parseMoney(value: string): number | null {
  const digits = value.replaceAll(",", "").trim();
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function isValidAdpickBuyUrl(value: string, affiliateId?: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "adpick.co.kr" &&
      url.pathname === "/apis/goshopping.php" &&
      Boolean(url.searchParams.get("offer")) &&
      Boolean(url.searchParams.get("url")) &&
      (!affiliateId || url.searchParams.get("affid") === affiliateId);
  } catch {
    return false;
  }
}
```

`normalizeAdpickHotdeals` must flatten themes, require every buy URL to match the supplied affiliate ID, reject non-HTTPS images, deduplicate by external key, preserve the first source rank, and throw only these stable error messages: `ADPICK_INVALID_RESPONSE`, `ADPICK_EMPTY_LIST`, `ADPICK_INVALID_PRODUCT`.

- [ ] **Step 5: GREEN과 전체 테스트를 확인한다**

Run:

```bash
pnpm test lib/affiliate/adpick-hotdeal.test.ts
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add package.json pnpm-lock.yaml vitest.config.mts lib/affiliate/types.ts lib/affiliate/adpick-hotdeal.ts lib/affiliate/adpick-hotdeal.test.ts
git commit -m "test: define Adpick hotdeal normalization"
```

---

### Task 2: Supabase 상품 스냅샷과 원자 동기화 RPC

**Files:**
- Create: `supabase/migrations/20260713090000_affiliate_hotdeals.sql`
- Create: `supabase/tests/affiliate_hotdeals.test.sql`
- Modify: `lib/database.types.ts`

**Interfaces:**
- Produces RPC: `claim_affiliate_sync(provider, source_type, scheduled_date, started_at)`
- Produces RPC: `apply_affiliate_sync(run_id, synced_at, products)`
- Produces RPC: `fail_affiliate_sync(run_id, error_code)`
- Produces RPC: `record_affiliate_product_click(product_id, metric_date)`

- [ ] **Step 1: 실패하는 pgTAP 계약 테스트를 작성한다**

Create `supabase/tests/affiliate_hotdeals.test.sql`:

```sql
begin;
select plan(12);

select has_table('public', 'affiliate_products');
select has_table('public', 'affiliate_sync_runs');
select has_table('public', 'affiliate_product_daily_metrics');
select has_function('public', 'claim_affiliate_sync', array['text','text','date','timestamp with time zone']);
select has_function('public', 'apply_affiliate_sync', array['uuid','timestamp with time zone','jsonb']);
select has_function('public', 'fail_affiliate_sync', array['uuid','text']);
select has_function('public', 'record_affiliate_product_click', array['uuid','date']);
select col_is_pk('public', 'affiliate_products', 'id');
select col_is_pk('public', 'affiliate_product_daily_metrics', array['product_id','metric_date']);
select table_privs_are('public', 'affiliate_products', 'anon', array[]::text[]);
select table_privs_are('public', 'affiliate_products', 'authenticated', array[]::text[]);
select is(
  (select claimed from claim_affiliate_sync('adpick', 'hotdeal', date '2026-07-13', timestamptz '2026-07-13 00:00:00+00')),
  true,
  'first daily sync is claimed'
);

select * from finish();
rollback;
```

- [ ] **Step 2: RED를 확인한다**

Run:

```bash
pnpm exec supabase db reset
pnpm exec supabase test db supabase/tests/affiliate_hotdeals.test.sql
```

Expected: FAIL because the affiliate tables and functions do not exist.

- [ ] **Step 3: migration을 구현한다**

Create `supabase/migrations/20260713090000_affiliate_hotdeals.sql` with:

```sql
create table public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'adpick'),
  source_type text not null check (source_type = 'hotdeal'),
  external_key text not null,
  theme_code text,
  theme_title text not null,
  theme_description text not null,
  source_rank integer not null check (source_rank >= 0),
  product_name text not null,
  image_url text,
  mall_domain text,
  mall_name text,
  mall_icon_url text,
  sale_price integer check (sale_price > 0),
  original_price integer check (original_price > 0),
  commission_label text not null,
  affiliate_url text not null,
  is_active boolean not null default true,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  synced_at timestamptz not null,
  unique (provider, source_type, external_key)
);

create table public.affiliate_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_type text not null,
  scheduled_date date not null,
  status text not null check (status in ('running','succeeded','failed')),
  fetched_count integer not null default 0,
  upserted_count integer not null default 0,
  deactivated_count integer not null default 0,
  error_code text,
  started_at timestamptz not null,
  finished_at timestamptz,
  unique (provider, source_type, scheduled_date)
);

create table public.affiliate_product_daily_metrics (
  product_id uuid not null references public.affiliate_products(id) on delete cascade,
  metric_date date not null,
  clicks integer not null default 0 check (clicks >= 0),
  primary key (product_id, metric_date)
);

alter table public.affiliate_products enable row level security;
alter table public.affiliate_sync_runs enable row level security;
alter table public.affiliate_product_daily_metrics enable row level security;

revoke all on public.affiliate_products from anon, authenticated;
revoke all on public.affiliate_sync_runs from anon, authenticated;
revoke all on public.affiliate_product_daily_metrics from anon, authenticated;
grant all on public.affiliate_products to service_role;
grant all on public.affiliate_sync_runs to service_role;
grant all on public.affiliate_product_daily_metrics to service_role;
```

Implement the four SECURITY DEFINER functions with `set search_path = public`, revoke execution from `public`, `anon`, and `authenticated`, and grant execution only to `service_role`.

`claim_affiliate_sync` must acquire `pg_advisory_xact_lock(hashtext(provider || ':' || source_type || ':' || scheduled_date))`, return `claimed=false,result='skipped'` for a succeeded row, return `claimed=false,result='busy'` for a running row newer than 15 minutes, and reset failed or stale running rows to `running`.

`apply_affiliate_sync` must reject an empty JSON array, use `jsonb_to_recordset` to upsert all products, deactivate only active `adpick/hotdeal` rows absent from the incoming external keys, and mark the matching run `succeeded` in the same transaction.

`fail_affiliate_sync` must update only a `running` row to `failed` and never modify products.

`record_affiliate_product_click` must use:

```sql
insert into public.affiliate_product_daily_metrics(product_id, metric_date, clicks)
values (p_product_id, p_metric_date, 1)
on conflict (product_id, metric_date)
do update set clicks = public.affiliate_product_daily_metrics.clicks + 1;
```

- [ ] **Step 4: GREEN과 migration 재실행을 확인한다**

Run:

```bash
pnpm exec supabase db reset
pnpm exec supabase test db supabase/tests/affiliate_hotdeals.test.sql
```

Expected: `12 tests, 0 failures`.

- [ ] **Step 5: Supabase 타입을 재생성한다**

Run:

```bash
pnpm exec supabase gen types typescript --local > lib/database.types.ts
pnpm exec tsc --noEmit
```

Expected: TypeScript exits 0 and the four RPC signatures exist under `Database["public"]["Functions"]`.

- [ ] **Step 6: 커밋한다**

```bash
git add supabase/migrations/20260713090000_affiliate_hotdeals.sql supabase/tests/affiliate_hotdeals.test.sql lib/database.types.ts
git commit -m "feat: add affiliate hotdeal persistence"
```

---

### Task 3: 하루 1회 동기화 서비스와 Cron Route Handler

**Files:**
- Create: `lib/affiliate/repository.server.ts`
- Create: `lib/affiliate/sync.server.test.ts`
- Create: `lib/affiliate/sync.server.ts`
- Create: `app/api/cron/adpick-hotdeals/route.test.ts`
- Create: `app/api/cron/adpick-hotdeals/route.ts`

**Interfaces:**
- Consumes: `normalizeAdpickHotdeals`, Supabase RPC functions
- Produces: `runDailyAdpickSync(deps?: SyncDependencies): Promise<SyncResult>`
- Produces: `createCronHandler(sync: () => Promise<SyncResult>): (request: Request) => Promise<Response>`

Define these service contracts in `lib/affiliate/sync.server.ts`:

```ts
export type SyncResult =
  | { status: "succeeded"; fetchedCount: number; upsertedCount: number; deactivatedCount: number }
  | { status: "skipped" | "busy"; fetchedCount: 0 }
  | { status: "failed"; fetchedCount: 0; errorCode: string };

export type SyncDependencies = {
  now: () => Date;
  affiliateId: string;
  fetcher: typeof fetch;
  repository: AffiliateSyncRepository;
};
```

- [ ] **Step 1: 동기화 실패 테스트를 작성한다**

Create `lib/affiliate/sync.server.test.ts` covering these concrete cases with injected `fetcher` and repository spies:

```ts
it("does not fetch when the daily claim is skipped", async () => {
  const fetcher = vi.fn();
  const result = await runDailyAdpickSync({
    now: () => new Date("2026-07-13T01:00:00Z"),
    affiliateId: "member123",
    fetcher,
    repository: {
      claim: vi.fn().mockResolvedValue({ claimed: false, runId: "run-1", result: "skipped" }),
      apply: vi.fn(),
      fail: vi.fn(),
    },
  });
  expect(result.status).toBe("skipped");
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps products unchanged when Adpick returns an invalid payload", async () => {
  const repository = {
    claim: vi.fn().mockResolvedValue({ claimed: true, runId: "run-1", result: "claimed" }),
    apply: vi.fn(),
    fail: vi.fn(),
  };
  const fetcher = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
  await expect(runDailyAdpickSync({
    now: () => new Date("2026-07-13T01:00:00Z"),
    affiliateId: "member123",
    fetcher,
    repository,
  })).resolves.toMatchObject({ status: "failed", errorCode: "ADPICK_EMPTY_LIST" });
  expect(repository.apply).not.toHaveBeenCalled();
  expect(repository.fail).toHaveBeenCalledWith("run-1", "ADPICK_EMPTY_LIST");
});
```

Also test a successful response, non-200 status, response text larger than 1 MiB, and an exception whose message contains an affiliate ID. The returned/stored error code must never contain the ID or full buy URL.

- [ ] **Step 2: Cron 인증 실패 테스트를 작성한다**

Create `app/api/cron/adpick-hotdeals/route.test.ts`:

```ts
it("returns 401 without the configured bearer token", async () => {
  process.env.CRON_SECRET = "cron-secret-123456";
  const sync = vi.fn();
  const handler = createCronHandler(sync);
  const response = await handler(new Request("https://catchmeme.com/api/cron/adpick-hotdeals"));
  expect(response.status).toBe(401);
  expect(sync).not.toHaveBeenCalled();
});

it("runs sync with the exact bearer token", async () => {
  process.env.CRON_SECRET = "cron-secret-123456";
  const sync = vi.fn().mockResolvedValue({ status: "succeeded", fetchedCount: 12 });
  const handler = createCronHandler(sync);
  const response = await handler(new Request("https://catchmeme.com/api/cron/adpick-hotdeals", {
    headers: { authorization: "Bearer cron-secret-123456" },
  }));
  expect(response.status).toBe(200);
  expect(sync).toHaveBeenCalledOnce();
});
```

- [ ] **Step 3: RED를 확인한다**

Run:

```bash
pnpm test lib/affiliate/sync.server.test.ts app/api/cron/adpick-hotdeals/route.test.ts
```

Expected: FAIL because the service and route do not exist.

- [ ] **Step 4: repository와 동기화 서비스를 최소 구현한다**

`lib/affiliate/repository.server.ts` must wrap `createAdminClient().rpc(...)` behind this interface:

```ts
export type AffiliateSyncRepository = {
  claim(input: { provider: "adpick"; sourceType: "hotdeal"; scheduledDate: string; startedAt: string }): Promise<{ claimed: boolean; runId: string; result: "claimed" | "skipped" | "busy" }>;
  apply(runId: string, syncedAt: string, products: NormalizedAffiliateProduct[]): Promise<{ upsertedCount: number; deactivatedCount: number }>;
  fail(runId: string, errorCode: string): Promise<void>;
};
```

`runDailyAdpickSync` must build the fixed API URL with `URLSearchParams`, use `AbortSignal.timeout(10_000)`, reject responses over `1_048_576` bytes, parse text with `JSON.parse`, normalize with the configured affiliate ID, and call `apply` only after complete validation.

Use Seoul calendar date from `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })` for idempotency.

- [ ] **Step 5: Route Handler를 최소 구현한다**

`app/api/cron/adpick-hotdeals/route.ts`:

```ts
import { runDailyAdpickSync } from "@/lib/affiliate/sync.server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export function createCronHandler(sync: typeof runDailyAdpickSync) {
  return async function cronHandler(request: Request): Promise<Response> {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const result = await sync();
    return Response.json({ ok: result.status !== "failed", ...result }, {
      status: result.status === "failed" ? 502 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  };
}

export const GET = createCronHandler(runDailyAdpickSync);
```

- [ ] **Step 6: GREEN과 전체 테스트를 확인한다**

Run:

```bash
pnpm test lib/affiliate/sync.server.test.ts app/api/cron/adpick-hotdeals/route.test.ts
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 7: 커밋한다**

```bash
git add lib/affiliate/repository.server.ts lib/affiliate/sync.server.ts lib/affiliate/sync.server.test.ts app/api/cron/adpick-hotdeals/route.ts app/api/cron/adpick-hotdeals/route.test.ts
git commit -m "feat: sync Adpick hotdeals daily"
```

---

### Task 4: Storefront 조회와 안전한 구매 리다이렉트

**Files:**
- Create: `lib/affiliate/storefront.test.ts`
- Create: `lib/affiliate/storefront.ts`
- Modify: `lib/affiliate/repository.server.ts`
- Create: `app/go/products/[id]/route.test.ts`
- Create: `app/go/products/[id]/route.ts`

**Interfaces:**
- Produces: `buildAffiliateStorefront(products, metrics, lastSuccessfulSyncAt, now): AffiliateStorefrontData`
- Produces: `getAffiliateStorefront(): Promise<AffiliateStorefrontData>`
- Produces: `getActiveAffiliateRedirect(id: string): Promise<string | null>`
- Produces: `recordAffiliateProductClick(id: string, date: string): Promise<void>`

- [ ] **Step 1: storefront 순수 계산 RED 테스트를 작성한다**

Test that `buildAffiliateStorefront`:

```ts
expect(data.hotdeals.map((item) => item.id)).toEqual(["source-1", "source-2"]);
expect(data.popular.map((item) => item.id)).toEqual(["source-2", "source-1"]);
expect(data.isStale).toBe(false);
expect(calculateDiscountRate(25800, 12900)).toBe(50);
expect(calculateDiscountRate(null, 12900)).toBeNull();
```

Use a second case with `lastSuccessfulSyncAt` older than 48 hours and expect `isStale=true`.

- [ ] **Step 2: 리다이렉트 RED 테스트를 작성한다**

Create a handler factory with injected repository and test:

```ts
it("records a click and redirects an active product", async () => {
  const repository = {
    getActiveRedirect: vi.fn().mockResolvedValue("https://adpick.co.kr/apis/goshopping.php?affid=member123&offer=abc12&url=https%3A%2F%2Fshop.example.com%2Fp%2F1"),
    recordClick: vi.fn().mockResolvedValue(undefined),
  };
  const handler = createProductRedirectHandler(repository, () => new Date("2026-07-13T00:00:00Z"));
  const response = await handler(
    new Request("https://catchmeme.com/go/products/550e8400-e29b-41d4-a716-446655440000"),
    { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" }) },
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toContain("https://adpick.co.kr/apis/goshopping.php");
  expect(repository.recordClick).toHaveBeenCalledOnce();
});
```

Also test invalid UUID, inactive product, malicious stored URL, and click failure. Click failure must still return the valid redirect.

- [ ] **Step 3: RED를 확인한다**

Run:

```bash
pnpm test lib/affiliate/storefront.test.ts app/go/products/[id]/route.test.ts
```

Expected: FAIL because storefront and route modules do not exist.

- [ ] **Step 4: storefront와 repository query를 구현한다**

`getAffiliateStorefront` must select only display fields from active products, select metrics from the last seven Seoul dates, aggregate clicks in TypeScript, read the newest succeeded sync time, and return an empty non-throwing dataset when local Supabase is unavailable.

`popular` includes at most 8 products with `clickCount7d > 0`, sorted by clicks descending then `sourceRank` ascending. `hotdeals` always follows `sourceRank` ascending.

- [ ] **Step 5: 안전한 리다이렉트 Route Handler를 구현한다**

Use `z.uuid()` for the route ID, validate the stored URL with `isValidAdpickBuyUrl(url, process.env.ADPICK_AFFILIATE_ID)`, record the click with the Seoul date, and return:

```ts
return new Response(null, {
  status: 302,
  headers: {
    Location: affiliateUrl,
    "Cache-Control": "no-store",
  },
});
```

Return the same explicit `302` response shape with `Location: new URL("/products", request.url).toString()` for invalid, missing, inactive, or unsafe products.

- [ ] **Step 6: GREEN을 확인한다**

Run:

```bash
pnpm test lib/affiliate/storefront.test.ts app/go/products/[id]/route.test.ts
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 7: 커밋한다**

```bash
git add lib/affiliate/storefront.ts lib/affiliate/storefront.test.ts lib/affiliate/repository.server.ts app/go/products/[id]/route.ts app/go/products/[id]/route.test.ts
git commit -m "feat: add affiliate storefront redirects"
```

---

### Task 5: 핫딜 상품 카드와 `/products` 통합

**Files:**
- Create: `components/affiliate-product-card.test.tsx`
- Create: `components/affiliate-product-card.tsx`
- Create: `components/affiliate-product-grid.tsx`
- Modify: `app/products/page.tsx`
- Modify: `app/products/loading.tsx`
- Modify: `lib/i18n-pages.ts`
- Modify: `lib/analytics.ts`

**Interfaces:**
- Consumes: `AffiliateStorefrontData`, `AffiliateStorefrontProduct`
- Produces: `AffiliateProductCard({ product, locale }): React.ReactNode`
- Produces: `AffiliateProductGrid({ data, locale }): React.ReactNode`

- [ ] **Step 1: 카드 마크업 RED 테스트를 작성한다**

Use `renderToStaticMarkup` and assert exact consumer-facing behavior:

```ts
const html = renderToStaticMarkup(
  <AffiliateProductCard
    locale="ko"
    product={{
      id: "550e8400-e29b-41d4-a716-446655440000",
      provider: "adpick",
      sourceType: "hotdeal",
      externalKey: "product-key",
      themeCode: "20",
      themeTitle: "실시간 핫딜",
      themeDescription: "현재 판매 가능한 상품",
      sourceRank: 0,
      productName: "테스트 상품",
      imageUrl: "https://img.podgate.com/product.jpg",
      mallDomain: "shop.example.com",
      mallName: "테스트몰",
      mallIconUrl: null,
      salePrice: 12900,
      originalPrice: 25800,
      clickCount7d: 3,
    }}
  />,
);
expect(html).toContain("테스트 상품");
expect(html).toContain("25,800원");
expect(html).toContain("12,900원");
expect(html).toContain("50%");
expect(html).toContain("광고·제휴");
expect(html).toContain("/go/products/550e8400-e29b-41d4-a716-446655440000");
expect(html).toContain('rel="sponsored noopener noreferrer"');
```

Add a price-null case that contains `판매처에서 가격 확인` and no false discount.

- [ ] **Step 2: RED를 확인한다**

Run:

```bash
pnpm test components/affiliate-product-card.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: 네 언어 UI copy를 추가한다**

Add these keys to every locale in `PAGE_COPY` with natural translations:

```ts
hotdealTitle: string;
hotdealDescription: string;
popularTitle: string;
popularDescription: string;
affiliateBadge: string;
viewProduct: string;
priceAtMerchant: string;
originalPrice: string;
lastUpdated: string;
staleWarning: string;
emptyHotdeals: string;
merchantPriceNotice: string;
legacyOffersTitle: string;
```

Korean source strings are the exact phrases in the interface above and the approved design document. Product names remain unchanged across locales.

- [ ] **Step 4: 상품 카드와 grid를 최소 구현한다**

The card must use a direct lazy `<img>` with explicit `width`, `height`, `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`, an aspect-ratio container, and a visible CSS fallback background. Add a one-line ESLint disable only for `@next/next/no-img-element`; do not weaken global lint rules.

The purchase anchor must be:

```tsx
<a
  href={`/go/products/${product.id}`}
  rel="sponsored noopener noreferrer"
  data-affiliate-product-id={product.id}
  className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-bold text-white"
>
  {copy.viewProduct}
</a>
```

`AffiliateProductGrid` renders `popular` only when non-empty, always renders the hotdeal section, and shows stale or empty states from the storefront data.

Wrap the grid in `TrackedBlock event="affiliate_product_click"` so GA4 receives the internal `/go/products/[id]` destination while Supabase remains the authoritative daily click counter.

- [ ] **Step 5: `/products`에 storefront를 통합한다**

Call `getAffiliateStorefront()` in `ProductsPage`, render `AffiliateProductGrid` before the existing static CPA list, rename the existing list heading to `legacyOffersTitle`, and keep the current `isMemeProductActive` expiration behavior unchanged.

Add an `ItemList` JSON-LD native `<script>` with only active hotdeal items. Serialize with:

```ts
JSON.stringify(jsonLd).replace(/</g, "\\u003c")
```

When `data.isStale` is true, omit all price fields from JSON-LD.

- [ ] **Step 6: GREEN, lint, and build를 확인한다**

Run:

```bash
pnpm test components/affiliate-product-card.test.tsx
pnpm test
pnpm lint
pnpm build
```

Expected: all commands exit 0; `/products` remains a valid route and no new hydration warning appears.

- [ ] **Step 7: 커밋한다**

```bash
git add components/affiliate-product-card.tsx components/affiliate-product-card.test.tsx components/affiliate-product-grid.tsx app/products/page.tsx app/products/loading.tsx lib/i18n-pages.ts lib/analytics.ts
git commit -m "feat: show daily Adpick hotdeals"
```

---

### Task 6: 하루 1회 배포 설정과 운영 문서

**Files:**
- Create: `vercel.json`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: `GET /api/cron/adpick-hotdeals`
- Produces: production Cron schedule `0 21 * * *`

- [ ] **Step 1: Cron 설정 계약을 테스트한다**

Create a Vitest case in `app/api/cron/adpick-hotdeals/route.test.ts` that reads `vercel.json` and asserts:

```ts
expect(config.crons).toEqual([{
  path: "/api/cron/adpick-hotdeals",
  schedule: "0 21 * * *",
}]);
```

- [ ] **Step 2: RED를 확인한다**

Run:

```bash
pnpm test app/api/cron/adpick-hotdeals/route.test.ts
```

Expected: FAIL because `vercel.json` does not exist.

- [ ] **Step 3: Vercel Cron과 환경변수 문서를 추가한다**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/adpick-hotdeals",
      "schedule": "0 21 * * *"
    }
  ]
}
```

Append the two new values to `.env.example`; keep the existing `SUPABASE_SERVICE_ROLE_KEY` declaration in its current Supabase section:

```dotenv
# Adpick ShoppingMate hotdeal sync (server only)
ADPICK_AFFILIATE_ID=
CRON_SECRET=
```

Add README commands:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/adpick-hotdeals
```

Document that Vercel uses UTC, the schedule runs once daily around 06:00 KST, Hobby timing may vary within the hour, and Vercel does not retry failed jobs.

- [ ] **Step 4: GREEN과 JSON 유효성을 확인한다**

Run:

```bash
pnpm test app/api/cron/adpick-hotdeals/route.test.ts
node -e "JSON.parse(require('node:fs').readFileSync('vercel.json','utf8')); console.log('valid')"
```

Expected: test PASS and output `valid`.

- [ ] **Step 5: 커밋한다**

```bash
git add vercel.json .env.example README.md app/api/cron/adpick-hotdeals/route.test.ts
git commit -m "chore: schedule daily hotdeal sync"
```

---

### Task 7: 전체 회귀 검증과 실제 운영 연결

**Files:**
- Modify only files required by failures found in this task

**Interfaces:**
- Consumes: all previous task outputs
- Produces: verified local and production-ready feature

- [ ] **Step 1: 전체 자동 검증을 새로 실행한다**

Run:

```bash
pnpm test
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit 0 with zero test failures and zero lint errors.

- [ ] **Step 2: 로컬 Supabase와 앱을 실행한다**

Run in separate terminals:

```bash
pnpm exec supabase start
pnpm dev
```

Set local `ADPICK_AFFILIATE_ID` from the authenticated Adpick API guide and generate a local `CRON_SECRET` with:

```bash
openssl rand -hex 24
```

Do not print either value in logs or commit them.

- [ ] **Step 3: Cron 인증과 동기화를 확인한다**

Run an unauthenticated request and expect `401`:

```bash
curl --fail-with-body http://localhost:3000/api/cron/adpick-hotdeals
```

Run the authenticated request and expect `200` with `succeeded` or same-day `skipped`:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/adpick-hotdeals
```

Query Supabase and verify at least one active `adpick/hotdeal` product and one succeeded sync row. Do not expose `affiliate_url` in command output.

- [ ] **Step 4: 브라우저 QA를 수행한다**

Verify `/products` at 375×812, 768×1024, and 1280×720:

- hotdeal images, mall, product name, prices, discount, disclosure, and updated time render
- stale warning is absent after a successful sync
- `밈캐치 인기` appears only after click data exists
- purchase link has `rel="sponsored noopener noreferrer"`
- no horizontal overflow
- no console errors or hydration mismatches
- Korean, English, Japanese, and Chinese UI switch correctly while product names remain source text

Click one test product only after confirming it is not a purchase action; verify the request passes through `/go/products/[id]` and lands on the merchant page. Do not add to cart or purchase.

- [ ] **Step 5: Vercel과 Supabase 운영 설정을 적용한다**

Apply the migration to the linked Supabase project using the repository's existing deployment workflow. Add `ADPICK_AFFILIATE_ID`, `CRON_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` as Vercel server environment variables for Production and Preview; never prefix them with `NEXT_PUBLIC_`.

Deploy production, then verify the Vercel Cron Jobs page lists `/api/cron/adpick-hotdeals` with the `0 21 * * *` schedule. Trigger one authenticated sync, check the production `/products` page, and confirm the latest `affiliate_sync_runs` row is `succeeded`.

- [ ] **Step 6: 최종 변경 범위를 검토한다**

Run:

```bash
git status --short
git diff --stat HEAD~6..HEAD
git log --oneline -8
```

Confirm no `.env` file, affiliate ID, Cron secret, service-role key, browser cookie, or unrelated user file is staged or committed.

- [ ] **Step 7: 결함이 발견되면 소유 Task의 RED/GREEN 주기로 되돌아간다**

Task 7에서 결함이 발견되면 임시 수정으로 끝내지 않는다. 결함을 소유한 Task의 테스트 파일에 실패 재현을 먼저 추가하고, 해당 Task의 구현 파일만 수정한 뒤 그 Task의 커밋 명령으로 커밋한다. 수정 후 `pnpm test`, `pnpm lint`, `pnpm build`를 모두 다시 실행한다. 결함이 없으면 Task 7에서는 새 커밋을 만들지 않는다.
