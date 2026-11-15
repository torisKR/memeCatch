import { z } from "zod";

const count = z.number().int().nonnegative();
const timestamp = z.iso.datetime({ offset: true });
const metrics = { views: count, activeUsers: count, anonymousSessions: count };

export const adminActivitySchema = z.object({
  generatedAt: timestamp,
  range: z.object({ from: z.iso.date(), to: z.iso.date(), hourDate: z.iso.date() }),
  summary: z.object({ ...metrics, currentSubscribers: count }),
  daily: z.array(z.object({ date: z.iso.date(), ...metrics })).max(31),
  hourly: z.array(z.object({ hour: count.max(23), ...metrics })).length(24),
  users: z.object({
    total: count, page: count.min(1), pageSize: z.literal(25),
    items: z.array(z.object({
      id: z.guid(), nickname: z.string().nullable(), isPlus: z.boolean(),
      plusUntil: timestamp.nullable(), views: count, lastSeenAt: timestamp.nullable(),
    })).max(25),
  }),
  views: z.object({
    total: count, page: count.min(1), pageSize: z.literal(50),
    items: z.array(z.object({
      id: z.guid(), eventAt: timestamp, userId: z.guid().nullable(),
      nickname: z.string().nullable(), memeId: z.guid().nullable(),
      title: z.string().nullable(), shortId: z.string().nullable(), slug: z.string().nullable(),
    })).max(50),
  }),
});

export type AdminActivity = z.infer<typeof adminActivitySchema>;
export type ActivitySearch = Record<string, string | string[] | undefined>;
export type ActivityFilters = {
  from: string;
  to: string;
  hourDate: string;
  userId: string;
  subscribersOnly: boolean;
  usersPage: number;
  viewsPage: number;
};

export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parseActivityFilters(search: ActivitySearch, now = new Date()):
  { filters: ActivityFilters; error: string | null; today: string } {
  const today = kstToday(now);
  const to = typeof search.to === "string" && z.iso.date().safeParse(search.to).success ? search.to : today;
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10);
  const defaults: ActivityFilters = { from, to, hourDate: to, userId: "", subscribersOnly: false, usersPage: 1, viewsPage: 1 };
  const parsed = z.object({
    from: z.iso.date().default(from),
    to: z.iso.date().default(today),
    hourDate: z.iso.date().default(to),
    userId: z.union([z.literal(""), z.guid()]).default(""),
    subscribersOnly: z.enum(["", "1"]).default(""),
    usersPage: z.string().regex(/^[1-9]\d{0,4}$/).default("1"),
    viewsPage: z.string().regex(/^[1-9]\d{0,4}$/).default("1"),
  }).safeParse(search);
  const invalid = { filters: defaults, today, error: "조회 조건을 확인해 주세요. 오늘까지 최대 31일, 유효한 사용자 ID와 페이지 번호를 선택할 수 있습니다." };
  if (!parsed.success) return invalid;
  const filters: ActivityFilters = {
    ...parsed.data,
    subscribersOnly: parsed.data.subscribersOnly === "1",
    usersPage: Number(parsed.data.usersPage), viewsPage: Number(parsed.data.viewsPage),
  };
  const days = (Date.parse(filters.to) - Date.parse(filters.from)) / 86400000;
  if (days < 0 || days > 30 || filters.to > today || filters.hourDate < filters.from ||
      filters.hourDate > filters.to || filters.usersPage > 10000 || filters.viewsPage > 10000) return invalid;
  return { filters, error: null, today };
}

export function activityHref(filters: ActivityFilters, changes: Partial<ActivityFilters> = {}, anchor = "") {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams({ from: next.from, to: next.to, hourDate: next.hourDate });
  if (next.userId) params.set("userId", next.userId);
  if (next.subscribersOnly) params.set("subscribersOnly", "1");
  if (next.usersPage > 1) params.set("usersPage", String(next.usersPage));
  if (next.viewsPage > 1) params.set("viewsPage", String(next.viewsPage));
  return `/admin/activity?${params}${anchor ? `#${anchor}` : ""}`;
}
