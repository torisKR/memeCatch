// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlusManager } from "./plus-manager";

const { lookup, setPlus } = vi.hoisted(() => ({ lookup: vi.fn(), setPlus: vi.fn() }));
vi.mock("@/lib/actions/admin", () => ({ lookupPlusStatus: lookup, setUserPlus: setPlus }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("shows subscription history as a named table with scoped headers and separate values", async () => {
  lookup.mockResolvedValue({ ok: true, data: { userFound: true, email: "member@example.test", isPremium: true, subscriptions: [
    { provider: "unifi", status: "active", amount: 990, currentPeriodEnd: null, lastEventAt: null, isManual: false },
    { provider: "manual", status: "expired", amount: null, currentPeriodEnd: null, lastEventAt: null, isManual: true },
  ] } });
  render(<PlusManager />);
  fireEvent.change(screen.getByLabelText("사용자 이메일"), { target: { value: "member@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "상태 조회" }));
  const table = await screen.findByRole("table", { name: "구독 이력" });
  expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["부여 방식", "구독 상태", "금액", "유효 기간"]);
  for (const th of within(table).getAllByRole("columnheader")) expect(th.getAttribute("scope")).toBe("col");
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(table).getByRole("cell", { name: "$9.90" })).toBeTruthy();
  expect(within(table).getByRole("cell", { name: "수동" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "기간 연장·재부여" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Plus 해제" })).toBeTruthy();
  expect(setPlus).not.toHaveBeenCalled();
});

it("keeps an accessible empty table when the account has no subscriptions", async () => {
  lookup.mockResolvedValue({ ok: true, data: { userFound: true, email: "free@example.test", subscriptions: [] } });
  render(<PlusManager />);
  fireEvent.click(screen.getByRole("button", { name: "상태 조회" }));
  const table = await screen.findByRole("table", { name: "구독 이력" });
  expect(within(table).getByRole("cell", { name: "구독 이력이 없습니다." }).getAttribute("colspan")).toBe("4");
});
