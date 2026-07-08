import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "환영해요",
  description: "관심 있는 밈을 알려 주시면 딱 맞는 밈을 먼저 보여드려요.",
};

/** 내부 경로만 허용 (open redirect 방지) */
function safeNext(raw: string | string[] | undefined): string {
  const next = typeof raw === "string" ? raw : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
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
    .select("nickname, interests, age_group")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <OnboardingForm
        next={next}
        defaultNickname={profile?.nickname ?? ""}
        defaultInterests={profile?.interests ?? []}
        defaultAgeGroup={profile?.age_group ?? ""}
      />
    </main>
  );
}
