import { describe, expect, it } from "vitest";
import {
  dailyPivot,
  kstDayKey,
  parseLocalRecord,
  previousDayKey,
  recordLocalAnswer,
  seededRng,
  statusFromLocal,
  statusFromRpcRow,
} from "@/lib/daily-quiz";

describe("daily quiz day keys", () => {
  it("uses the Asia/Seoul calendar boundary", () => {
    // 2026-11-19 15:30 UTC = 2026-11-20 00:30 KST
    expect(kstDayKey(new Date("2026-11-19T15:30:00Z"))).toBe("2026-11-20");
    expect(kstDayKey(new Date("2026-11-19T14:59:00Z"))).toBe("2026-11-19");
  });

  it("walks back across month and year edges", () => {
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
    expect(previousDayKey("2027-01-01")).toBe("2026-12-31");
  });

  it("gives every visitor the same pivot and shuffle on the same day", () => {
    expect(dailyPivot("2026-11-19")).toBe(dailyPivot("2026-11-19"));
    expect(dailyPivot("2026-11-19")).not.toBe(dailyPivot("2026-11-20"));
    expect(dailyPivot("2026-11-19")).toMatch(/^[a-z2-9]{8}$/);
    const a = seededRng(42);
    const b = seededRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("guest streak (localStorage)", () => {
  it("starts at one and counts the first answer only", () => {
    const first = recordLocalAnswer(null, "2026-11-19", 2, true);
    expect(first).toMatchObject({ streak: 1, best: 1, total: 1, lastSelected: 2 });
    expect(recordLocalAnswer(first, "2026-11-19", 0, false)).toBe(first);
  });

  it("continues on consecutive days and resets after a missed day", () => {
    let record = recordLocalAnswer(null, "2026-11-17", 0, true);
    record = recordLocalAnswer(record, "2026-11-18", 0, false);
    record = recordLocalAnswer(record, "2026-11-19", 0, true);
    expect(record).toMatchObject({ streak: 3, best: 3, total: 3 });

    const afterGap = recordLocalAnswer(record, "2026-11-21", 1, true);
    expect(afterGap).toMatchObject({ streak: 1, best: 3, total: 4 });
  });

  it("keeps yesterday's streak alive until today is missed", () => {
    const record = recordLocalAnswer(recordLocalAnswer(null, "2026-11-18", 0, true), "2026-11-19", 1, false);
    expect(statusFromLocal(record, "2026-11-19")).toMatchObject({ answeredToday: true, correctToday: false, currentStreak: 2 });
    expect(statusFromLocal(record, "2026-11-20")).toMatchObject({ answeredToday: false, correctToday: null, currentStreak: 2 });
    expect(statusFromLocal(record, "2026-11-21")).toMatchObject({ currentStreak: 0, bestStreak: 2, totalDays: 2 });
  });

  it("ignores corrupt stored values", () => {
    expect(parseLocalRecord(null)).toBeNull();
    expect(parseLocalRecord("not json")).toBeNull();
    expect(parseLocalRecord(JSON.stringify({ lastDate: "x", streak: 1 }))).toBeNull();
  });
});

describe("server status mapping", () => {
  it("treats a missing completion as not answered", () => {
    expect(
      statusFromRpcRow({ quiz_date: "2026-11-19", completed_at: null, correct: null, current_streak: 4, best_streak: 6, total_days: 9 }),
    ).toEqual({ quizDate: "2026-11-19", answeredToday: false, correctToday: null, currentStreak: 4, bestStreak: 6, totalDays: 9 });
  });
});
