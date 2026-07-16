import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom } from "@/lib/labels";
import { AnswerCard } from "@/components/answer-card";
import { ShareButton } from "@/components/share-button";
import { TrackedBlock } from "@/components/tracked-block";
import Link from "next/link";

/**
 * 오늘의 밈 위젯 (Wave 1 / D1) — hash(KST일자) % N 번째 밈을 하루 동안 고정 노출.
 * 요청별 SSR에서 KST 날짜를 계산하므로 자정 이후 다음 요청부터 교체된다. 정답 카드 재사용 + 공유.
 */
function kstDayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function loadTodayMeme() {
  try {
    const supabase = createStaticClient();
    const { count } = await supabase
      .from("memes")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "approved");
    if (!count) return null;

    const offset = hashCode(kstDayKey()) % count;
    const { data: meme } = await supabase
      .from("memes")
      .select("short_id, slug, title, summary, lifecycle_status, safety_level")
      .eq("moderation_status", "approved")
      .order("id", { ascending: true })
      .range(offset, offset)
      .single();
    return meme ?? null;
  } catch {
    return null;
  }
}

export async function TodayMeme() {
  const meme = await loadTodayMeme();
  if (!meme) return null;
  const path = memePathFrom(meme.short_id, meme.slug);

  return (
      <section aria-labelledby="today-meme" className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 id="today-meme" className="flex items-center gap-1.5 text-xl font-bold">
            <span aria-hidden className="inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-sm font-extrabold text-flame-800">
              오늘
            </span>
            오늘의 밈
          </h2>
          <ShareButton path={path} title={meme.title} label="공유" />
        </div>
        <TrackedBlock event="today_meme_click" className="mt-3">
          <Link href={path} className="block transition-transform hover:-translate-y-0.5">
            <AnswerCard meme={meme} />
          </Link>
        </TrackedBlock>
      </section>
  );
}
