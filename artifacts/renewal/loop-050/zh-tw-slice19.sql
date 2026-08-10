-- Loop 052 offline translation drafts; NOT APPLIED.
-- Snapshot-locked, idempotent machine drafts. Review readable source/target text in loop-052/global-translation-batch/batch.json.

with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiMDU3ZTVlNmQtMzBjOC00NWEyLWFhNjgtMDIzYzY5MmE3YThkIiwibG9jYWxlIjoiemgtdHciLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJjZDU5YzE0NmJjYmJhMjRmNWY0YjJjNGY4OTAyM2U4ZGNiYzVmMTAxZDJiNDg1OWRmZTcyNzljN2YxNWQ3YjJlIiwic291cmNlX3RpdGxlIjoi64SI64KYIOyemO2VmOyEuOyalCIsInNvdXJjZV9zdW1tYXJ5Ijoi7JiB7ZmUICfsuZzsoIjtlZwg6riI7J6Q7JSoJygyMDA1KSDsnbTsmIHslaDsnZgg64OJ7IaM7KCBIOuMgOyCrOydtOyekCDrpqzslaHshZgg7Kek67CpIiwic291cmNlX2Rlc2NyaXB0aW9uIjoi7Lac7IaM7ZWcIOq4iOyekOyUqOyXkOqyjCDssKntlZjqsowg7IK0652866mwIOuRkOu2gOulvCDqsbTrhKTripQg7KCE64+E7IKs7JeQ6rKMIOustO2RnOygle2VmOqyjCDrkZDrtoDrpbwg7JeO7Jy866mwIOuNmOynhCDrjIDsgqwuIOyhtOuMk+unkOqzvCDrsJjrp5DsnYQg7ISe7J2AIOuDieyGjOyggSDslrTsobDqsIAg7ZmU7KCc66W8IOuqqOyVhCDqt7jtlbQg7Jes66aEIOy1nOqzoCDsnKDtlonslrTqsIAg65CQ6rOgLCDsnbTsmIHslaDsnZgg7ZGc7KCVIOy6oeyymOqwgCDrsJjrsJXCt+u5hOybg+ydjOyaqSDrpqzslaHshZgg7Kek67Cp7Jy866GcIOuEkOumrCDsk7DsmIDri6QuIiwic291cmNlX29yaWdpbiI6IuyYge2ZlCAn7Lmc7KCI7ZWcIOq4iOyekOyUqCco67CV7LCs7JqxIOqwkOuPhSwgMjAwNSkg7IaNIOydtOyYgeyVoOydmCDrjIDsgqwiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6Iu2biOqzhO2VmOuKlCDsg4HrjIDsl5Dqsowg65CY67Cb7JWE7LmY64qUIOumrOyVoeyFmOycvOuhnCDsgqzsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi6riI7J6Q7JSoIOuEiOuCmOyemO2VmOyEuOyalCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLsnpTshozrpqwg6re466eM7ZW0LCDrhIjrgpgg7J6Y7ZWY7IS47JqUIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuyggCDrpqzslaHshZgg7JmE7KCEIOuEiOuCmOyemO2VmOyEuOyalCDsp6Qg6rCBIn1dLCJsb2NhbGl6ZWRfc2x1ZyI6IueuoeWlveS9oOiHquW3sS1uZW9uYS1qYWxoYXNleW8iLCJ0aXRsZSI6IuOAjOeuoeWlveS9oOiHquW3seOAje+8iE5lb25hIEphbGhhc2V5b++8iSIsInN1bW1hcnkiOiLmnY7oi7HmhJvlnKgyMDA15bm06Zu75b2x44CK6Kaq5YiH55qE6YeR5a2Q44CL5Lit6Kqq55qE5LiA5Y+l6Ku35Yi65Y+w6Kme77yM5aaC5LuK5bi46KKr55W25L2c5Y+N5oeJ5ZyW5L2/55So44CCIiwiZGVzY3JpcHRpb24iOiLph5HlrZDlh7rnjYTlvozvvIzkuIDlkI3lgrPmlZnlo6vpgZ7ntablpbnosYbohZDkuKbli7jlpbnlloToia/nlJ/mtLvvvJvlpbnpnaLnhKHooajmg4XlnLDmjoDnv7vosYbohZDvvIzoqqrlh7rpgJnlj6XoqbHjgILmlazoqp7oiIfpmqjmhI/oqp7mt7fpm5znmoToq7fliLroqp7msKPlnKjnlbblubTlpI/lpKnmiJDngrrmtYHooYzoqp7vvIzmnY7oi7HmhJvnmoTooajmg4XmiKrlnJbkuZ/lu6Pms5vnlKjmlrzlj43pp4HmiJblmLLoq7fnmoTlj43mh4nlnJbjgIIiLCJvcmlnaW4iOiLmnLTotIrpg4Hln7flsI7nmoQyMDA15bm06Zu75b2x44CK6Kaq5YiH55qE6YeR5a2Q44CL5Lit5p2O6Iux5oSb55qE5Y+w6Kme44CCIiwidXNhZ2Vfbm90ZSI6IuWPr+eUqOS9nOWbnuaTiuiqquaVmeWwjeixoeaZgueahOWPjeaHieOAgiIsImNhdXRpb24iOm51bGwsImFsaWFzZXMiOlsi566h5aW95L2g6Ieq5bexIiwi44CK6Kaq5YiH55qE6YeR5a2Q44CL5Y+N5oeJ5ZyWIiwi6riI7J6Q7JSoIOuEiOuCmOyemO2VmOyEuOyalCJdLCJ1c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi6IGK5aSpIiwidGV4dCI6IuWIpeWGjeWYruWPqOS6hu+8jOeuoeWlveS9oOiHquW3seOAgiJ9LHsic2l0dWF0aW9uIjoi56S+576k55WZ6KiAIiwidGV4dCI6IumCo+WAi+WPjeaHieWujOWFqOWwseaYr+OAjOeuoeWlveS9oOiHquW3seOAjeeahOi/t+WboOWcluOAgiJ9XSwicHJvdmlkZXIiOiJvcGVuYWkiLCJtb2RlbCI6ImdwdC01LjYtbHVuYSIsInByb21wdF92ZXJzaW9uIjoxfQ==', 'base64'), 'utf8')::jsonb
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
      convert_from(decode('eyJtZW1lX2lkIjoiMzM2YWRmZTQtNjExMS00NmY0LWJjM2YtMzVhNTAyZTE0NGE5IiwibG9jYWxlIjoiemgtdHciLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJiMTc1ZTgxYzRiZDc2MDQ0MzNhNTZhNDE0NDUxZjM3YTRjNzY4MDRmNGMzMTkyZWU2NTE2YzhkMTI0ZTZhZDZhIiwic291cmNlX3RpdGxlIjoi6r+I7J2AIOydtOujqOyWtOynhOuLpCIsInNvdXJjZV9zdW1tYXJ5IjoiMjAwMuuFhCDtlZzsnbwg7JuU65Oc7Lu1IDTqsJUg7Iug7ZmU66W8IOyDgeynle2VmOuKlCDqta3rr7wg7Iqs66Gc6rG0Iiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMjAwMuuFhCDtlZzsnbwg7JuU65Oc7Lu17JeQ7IScIO2VnOq1rSDrjIDtkZztjIDsnbQg7Y+0656A65OcLCDtj6zrpbTtiKzqsIgsIOydtO2DiOumrOyVhCwg7Iqk7Y6Y7J247J2EIOyXsO2MjO2VmOupsCDslYTsi5zslYQg7LWc7LSI66GcIDTqsJXsl5Ag7Jik66W064qUIOqzvOygleyXkOyEnCDsnZHsm5Ag6rWs7Zi466GcIOyekOumrOyeoeydgCDrrLjqtazroZwsIOydtO2bhCDstpXqtazrpbwg64SY7Ja0IOyCrO2ajCDsoITrsJjsl5DshJwg7Z2s66ed7J2EIOucu+2VmOuKlCDrp5DroZwg7J247Jqp65CQ64ukLiIsInNvdXJjZV9vcmlnaW4iOiIyMDAy64WEIO2VnOydvCDsm5Trk5zsu7Ug7J2R7JuQIO2YhOyepeqzvCDrsKnshqEg7KSR6rOE7JeQ7IScIO2ZleyCsOuQnCDqtaztmLguIiwic291cmNlX3VzYWdlX25vdGUiOiLtnazrp53soIHsnbgg66mU7Iuc7KeA66W8IOyghO2VoCDrlYwg7J247Jqp7ZWY6riwIOyii+ydjCIsInNvdXJjZV9jYXV0aW9uIjoi7JeG7J2MIiwic291cmNlX2FsaWFzZXMiOlsi6r+I4piF7J2AIOydtOujqOyWtOynhOuLpCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLtj6zquLDtlZjsp4Ag66eILCDqv4jsnYAg7J2066Oo7Ja07KeE64ukIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuydtCDsiqzroZzqsbQg7JWE7KeB64+EIO2emOydtCDrkJzri6QifV0sImxvY2FsaXplZF9zbHVnIjoi5aSi5oOz57WC5pyD5a+m54++IiwidGl0bGUiOiLlpKLmg7PntYLmnIPlr6bnj74iLCJzdW1tYXJ5Ijoi6LGh5b616Z+T5ZyL6ZqK5ZyoMjAwMuW5tOaXpemfk+S4lueVjOebg+mXluWFpeWbm+W8t+eahOWFqOawkeWPo+iZn+OAgiIsImRlc2NyaXB0aW9uIjoiMjAwMuW5tOaXpemfk+S4lueVjOebg+S4iu+8jOmfk+Wci+maiuWFiOW+jOaIsOWLneazouiYreOAgeiRoeiQhOeJmeOAgee+qeWkp+WIqeWSjOilv+ePreeJme+8jOaIkOeCuummluaUr+mAsuWFpeWbm+W8t+eahOS6nua0sueQg+maiuOAgumAmeWPpeipseWcqOmBjueoi+S4reaIkOeCuuWKqeWogeWPo+iZn++8jOW+jOS+huS5n+i2hei2iui2s+eQg++8jOeUqOS+huihqOmBlOW4jOacm+OAgiIsIm9yaWdpbiI6IuWcqDIwMDLlubTml6Xpn5PkuJbnlYznm4PnmoTpn5PlnIvliqnlqIHnj77loLTlkozpm7voppbovYnmkq3kuK3lu6Pms5vlgrPmkq3nmoTlj6PomZ/jgIIiLCJ1c2FnZV9ub3RlIjoi6YGp5ZCI5byV55So5L6G5YKz6YGU5YWF5ru/5biM5pyb55qE6KiK5oGv44CCIiwiY2F1dGlvbiI6IuaykuacieeJueWIpeeahOazqOaEj+S6i+mgheOAgiIsImFsaWFzZXMiOlsi5aSi5oOz57WC5pyD5a+m54++IiwiMjAwMuW5tOS4lueVjOebg+mfk+Wci+WPo+iZnyIsIuq/iOKYheydgCDsnbTro6jslrTsp4Tri6QiXSwidXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6IuiBiuWkqSIsInRleHQiOiLkuI3opoHmlL7mo4TvvIzlpKLmg7PntYLmnIPlr6bnj77jgIIifSx7InNpdHVhdGlvbiI6Iuekvue+pOeVmeiogCIsInRleHQiOiLpgJnlj6Xlj6PomZ/oh7Pku4rku43ntabmiJHlipvph4/jgIIifV0sInByb3ZpZGVyIjoib3BlbmFpIiwibW9kZWwiOiJncHQtNS42LWx1bmEiLCJwcm9tcHRfdmVyc2lvbiI6MX0=', 'base64'), 'utf8')::jsonb
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

