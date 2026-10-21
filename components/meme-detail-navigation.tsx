export function MemeDetailNavigation({
  label,
  items,
}: {
  label: string;
  items: readonly { id: string; label: string }[];
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={label} className="rounded-2xl border border-border bg-surface p-3">
      <ol className="flex min-w-0 flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id} className="min-w-0 max-w-full">
            <a
              href={`#${item.id}`}
              className="inline-flex min-h-11 max-w-full items-center rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold leading-5 text-foreground hover:border-accent hover:bg-accent-soft hover:text-accent-text active:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="min-w-0 break-words">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
