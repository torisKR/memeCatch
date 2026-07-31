"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Unifi(dapp-portal) 결제 버튼.
 *
 * 흐름: SDK 초기화 → 지갑 연결(주소 확보) → 서버가 결제 생성(paymentId)
 *      → startPayment로 결제창 → 완료 후 서버 확인(verify) → 화면 갱신.
 *
 * SDK는 브라우저 전용이라 클릭 시점에 동적 import 한다(초기 번들 보호).
 * 결제 결과의 최종 근거는 서버 검증이며, 이 컴포넌트는 권한을 만들지 않는다.
 */

type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type PaymentProvider = {
  startPayment: (paymentId: string) => Promise<unknown>;
};

type Sdk = {
  getWalletProvider: () => WalletProvider;
  getPaymentProvider: () => PaymentProvider;
  isSupportedBrowser: () => boolean;
  showUnsupportedBrowserGuide: () => Promise<void>;
};

const CLIENT_ID = process.env.NEXT_PUBLIC_UNIFI_CLIENT_ID ?? "";
const CHAIN_ID = process.env.NEXT_PUBLIC_UNIFI_CHAIN_ID ?? "1001";

/** SDK는 앱당 한 번만 초기화한다(문서 권장 — 싱글턴). */
let sdkPromise: Promise<Sdk> | null = null;

function loadSdk(): Promise<Sdk> {
  sdkPromise ??= import("@linenext/dapp-portal-sdk").then((module) => {
    const DappPortalSDK = (module.default ?? module) as unknown as {
      init: (config: { clientId: string; chainId: string }) => Promise<Sdk>;
    };
    return DappPortalSDK.init({ clientId: CLIENT_ID, chainId: CHAIN_ID });
  });
  return sdkPromise;
}

function messageFor(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code: unknown }).code
      : null;
  // 문서 정의 코드 — 사용자 취소는 오류로 보이지 않게 안내한다.
  if (code === -31001 || code === -32001) return "결제를 취소했어요.";
  if (code === -31002) return "결제가 완료되지 않았어요. 다시 시도해 주세요.";
  return "결제를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function UnifiCheckoutButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function startCheckout() {
    if (busy) return;
    setBusy(true);
    setNotice(null);

    try {
      const sdk = await loadSdk();

      if (!sdk.isSupportedBrowser()) {
        await sdk.showUnsupportedBrowserGuide();
        setNotice("이 브라우저에서는 결제를 진행할 수 없어요.");
        return;
      }

      const accounts = (await sdk.getWalletProvider().request({
        method: "kaia_requestAccounts",
      })) as string[] | undefined;
      const walletAddress = accounts?.[0];
      if (!walletAddress) {
        setNotice("지갑 연결이 필요해요.");
        return;
      }

      const created = await fetch("/api/billing/unifi/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      if (created.status === 401) {
        router.push("/login?next=/pricing");
        return;
      }
      const createdBody = (await created.json()) as { paymentId?: string };
      if (!created.ok || !createdBody.paymentId) {
        setNotice("결제를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      await sdk.getPaymentProvider().startPayment(createdBody.paymentId);

      // 웹훅이 먼저 도착했더라도 멱등하다. 결과를 즉시 반영하기 위해 확인한다.
      const verified = await fetch("/api/billing/unifi/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId: createdBody.paymentId }),
      });
      const verifiedBody = (await verified.json()) as { status?: string };

      if (verified.ok && verifiedBody.status === "active") {
        router.push("/premium");
        router.refresh();
        return;
      }
      setNotice("결제를 확인하고 있어요. 잠시 후 MY PLUS에서 확인해 주세요.");
    } catch (error) {
      setNotice(messageFor(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-7">
      <button
        type="button"
        onClick={startCheckout}
        disabled={busy}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {busy ? "결제창을 여는 중…" : label}
      </button>
      {notice && (
        <p role="status" className="mt-2.5 text-center text-sm text-muted">
          {notice}
        </p>
      )}
    </div>
  );
}
