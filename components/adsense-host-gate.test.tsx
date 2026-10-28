// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  liveOrigin: vi.fn(() => true),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@/lib/adsense-policy", () => ({ isLiveAdOrigin: mocks.liveOrigin }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

import { AdsenseHostGate } from "./adsense-host-gate";

const session = { user: { id: "current-user" } };

function operatorCheck(data: unknown, error: unknown = null) {
  mocks.rpc.mockResolvedValue({ data, error });
}

function renderGate() {
  return render(<AdsenseHostGate><span data-testid="ad-runtime">Ads</span></AdsenseHostGate>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.liveOrigin.mockReturnValue(true);
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
});
afterEach(cleanup);

describe("ad requests start only after a safe audience check", () => {
  it("does not mount before session resolution", () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    renderGate();
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
  });

  it("allows a confirmed anonymous visitor on the live domain", async () => {
    renderGate();
    await waitFor(() => expect(screen.queryByTestId("ad-runtime")).not.toBeNull());
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("allows a confirmed ordinary member using the session-bound operator RPC", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    operatorCheck(false);
    renderGate();
    await waitFor(() => expect(screen.queryByTestId("ad-runtime")).not.toBeNull());
    expect(mocks.rpc).toHaveBeenCalledWith("is_operator");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("never mounts for operators and remembers that browser after logout", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    operatorCheck(true);
    const first = renderGate();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem("memecatch_ads_disabled")).toBe("1"));
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("is_operator");
    expect(mocks.from).not.toHaveBeenCalled();
    first.unmount();
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    renderGate();
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
  });

  it.each([null, true, "unexpected"])("fails closed for operator RPC result %s", async (result) => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    operatorCheck(result);
    renderGate();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
  });

  it("fails closed when the session cannot be read", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: new Error("offline") });
    renderGate();
    await act(async () => {});
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
  });

  it("does not start ads when the operator RPC fails", async () => {
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    operatorCheck(false, new Error("offline"));
    renderGate();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
  });

  it("does not re-enable ads from a stale member check after an operator signs in", async () => {
    let resolveMember: (result: { data: boolean; error: null }) => void = () => {};
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.rpc.mockImplementationOnce(() => new Promise((resolve) => { resolveMember = resolve; }));
    renderGate();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
    operatorCheck(true);
    const onChange = mocks.onAuthStateChange.mock.calls[0][0];
    await act(async () => { onChange("SIGNED_IN", { user: { id: "operator" } }); });
    await waitFor(() => expect(localStorage.getItem("memecatch_ads_disabled")).toBe("1"));
    await act(async () => { resolveMember({ data: false, error: null }); });
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
  });

  it("never checks sessions on preview/local origins", () => {
    mocks.liveOrigin.mockReturnValue(false);
    renderGate();
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("blocks a persisted QA opt-out without starting auth or ads", () => {
    localStorage.setItem("memecatch_ads_disabled", "1");
    renderGate();
    expect(screen.queryByTestId("ad-runtime")).toBeNull();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("cleans up the auth subscription", async () => {
    const view = renderGate();
    await waitFor(() => expect(mocks.onAuthStateChange).toHaveBeenCalled());
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
