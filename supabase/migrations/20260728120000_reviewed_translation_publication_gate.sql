-- Publish only current, human-reviewed translations to anonymous readers.
-- Operators retain draft access through meme_translations_operator_write,
-- whose FOR ALL policy also covers SELECT for authenticated operators.

drop policy if exists meme_translations_public_read on public.meme_translations;
create policy meme_translations_public_read on public.meme_translations
  for select
  using (
    status = 'reviewed'
    and reviewed_at is not null
    and reviewed_by is not null
    and exists (
      select 1
        from public.memes source_meme
       where source_meme.id = meme_translations.meme_id
         and source_meme.moderation_status in ('approved', 'limited')
         and source_meme.updated_at = meme_translations.source_updated_at
    )
  );
