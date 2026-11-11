import Link from "next/link";

export type RelatedMemeLink = {
  href: string;
  title: string;
  summary?: string | null;
};

/** Four to six internal links. Fewer than four hides the heading as well. */
export function RelatedMemeLinks({
  items,
  heading = "관련 밈",
}: {
  items: readonly RelatedMemeLink[];
  heading?: string;
}) {
  const links = items.filter((item) => item.href && item.title.trim()).slice(0, 6);
  if (links.length < 4) return null;

  return (
    <section aria-labelledby="related-memes" className="mt-10">
      <h2 id="related-memes" className="text-xl font-bold">
        {heading}
      </h2>
      <ul className="mt-3 divide-y divide-border">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block py-3 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="font-semibold">{item.title}</span>
              {item.summary?.trim() ? (
                <span className="mt-1 block text-sm text-muted">{item.summary}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
