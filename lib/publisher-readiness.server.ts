import "server-only";

import type { createClient } from "@/lib/supabase/server";
import {
  PUBLISHER_READINESS_PAGE_SIZE,
  buildPublisherReadinessPage,
  parsePublisherReadinessFocus,
  parsePublisherReadinessPage,
  type PublisherReadinessFocus,
  type PublisherReadinessReport,
  type PublisherReadinessRow,
} from "@/lib/publisher-readiness";

export const PUBLISHER_READINESS_SELECT =
  "id, short_id, slug, title, summary, description, origin, usage_note, caution, usage_examples, moderation_status, published_at, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id)" as const;

type PublisherReadinessClient = Awaited<ReturnType<typeof createClient>>;

export type PublisherReadinessPageOptions = {
  page?: number;
  focus?: PublisherReadinessFocus | null;
  now?: Date;
};

export async function listPublisherReadinessPage(
  supabase: PublisherReadinessClient,
  options: PublisherReadinessPageOptions,
): Promise<PublisherReadinessReport> {
  const page = parsePublisherReadinessPage(options.page);
  const focus = parsePublisherReadinessFocus(options.focus);
  const from = (page - 1) * PUBLISHER_READINESS_PAGE_SIZE;
  const to = from + PUBLISHER_READINESS_PAGE_SIZE - 1;
  const { data, count, error } = await supabase
    .from("memes")
    .select(PUBLISHER_READINESS_SELECT, { count: "exact" })
    .in("moderation_status", ["approved", "limited"])
    .order("id", { ascending: true })
    .range(from, to)
    .returns<PublisherReadinessRow[]>();

  if (error) {
    throw new Error(`퍼블리셔 준비도 데이터를 불러오지 못했어요: ${error.message}`);
  }
  if (count === null) {
    throw new Error("전체 공개 문서 수를 확인하지 못했어요.");
  }

  return buildPublisherReadinessPage(data ?? [], {
    page,
    totalPublic: count,
    focus,
    now: options.now,
  });
}
