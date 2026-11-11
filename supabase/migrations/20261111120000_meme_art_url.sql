-- Nullable poster art for a meme. The picture has no letters; the card and
-- the OG image draw the title, usage badge, year, and summary themselves.
-- Apply this with the operator migration path. The app does not run it.

alter table public.memes
  add column if not exists art_url text;

comment on column public.memes.art_url is
  'Same-origin path to text-free poster art, for example /api/media/meme-art/{short_id}.png. Null means the card draws the charcoal speech-bubble fallback.';

-- Rollback: alter table public.memes drop column if exists art_url;
