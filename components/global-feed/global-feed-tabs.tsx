import Link from "next/link";
import { CountryFlagBadge } from "@/components/country-flag-badge";
import { MemeThumbnail } from "@/components/meme-thumbnail";
import { SafetyBadge } from "@/components/safety-badge";
import type {
  FeedPlatformKey,
  GlobalFeedItem,
  GlobalFeedResult,
} from "@/lib/global-feed.types";
import { memePathFrom, type MemeCategory, type SafetyLevel } from "@/lib/labels";
import { SOURCE_PLATFORM_META } from "@/lib/source-platform";

const PLATFORMS: ReadonlyArray<{ key: FeedPlatformKey; label: string }> = [
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
];

const FEED_LAYOUT = [
  "lg:col-span-7",
  "lg:col-span-5",
  "lg:col-span-5",
  "lg:col-span-7",
] as const;

export function GlobalFeedTabs({
  activeKey,
  feed,
}: {
  activeKey: FeedPlatformKey;
  feed: GlobalFeedResult;
}) {
  const platformLabel =
    PLATFORMS.find(({ key }) => key === activeKey)?.label ?? "YouTube";

  return (
    <section className="mt-8" aria-labelledby="global-feed-results">
      <h2 id="global-feed-results" lang="en" className="sr-only">
        {platformLabel} meme feed
      </h2>
      <nav
        aria-label="Choose a platform"
        lang="en"
        className="grid min-w-0 grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1"
      >
        {PLATFORMS.map(({ key, label }) => {
          const active = key === activeKey;
          return (
            <Link
              key={key}
              href={`/global?platform=${key}`}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg px-2 text-xs font-bold transition-[background-color,color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none sm:text-sm ${
                active
                  ? "bg-accent-strong text-white"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {feed.status === "error" ? (
        <FeedState
          kind="error"
          title={`Could not load ${platformLabel}`}
          body="The feed query failed before any items could be shown. No placeholder memes were substituted."
          href={`/global?platform=${activeKey}`}
          action="Try again"
        />
      ) : feed.status === "empty" || feed.items.length === 0 ? (
        <FeedState
          kind="empty"
          title={`No reviewed ${platformLabel} picks yet`}
          body="We only show public sources that passed review. Browse the Korean meme index while this feed fills up."
          href="/explore"
          action="Browse Korean meme index"
        />
      ) : (
        <ReadyFeed items={feed.items} />
      )}
    </section>
  );
}

function ReadyFeed({ items }: { items: GlobalFeedItem[] }) {
  const [lead, ...rest] = items;
  if (!lead) return null;

  return (
    <div className="mt-6 min-w-0">
      <article className="overflow-hidden rounded-2xl border border-border bg-surface">
        <Link
          href={memePathFrom(lead.short_id, lead.slug)}
          className="group grid min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]"
        >
          <div className="min-w-0 border-b border-border md:border-b-0 md:border-r">
            <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
              <div className="absolute right-3 top-3 z-10">
                <CountryFlagBadge code={lead.origin_country_code} locale="en" />
              </div>
              <MemeThumbnail
                src={lead.thumbnail_url}
                title={lead.title}
                fallbackCaption={lead.summary}
                category={lead.category as MemeCategory}
                originYear={lead.origin_year}
                priority
                variant="compact"
              />
            </div>
            <PlatformMeta item={lead} />
          </div>
          <div className="flex min-w-0 flex-col items-start justify-center p-5 sm:p-7">
            <h3 className="break-words text-2xl font-black leading-tight tracking-[-0.025em] sm:text-3xl">
              {lead.title}
            </h3>
            <p className="mt-3 line-clamp-4 break-words text-sm leading-relaxed text-muted sm:text-base">
              {lead.summary}
            </p>
            <div className="mt-5">
              <SafetyBadge level={lead.safety_level as SafetyLevel} />
            </div>
            <span lang="en" className="mt-6 text-sm font-bold text-accent group-hover:underline group-hover:underline-offset-4">
              Open Korean detail
            </span>
          </div>
        </Link>
      </article>

      {rest.length > 0 && (
        <ul className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {rest.map((item, index) => (
            <li
              key={item.id}
              className={`min-w-0 sm:col-span-1 ${FEED_LAYOUT[index % FEED_LAYOUT.length]}`}
            >
              <article className="h-full overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color,transform] hover:-translate-y-0.5 hover:border-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <Link
                  href={memePathFrom(item.short_id, item.slug)}
                  className="group flex h-full min-w-0 flex-col focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                >
                  <div
                    className={`relative overflow-hidden bg-surface-2 ${
                      index % 4 === 0 || index % 4 === 3
                        ? "aspect-[16/10]"
                        : "aspect-[4/3]"
                    }`}
                  >
                    <div className="absolute right-3 top-3 z-10">
                      <CountryFlagBadge code={item.origin_country_code} locale="en" />
                    </div>
                    <MemeThumbnail
                      src={item.thumbnail_url}
                      title={item.title}
                      fallbackCaption={item.summary}
                      category={item.category as MemeCategory}
                      originYear={item.origin_year}
                      priority={index < 2}
                      variant="compact"
                    />
                  </div>
                  <PlatformMeta item={item} />
                  <div className="flex min-w-0 flex-1 flex-col items-start p-4 pt-2">
                    <h3 className="line-clamp-2 break-words text-base font-black leading-snug sm:text-lg">
                      {item.title}
                    </h3>
                    <div className="mt-auto pt-4">
                      <SafetyBadge level={item.safety_level as SafetyLevel} />
                    </div>
                  </div>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}

      <p lang="en" className="mt-6 max-w-2xl text-xs leading-relaxed text-muted">
        Source media stays on its original platform. MemeCatch stores reviewed links and context, not copied media.
      </p>
    </div>
  );
}

function PlatformMeta({ item }: { item: GlobalFeedItem }) {
  return (
    <p
      data-global-feed-platform
      lang="en"
      className="px-4 pb-2 pt-3 text-xs font-semibold text-muted"
    >
      {SOURCE_PLATFORM_META[item.platform].label}
    </p>
  );
}

function FeedState({
  kind,
  title,
  body,
  href,
  action,
}: {
  kind: "empty" | "error";
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : undefined}
      lang="en"
      className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8"
    >
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{body}</p>
      {kind === "error" ? (
        <a
          href={href}
          className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] motion-reduce:active:scale-100"
        >
          {action}
        </a>
      ) : (
        <Link
          href={href}
          prefetch={false}
          className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] motion-reduce:active:scale-100"
        >
          {action}
        </Link>
      )}
    </div>
  );
}
