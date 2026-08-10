-- Loop 052 offline translation drafts; NOT APPLIED.
-- Snapshot-locked, idempotent machine drafts. Review readable source/target text in loop-052/global-translation-batch/batch.json.

with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiMDU3ZTVlNmQtMzBjOC00NWEyLWFhNjgtMDIzYzY5MmE3YThkIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJjZDU5YzE0NmJjYmJhMjRmNWY0YjJjNGY4OTAyM2U4ZGNiYzVmMTAxZDJiNDg1OWRmZTcyNzljN2YxNWQ3YjJlIiwic291cmNlX3RpdGxlIjoi64SI64KYIOyemO2VmOyEuOyalCIsInNvdXJjZV9zdW1tYXJ5Ijoi7JiB7ZmUICfsuZzsoIjtlZwg6riI7J6Q7JSoJygyMDA1KSDsnbTsmIHslaDsnZgg64OJ7IaM7KCBIOuMgOyCrOydtOyekCDrpqzslaHshZgg7Kek67CpIiwic291cmNlX2Rlc2NyaXB0aW9uIjoi7Lac7IaM7ZWcIOq4iOyekOyUqOyXkOqyjCDssKntlZjqsowg7IK0652866mwIOuRkOu2gOulvCDqsbTrhKTripQg7KCE64+E7IKs7JeQ6rKMIOustO2RnOygle2VmOqyjCDrkZDrtoDrpbwg7JeO7Jy866mwIOuNmOynhCDrjIDsgqwuIOyhtOuMk+unkOqzvCDrsJjrp5DsnYQg7ISe7J2AIOuDieyGjOyggSDslrTsobDqsIAg7ZmU7KCc66W8IOuqqOyVhCDqt7jtlbQg7Jes66aEIOy1nOqzoCDsnKDtlonslrTqsIAg65CQ6rOgLCDsnbTsmIHslaDsnZgg7ZGc7KCVIOy6oeyymOqwgCDrsJjrsJXCt+u5hOybg+ydjOyaqSDrpqzslaHshZgg7Kek67Cp7Jy866GcIOuEkOumrCDsk7DsmIDri6QuIiwic291cmNlX29yaWdpbiI6IuyYge2ZlCAn7Lmc7KCI7ZWcIOq4iOyekOyUqCco67CV7LCs7JqxIOqwkOuPhSwgMjAwNSkg7IaNIOydtOyYgeyVoOydmCDrjIDsgqwiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6Iu2biOqzhO2VmOuKlCDsg4HrjIDsl5Dqsowg65CY67Cb7JWE7LmY64qUIOumrOyVoeyFmOycvOuhnCDsgqzsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi6riI7J6Q7JSoIOuEiOuCmOyemO2VmOyEuOyalCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLsnpTshozrpqwg6re466eM7ZW0LCDrhIjrgpgg7J6Y7ZWY7IS47JqUIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuyggCDrpqzslaHshZgg7JmE7KCEIOuEiOuCmOyemO2VmOyEuOyalCDsp6Qg6rCBIn1dLCJsb2NhbGl6ZWRfc2x1ZyI6Im1pbmQteW91ci1vd24tYnVzaW5lc3MtbmVvbmEtamFsaGFzZXlvIiwidGl0bGUiOiJNaW5kIFlvdXIgT3duIEJ1c2luZXNzIChOZW9uYSBKYWxoYXNleW8pIiwic3VtbWFyeSI6IkEgc2FyY2FzdGljIGxpbmUgZGVsaXZlcmVkIGJ5IExlZSBZb3VuZy1hZSBpbiB0aGUgMjAwNSBmaWxtIFN5bXBhdGh5IGZvciBMYWR5IFZlbmdlYW5jZSB0aGF0IGlzIHdpZGVseSB1c2VkIGFzIGEgcmVhY3Rpb24gaW1hZ2UuIiwiZGVzY3JpcHRpb24iOiJXaGVuIGEgbWlzc2lvbmFyeSBvZmZlcnMgdG9mdSB0byBHZXVtLWphIGFmdGVyIGhlciByZWxlYXNlIGZyb20gcHJpc29uIGFuZCB0ZWxscyBoZXIgdG8gbGl2ZSBraW5kbHksIHNoZSBibGFua2x5IG92ZXJ0dXJucyBpdCBhbmQgc2F5cyB0aGlzIGxpbmUuIEl0cyBzYXJkb25pYyBtaXggb2YgcG9saXRlIGFuZCBjYXN1YWwgS29yZWFuIGJlY2FtZSBhIG1ham9yIGNhdGNocGhyYXNlIHRoYXQgc3VtbWVyLCB3aGlsZSBzY3JlZW5zaG90cyBvZiBMZWUgWW91bmctYWUncyBleHByZXNzaW9uIHNwcmVhZCBhcyByZWFjdGlvbiBpbWFnZXMgZm9yIHJlYnV0dGFsIG9yIG1vY2tlcnkuIiwib3JpZ2luIjoiTGVlIFlvdW5nLWFlJ3MgbGluZSBpbiBQYXJrIENoYW4td29vaydzIDIwMDUgZmlsbSBTeW1wYXRoeSBmb3IgTGFkeSBWZW5nZWFuY2UuIiwidXNhZ2Vfbm90ZSI6IlVzZWQgYXMgYSByZWFjdGlvbiB3aGVuIHB1c2hpbmcgYmFjayBhZ2FpbnN0IHNvbWVvbmUgd2hvIGlzIGxlY3R1cmluZyB5b3UuIiwiY2F1dGlvbiI6bnVsbCwiYWxpYXNlcyI6WyJNaW5kIFlvdXIgT3duIEJ1c2luZXNzIiwiTGFkeSBWZW5nZWFuY2UgcmVhY3Rpb24gaW1hZ2UiLCLquIjsnpDslKgg64SI64KY7J6Y7ZWY7IS47JqUIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJDaGF0IiwidGV4dCI6IlN0b3AgbmFnZ2luZyBtZeKAlG1pbmQgeW91ciBvd24gYnVzaW5lc3MuIn0seyJzaXR1YXRpb24iOiJTb2NpYWwgY29tbWVudCIsInRleHQiOiJUaGF0IHJlYWN0aW9uIGlzIHN1Y2ggYSBwZXJmZWN0IG1pbmQteW91ci1vd24tYnVzaW5lc3MgaW1hZ2UuIn1dLCJwcm92aWRlciI6Im9wZW5haSIsIm1vZGVsIjoiZ3B0LTUuNi1sdW5hIiwicHJvbXB0X3ZlcnNpb24iOjF9', 'base64'), 'utf8')::jsonb
    ) as x(
      meme_id uuid,
      locale text,
      source_updated_at timestamptz,
      source_snapshot_hash text,
      source_title text,
      source_summary text,
      source_description text,
      source_origin text,
      source_usage_note text,
      source_caution text,
      source_aliases text[],
      source_usage_examples jsonb,
      localized_slug text,
      title text,
      summary text,
      description text,
      origin text,
      usage_note text,
      caution text,
      aliases text[],
      usage_examples jsonb,
      provider text,
      model text,
      prompt_version integer
    )
),
locked as materialized (
  select i.*
    from input i
    join public.memes m on m.id = i.meme_id
   where m.updated_at = i.source_updated_at
     and m.moderation_status in ('approved', 'limited')
     and length(i.source_snapshot_hash) = 64
     and m.title is not distinct from i.source_title
     and m.summary is not distinct from i.source_summary
     and m.description is not distinct from i.source_description
     and m.origin is not distinct from i.source_origin
     and m.usage_note is not distinct from i.source_usage_note
     and m.caution is not distinct from i.source_caution
     and m.aliases is not distinct from i.source_aliases
     and m.usage_examples is not distinct from i.source_usage_examples
     and i.locale in ('en', 'ja', 'zh', 'zh-tw')
     and btrim(i.localized_slug) <> ''
     and btrim(i.title) <> ''
     and btrim(i.summary) <> ''
     and btrim(i.description) <> ''
     and btrim(i.origin) <> ''
   for share of m
),
inserted as (
  insert into public.meme_translations (
    meme_id,
    locale,
    localized_slug,
    title,
    summary,
    description,
    origin,
    usage_note,
    caution,
    aliases,
    usage_examples,
    status,
    source_updated_at,
    provider,
    model,
    prompt_version,
    translated_at,
    reviewed_at,
    reviewed_by
  )
  select
    meme_id,
    locale,
    localized_slug,
    title,
    summary,
    description,
    origin,
    usage_note,
    caution,
    aliases,
    usage_examples,
    'machine',
    source_updated_at,
    provider,
    model,
    prompt_version,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiMzM2YWRmZTQtNjExMS00NmY0LWJjM2YtMzVhNTAyZTE0NGE5IiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJiMTc1ZTgxYzRiZDc2MDQ0MzNhNTZhNDE0NDUxZjM3YTRjNzY4MDRmNGMzMTkyZWU2NTE2YzhkMTI0ZTZhZDZhIiwic291cmNlX3RpdGxlIjoi6r+I7J2AIOydtOujqOyWtOynhOuLpCIsInNvdXJjZV9zdW1tYXJ5IjoiMjAwMuuFhCDtlZzsnbwg7JuU65Oc7Lu1IDTqsJUg7Iug7ZmU66W8IOyDgeynle2VmOuKlCDqta3rr7wg7Iqs66Gc6rG0Iiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMjAwMuuFhCDtlZzsnbwg7JuU65Oc7Lu17JeQ7IScIO2VnOq1rSDrjIDtkZztjIDsnbQg7Y+0656A65OcLCDtj6zrpbTtiKzqsIgsIOydtO2DiOumrOyVhCwg7Iqk7Y6Y7J247J2EIOyXsO2MjO2VmOupsCDslYTsi5zslYQg7LWc7LSI66GcIDTqsJXsl5Ag7Jik66W064qUIOqzvOygleyXkOyEnCDsnZHsm5Ag6rWs7Zi466GcIOyekOumrOyeoeydgCDrrLjqtazroZwsIOydtO2bhCDstpXqtazrpbwg64SY7Ja0IOyCrO2ajCDsoITrsJjsl5DshJwg7Z2s66ed7J2EIOucu+2VmOuKlCDrp5DroZwg7J247Jqp65CQ64ukLiIsInNvdXJjZV9vcmlnaW4iOiIyMDAy64WEIO2VnOydvCDsm5Trk5zsu7Ug7J2R7JuQIO2YhOyepeqzvCDrsKnshqEg7KSR6rOE7JeQ7IScIO2ZleyCsOuQnCDqtaztmLguIiwic291cmNlX3VzYWdlX25vdGUiOiLtnazrp53soIHsnbgg66mU7Iuc7KeA66W8IOyghO2VoCDrlYwg7J247Jqp7ZWY6riwIOyii+ydjCIsInNvdXJjZV9jYXV0aW9uIjoi7JeG7J2MIiwic291cmNlX2FsaWFzZXMiOlsi6r+I4piF7J2AIOydtOujqOyWtOynhOuLpCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLtj6zquLDtlZjsp4Ag66eILCDqv4jsnYAg7J2066Oo7Ja07KeE64ukIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuydtCDsiqzroZzqsbQg7JWE7KeB64+EIO2emOydtCDrkJzri6QifV0sImxvY2FsaXplZF9zbHVnIjoiZHJlYW1zLWRvLWNvbWUtdHJ1ZSIsInRpdGxlIjoiRHJlYW1zIERvIENvbWUgVHJ1ZSIsInN1bW1hcnkiOiJBIG5hdGlvbndpZGUgc2xvZ2FuIHRoYXQgY2FtZSB0byBzeW1ib2xpemUgU291dGggS29yZWEncyAyMDAyIEZJRkEgV29ybGQgQ3VwIHJ1biB0byB0aGUgc2VtaWZpbmFscy4iLCJkZXNjcmlwdGlvbiI6IkFzIFNvdXRoIEtvcmVhIGJlYXQgUG9sYW5kLCBQb3J0dWdhbCwgSXRhbHksIGFuZCBTcGFpbiB0byBiZWNvbWUgdGhlIGZpcnN0IEFzaWFuIHRlYW0gdG8gcmVhY2ggdGhlIFdvcmxkIEN1cCBzZW1pZmluYWxzIGluIDIwMDIsIHRoaXMgcGhyYXNlIHRvb2sgaG9sZCBhcyBhIGNoZWVyaW5nIGNoYW50LiBJdCBoYXMgc2luY2UgYmVlbiBxdW90ZWQgYmV5b25kIGZvb3RiYWxsIGFzIGFuIGV4cHJlc3Npb24gb2YgaG9wZS4iLCJvcmlnaW4iOiJBIGNoYW50IHRoYXQgc3ByZWFkIHRocm91Z2ggMjAwMiBGSUZBIFdvcmxkIEN1cCBjaGVlcmluZyBjcm93ZHMgYW5kIHRlbGV2aXNpb24gYnJvYWRjYXN0cyBpbiBTb3V0aCBLb3JlYS4iLCJ1c2FnZV9ub3RlIjoiQSBnb29kIHF1b3RlIGZvciBzaGFyaW5nIGEgaG9wZWZ1bCBtZXNzYWdlLiIsImNhdXRpb24iOiJObyBzcGVjaWZpYyBjYXV0aW9ucy4iLCJhbGlhc2VzIjpbIkRyZWFtcyBEbyBDb21lIFRydWUiLCJLb3JlYSAyMDAyIFdvcmxkIEN1cCBzbG9nYW4iLCLqv4jimIXsnYAg7J2066Oo7Ja07KeE64ukIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJDaGF0IiwidGV4dCI6IkRvIG5vdCBnaXZlIHVw4oCUZHJlYW1zIGRvIGNvbWUgdHJ1ZS4ifSx7InNpdHVhdGlvbiI6IlNvY2lhbCBjb21tZW50IiwidGV4dCI6IlRoaXMgc2xvZ2FuIHN0aWxsIGdpdmVzIG1lIHN0cmVuZ3RoLiJ9XSwicHJvdmlkZXIiOiJvcGVuYWkiLCJtb2RlbCI6ImdwdC01LjYtbHVuYSIsInByb21wdF92ZXJzaW9uIjoxfQ==', 'base64'), 'utf8')::jsonb
    ) as x(
      meme_id uuid,
      locale text,
      source_updated_at timestamptz,
      source_snapshot_hash text,
      source_title text,
      source_summary text,
      source_description text,
      source_origin text,
      source_usage_note text,
      source_caution text,
      source_aliases text[],
      source_usage_examples jsonb,
      localized_slug text,
      title text,
      summary text,
      description text,
      origin text,
      usage_note text,
      caution text,
      aliases text[],
      usage_examples jsonb,
      provider text,
      model text,
      prompt_version integer
    )
),
locked as materialized (
  select i.*
    from input i
    join public.memes m on m.id = i.meme_id
   where m.updated_at = i.source_updated_at
     and m.moderation_status in ('approved', 'limited')
     and length(i.source_snapshot_hash) = 64
     and m.title is not distinct from i.source_title
     and m.summary is not distinct from i.source_summary
     and m.description is not distinct from i.source_description
     and m.origin is not distinct from i.source_origin
     and m.usage_note is not distinct from i.source_usage_note
     and m.caution is not distinct from i.source_caution
     and m.aliases is not distinct from i.source_aliases
     and m.usage_examples is not distinct from i.source_usage_examples
     and i.locale in ('en', 'ja', 'zh', 'zh-tw')
     and btrim(i.localized_slug) <> ''
     and btrim(i.title) <> ''
     and btrim(i.summary) <> ''
     and btrim(i.description) <> ''
     and btrim(i.origin) <> ''
   for share of m
),
inserted as (
  insert into public.meme_translations (
    meme_id,
    locale,
    localized_slug,
    title,
    summary,
    description,
    origin,
    usage_note,
    caution,
    aliases,
    usage_examples,
    status,
    source_updated_at,
    provider,
    model,
    prompt_version,
    translated_at,
    reviewed_at,
    reviewed_by
  )
  select
    meme_id,
    locale,
    localized_slug,
    title,
    summary,
    description,
    origin,
    usage_note,
    caution,
    aliases,
    usage_examples,
    'machine',
    source_updated_at,
    provider,
    model,
    prompt_version,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

