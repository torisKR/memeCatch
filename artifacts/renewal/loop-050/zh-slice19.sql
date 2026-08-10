-- Loop 052 offline translation drafts; NOT APPLIED.
-- Snapshot-locked, idempotent machine drafts. Review readable source/target text in loop-052/global-translation-batch/batch.json.

with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiMDU3ZTVlNmQtMzBjOC00NWEyLWFhNjgtMDIzYzY5MmE3YThkIiwibG9jYWxlIjoiemgiLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJjZDU5YzE0NmJjYmJhMjRmNWY0YjJjNGY4OTAyM2U4ZGNiYzVmMTAxZDJiNDg1OWRmZTcyNzljN2YxNWQ3YjJlIiwic291cmNlX3RpdGxlIjoi64SI64KYIOyemO2VmOyEuOyalCIsInNvdXJjZV9zdW1tYXJ5Ijoi7JiB7ZmUICfsuZzsoIjtlZwg6riI7J6Q7JSoJygyMDA1KSDsnbTsmIHslaDsnZgg64OJ7IaM7KCBIOuMgOyCrOydtOyekCDrpqzslaHshZgg7Kek67CpIiwic291cmNlX2Rlc2NyaXB0aW9uIjoi7Lac7IaM7ZWcIOq4iOyekOyUqOyXkOqyjCDssKntlZjqsowg7IK0652866mwIOuRkOu2gOulvCDqsbTrhKTripQg7KCE64+E7IKs7JeQ6rKMIOustO2RnOygle2VmOqyjCDrkZDrtoDrpbwg7JeO7Jy866mwIOuNmOynhCDrjIDsgqwuIOyhtOuMk+unkOqzvCDrsJjrp5DsnYQg7ISe7J2AIOuDieyGjOyggSDslrTsobDqsIAg7ZmU7KCc66W8IOuqqOyVhCDqt7jtlbQg7Jes66aEIOy1nOqzoCDsnKDtlonslrTqsIAg65CQ6rOgLCDsnbTsmIHslaDsnZgg7ZGc7KCVIOy6oeyymOqwgCDrsJjrsJXCt+u5hOybg+ydjOyaqSDrpqzslaHshZgg7Kek67Cp7Jy866GcIOuEkOumrCDsk7DsmIDri6QuIiwic291cmNlX29yaWdpbiI6IuyYge2ZlCAn7Lmc7KCI7ZWcIOq4iOyekOyUqCco67CV7LCs7JqxIOqwkOuPhSwgMjAwNSkg7IaNIOydtOyYgeyVoOydmCDrjIDsgqwiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6Iu2biOqzhO2VmOuKlCDsg4HrjIDsl5Dqsowg65CY67Cb7JWE7LmY64qUIOumrOyVoeyFmOycvOuhnCDsgqzsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi6riI7J6Q7JSoIOuEiOuCmOyemO2VmOyEuOyalCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLsnpTshozrpqwg6re466eM7ZW0LCDrhIjrgpgg7J6Y7ZWY7IS47JqUIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuyggCDrpqzslaHshZgg7JmE7KCEIOuEiOuCmOyemO2VmOyEuOyalCDsp6Qg6rCBIn1dLCJsb2NhbGl6ZWRfc2x1ZyI6IueuoeWlveS9oOiHquW3sS1uZW9uYS1qYWxoYXNleW8iLCJ0aXRsZSI6IuKAnOeuoeWlveS9oOiHquW3seKAne+8iE5lb25hIEphbGhhc2V5b++8iSIsInN1bW1hcnkiOiLmnY7oi7HniLHlnKgyMDA15bm055S15b2x44CK5Lqy5YiH55qE6YeR5a2Q44CL5Lit6K+055qE5LiA5Y+l6K695Yi65Y+w6K+N77yM5aaC5LuK5bi46KKr5b2T5L2c5Y+N5bqU5Zu+5L2/55So44CCIiwiZGVzY3JpcHRpb24iOiLph5HlrZDlh7rni7HlkI7vvIzkuIDlkI3kvKDmlZnlo6vpgJLnu5nlpbnosYbohZDlubblip3lpbnlloToia/nlJ/mtLvvvJvlpbnpnaLml6Dooajmg4XlnLDmjoDnv7vosYbohZDvvIzor7Tlh7rov5nlj6Xor53jgILmlazor63kuI7pmo/mhI/or63mt7fmnYLnmoTorr3liLror63msJTlnKjlvZPlubTlpI/lpKnmiJDkuLrmtYHooYzor63vvIzmnY7oi7HniLHnmoTooajmg4XmiKrlm77kuZ/lub/ms5vnlKjkuo7lj43pqbPmiJblmLLorr3nmoTlj43lupTlm77jgIIiLCJvcmlnaW4iOiLmnLTotZ7pg4Hmiaflr7znmoQyMDA15bm055S15b2x44CK5Lqy5YiH55qE6YeR5a2Q44CL5Lit5p2O6Iux54ix55qE5Y+w6K+N44CCIiwidXNhZ2Vfbm90ZSI6IuWPr+eUqOS9nOWbnuWHu+ivtOaVmeWvueixoeaXtueahOWPjeW6lOOAgiIsImNhdXRpb24iOm51bGwsImFsaWFzZXMiOlsi566h5aW95L2g6Ieq5bexIiwi44CK5Lqy5YiH55qE6YeR5a2Q44CL5Y+N5bqU5Zu+Iiwi6riI7J6Q7JSoIOuEiOuCmOyemO2VmOyEuOyalCJdLCJ1c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi6IGK5aSpIiwidGV4dCI6IuWIq+WGjeWUoOWPqOS6hu+8jOeuoeWlveS9oOiHquW3seOAgiJ9LHsic2l0dWF0aW9uIjoi56S+5Lqk5aqS5L2T6K+E6K66IiwidGV4dCI6IumCo+S4quWPjeW6lOWujOWFqOWwseaYr+KAnOeuoeWlveS9oOiHquW3seKAneeahOihqOaDheWMheOAgiJ9XSwicHJvdmlkZXIiOiJvcGVuYWkiLCJtb2RlbCI6ImdwdC01LjYtbHVuYSIsInByb21wdF92ZXJzaW9uIjoxfQ==', 'base64'), 'utf8')::jsonb
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
      convert_from(decode('eyJtZW1lX2lkIjoiMzM2YWRmZTQtNjExMS00NmY0LWJjM2YtMzVhNTAyZTE0NGE5IiwibG9jYWxlIjoiemgiLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJiMTc1ZTgxYzRiZDc2MDQ0MzNhNTZhNDE0NDUxZjM3YTRjNzY4MDRmNGMzMTkyZWU2NTE2YzhkMTI0ZTZhZDZhIiwic291cmNlX3RpdGxlIjoi6r+I7J2AIOydtOujqOyWtOynhOuLpCIsInNvdXJjZV9zdW1tYXJ5IjoiMjAwMuuFhCDtlZzsnbwg7JuU65Oc7Lu1IDTqsJUg7Iug7ZmU66W8IOyDgeynle2VmOuKlCDqta3rr7wg7Iqs66Gc6rG0Iiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMjAwMuuFhCDtlZzsnbwg7JuU65Oc7Lu17JeQ7IScIO2VnOq1rSDrjIDtkZztjIDsnbQg7Y+0656A65OcLCDtj6zrpbTtiKzqsIgsIOydtO2DiOumrOyVhCwg7Iqk7Y6Y7J247J2EIOyXsO2MjO2VmOupsCDslYTsi5zslYQg7LWc7LSI66GcIDTqsJXsl5Ag7Jik66W064qUIOqzvOygleyXkOyEnCDsnZHsm5Ag6rWs7Zi466GcIOyekOumrOyeoeydgCDrrLjqtazroZwsIOydtO2bhCDstpXqtazrpbwg64SY7Ja0IOyCrO2ajCDsoITrsJjsl5DshJwg7Z2s66ed7J2EIOucu+2VmOuKlCDrp5DroZwg7J247Jqp65CQ64ukLiIsInNvdXJjZV9vcmlnaW4iOiIyMDAy64WEIO2VnOydvCDsm5Trk5zsu7Ug7J2R7JuQIO2YhOyepeqzvCDrsKnshqEg7KSR6rOE7JeQ7IScIO2ZleyCsOuQnCDqtaztmLguIiwic291cmNlX3VzYWdlX25vdGUiOiLtnazrp53soIHsnbgg66mU7Iuc7KeA66W8IOyghO2VoCDrlYwg7J247Jqp7ZWY6riwIOyii+ydjCIsInNvdXJjZV9jYXV0aW9uIjoi7JeG7J2MIiwic291cmNlX2FsaWFzZXMiOlsi6r+I4piF7J2AIOydtOujqOyWtOynhOuLpCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLtj6zquLDtlZjsp4Ag66eILCDqv4jsnYAg7J2066Oo7Ja07KeE64ukIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuydtCDsiqzroZzqsbQg7JWE7KeB64+EIO2emOydtCDrkJzri6QifV0sImxvY2FsaXplZF9zbHVnIjoi5qKm5oOz57uI5Lya5a6e546wIiwidGl0bGUiOiLmoqbmg7Pnu4jkvJrlrp7njrAiLCJzdW1tYXJ5Ijoi6LGh5b6B6Z+p5Zu96Zif5ZyoMjAwMuW5tOmfqeaXpeS4lueVjOadr+mXr+WFpeWbm+W8uueahOWFqOawkeWPo+WPt+OAgiIsImRlc2NyaXB0aW9uIjoiMjAwMuW5tOmfqeaXpeS4lueVjOadr+S4iu+8jOmfqeWbvemYn+WFiOWQjuaImOiDnOazouWFsOOAgeiRoeiQhOeJmeOAgeaEj+Wkp+WIqeWSjOilv+ePreeJme+8jOaIkOS4uummluaUr+i/m+WFpeWbm+W8uueahOS6mua0sueQg+mYn+OAgui/meWPpeivneWcqOi/h+eoi+S4reaIkOS4uuWKqeWogeWPo+WPt++8jOWQjuadpeS5n+i2hei2iui2s+eQg++8jOeUqOadpeihqOi+vuW4jOacm+OAgiIsIm9yaWdpbiI6IuWcqDIwMDLlubTpn6nml6XkuJbnlYzmna/nmoTpn6nlm73liqnlqIHnjrDlnLrlkoznlLXop4bovazmkq3kuK3lub/ms5vkvKDmkq3nmoTlj6Plj7fjgIIiLCJ1c2FnZV9ub3RlIjoi6YCC5ZCI5byV55So5p2l5Lyg6YCS5YWF5ruh5biM5pyb55qE5L+h5oGv44CCIiwiY2F1dGlvbiI6IuayoeacieeJueWIq+eahOazqOaEj+S6i+mhueOAgiIsImFsaWFzZXMiOlsi5qKm5oOz57uI5Lya5a6e546wIiwiMjAwMuW5tOS4lueVjOadr+mfqeWbveWPo+WPtyIsIuq/iOKYheydgCDsnbTro6jslrTsp4Tri6QiXSwidXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6IuiBiuWkqSIsInRleHQiOiLkuI3opoHmlL7lvIPvvIzmoqbmg7Pnu4jkvJrlrp7njrDjgIIifSx7InNpdHVhdGlvbiI6IuekvuS6pOWqkuS9k+ivhOiuuiIsInRleHQiOiLov5nlj6Xlj6Plj7foh7Pku4rku43nu5nmiJHlipvph4/jgIIifV0sInByb3ZpZGVyIjoib3BlbmFpIiwibW9kZWwiOiJncHQtNS42LWx1bmEiLCJwcm9tcHRfdmVyc2lvbiI6MX0=', 'base64'), 'utf8')::jsonb
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

