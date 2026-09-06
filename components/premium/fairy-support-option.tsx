"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n-client";
import { localizedStaticPath } from "@/lib/i18n-routing";
import { track } from "@/lib/analytics";

const COPY = {
  ko: {
    title: "Fairy 후원으로 Plus 30일",
    detail: "아래 버튼으로 로그인 후 후원하면 계정이 연결됩니다. 한 번에 {amount}원 이상 후원 시 확인 후 Plus 30일이 추가됩니다. 일반 후원 링크로 보낸 후원은 자동 연결되지 않습니다.",
    note: "1회 후원당 30일 · 자동 갱신 없음 · 금액 미달 시 일반 후원으로 처리",
    checkout: "계정 연결 후 Fairy에서 후원하기", status: "후원 완료 후 Plus 상태 확인",
  },
  en: {
    title: "Support via Fairy for 30 days of Plus",
    detail: "Use the button below to sign in and link your account. One donation of at least KRW {amount} adds 30 days of Plus after confirmation. Donations through a general support link are not automatically linked.",
    note: "30 days per qualifying donation · no auto-renewal · smaller donations are support only",
    checkout: "Link my account and support on Fairy", status: "Check Plus after donating",
  },
  ja: {
    title: "Fairyの支援でPlusを30日間",
    detail: "下のボタンからログインするとアカウントが連携されます。1回{amount}ウォン以上の支援を確認後、Plusが30日追加されます。通常の支援リンクからの支援は自動連携されません。",
    note: "対象の支援1回につき30日・自動更新なし・最低額未満は通常の支援",
    checkout: "アカウントを連携してFairyで支援", status: "支援後にPlusの状態を確認",
  },
  zh: {
    title: "通过 Fairy 支持，获得30天Plus",
    detail: "请通过下方按钮登录并关联账户。单次支持至少{amount}韩元，确认后增加30天Plus。通过普通支持链接付款不会自动关联账户。",
    note: "每笔达标支持增加30天 · 不自动续费 · 低于最低金额仅视为普通支持",
    checkout: "关联账户并在Fairy支持", status: "支持完成后查看Plus状态",
  },
};

export function FairySupportOption({ minimumAmount }: { minimumAmount: number }) {
  const { locale } = useLocale();
  const copy = locale === "ko" || locale === "ja" || locale === "zh" ? COPY[locale] : COPY.en;
  return (
    <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-border bg-surface p-6 sm:p-8" aria-labelledby="fairy-support-title">
      <h2 id="fairy-support-title" className="text-xl font-bold">{copy.title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {copy.detail.replace("{amount}", minimumAmount.toLocaleString("en-US"))}
      </p>
      <p className="mt-2 text-sm text-muted">{copy.note}</p>
      <form action="/api/billing/fairy/checkout" method="post" className="mt-4"
        onSubmit={() => track("donate_click", { locale, surface: "plus_fairy_checkout" })}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="min-h-12 w-full rounded-xl border border-accent px-4 py-3 font-bold text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {copy.checkout}
        </button>
      </form>
      <Link href={localizedStaticPath("/premium", locale)} className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4">
        {copy.status}
      </Link>
    </section>
  );
}
