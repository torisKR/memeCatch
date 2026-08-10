import { GlobalDailyChallenge } from "@/components/premium/global-daily-challenge";
import type { Locale } from "@/lib/i18n";
import {
  globalDailyDate,
  isGlobalDailyLocale,
  type GlobalDailyLocale,
} from "@/lib/global-daily-challenge";
import { loadGlobalDailyChallenge } from "@/lib/global-daily-challenge.server";

export async function GlobalDailyPage({
  locale,
  displayLocale,
  signedIn,
  isPremium,
}: {
  locale: GlobalDailyLocale;
  displayLocale?: Locale;
  signedIn: boolean;
  isPremium: boolean;
}) {
  const challengeDate = globalDailyDate(new Date());
  const challenge = isPremium ? await loadGlobalDailyChallenge(locale) : null;
  const state = !signedIn
    ? "signed_out"
    : !isPremium
      ? "locked"
      : challenge?.state ?? "unavailable";

  return (
    <main className="ink-grid mx-auto w-full max-w-5xl px-4 pb-14 pt-8 sm:pt-12">
      <GlobalDailyChallenge
        locale={locale}
        displayLocale={displayLocale ?? locale}
        challengeDate={challenge?.challengeDate ?? challengeDate}
        state={state}
        questions={challenge?.questions ?? []}
        currentStreak={challenge?.currentStreak ?? 0}
      />
    </main>
  );
}

export function dailyContentLocaleFrom(value: string | null | undefined): GlobalDailyLocale {
  return isGlobalDailyLocale(value) ? value : "en";
}

export const dailyLocaleFrom = dailyContentLocaleFrom;
