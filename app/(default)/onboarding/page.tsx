import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import { safeNext } from "@/lib/safe-redirect";
import { getRequestLocale } from "@/lib/i18n-server";
import { MY_COPY } from "@/lib/i18n-my";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = MY_COPY[locale].onboarding;

  return { title: copy.title, description: copy.body };
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/onboarding?next=${next}`)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, interests, age_group, use_purpose, preferred_platforms")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="instrument-grid mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <OnboardingForm
          next={next}
          defaultNickname={profile?.nickname ?? ""}
          defaultInterests={profile?.interests ?? []}
          defaultAgeGroup={profile?.age_group ?? ""}
          defaultUsePurpose={profile?.use_purpose ?? "creator"}
          defaultPreferredPlatforms={profile?.preferred_platforms ?? []}
        />
      </div>
    </main>
  );
}
