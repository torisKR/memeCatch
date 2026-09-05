"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMemeOriginCountry } from "@/lib/actions/admin";
import {
  MEME_COUNTRIES,
  countryFlag,
  getMemeCountry,
  type MemeCountryCode,
} from "@/lib/meme-country";

export type OriginCountryProfile = {
  market_code: string;
  language_tag: string;
  local_title: string;
  review_state: string;
};

export function MemeOriginCountryForm({
  memeId,
  memeTitle,
  profiles,
}: {
  memeId: string;
  memeTitle: string;
  profiles: OriginCountryProfile[];
}) {
  const router = useRouter();
  const current = profiles.find((profile) => profile.review_state === "reviewed") ?? profiles[0];
  const initialCountry = getMemeCountry(current?.market_code)?.code ?? "KR";
  const [country, setCountry] = useState<MemeCountryCode>(initialCountry);
  const [localTitle, setLocalTitle] = useState(current?.local_title ?? memeTitle);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await setMemeOriginCountry({ memeId, country, localTitle });
      setMessage({
        ok: result.ok,
        text: result.ok ? "출처 국가 검수를 저장했어요." : result.error,
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <h2 className="text-lg font-semibold">출처 국가</h2>
        <p className="mt-1 text-sm text-muted">검수 완료된 출처 국가가 공개 카드의 원형 국기로 표시돼요.</p>
      </div>

      {profiles.length > 0 && (
        <ul className="space-y-1 text-sm text-muted" aria-label="현재 출처 국가 프로필">
          {profiles.map((profile) => {
            const profileCountry = getMemeCountry(profile.market_code);
            return (
              <li key={`${profile.market_code}-${profile.review_state}`}>
                {profileCountry ? countryFlag(profileCountry.code) : "🌐"} {profileCountry?.label ?? profile.market_code}
                {` · ${profile.local_title} · ${profile.review_state}`}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          국가
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value as MemeCountryCode)}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
          >
            {Object.values(MEME_COUNTRIES).map((item) => (
              <option key={item.code} value={item.code}>
                {countryFlag(item.code)} {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          현지 제목
          <input
            value={localTitle}
            onChange={(event) => setLocalTitle(event.target.value)}
            required
            maxLength={300}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-lg bg-accent-strong px-4 text-base font-semibold text-white disabled:opacity-50"
          >
            {pending ? "저장 중…" : "출처 국가 검수 저장"}
          </button>
        </div>
      </form>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`rounded-lg p-3 text-sm ${message.ok ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
