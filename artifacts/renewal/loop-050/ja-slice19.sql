-- Loop 052 offline translation drafts; NOT APPLIED.
-- Snapshot-locked, idempotent machine drafts. Review readable source/target text in loop-052/global-translation-batch/batch.json.

with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiMDU3ZTVlNmQtMzBjOC00NWEyLWFhNjgtMDIzYzY5MmE3YThkIiwibG9jYWxlIjoiamEiLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJjZDU5YzE0NmJjYmJhMjRmNWY0YjJjNGY4OTAyM2U4ZGNiYzVmMTAxZDJiNDg1OWRmZTcyNzljN2YxNWQ3YjJlIiwic291cmNlX3RpdGxlIjoi64SI64KYIOyemO2VmOyEuOyalCIsInNvdXJjZV9zdW1tYXJ5Ijoi7JiB7ZmUICfsuZzsoIjtlZwg6riI7J6Q7JSoJygyMDA1KSDsnbTsmIHslaDsnZgg64OJ7IaM7KCBIOuMgOyCrOydtOyekCDrpqzslaHshZgg7Kek67CpIiwic291cmNlX2Rlc2NyaXB0aW9uIjoi7Lac7IaM7ZWcIOq4iOyekOyUqOyXkOqyjCDssKntlZjqsowg7IK0652866mwIOuRkOu2gOulvCDqsbTrhKTripQg7KCE64+E7IKs7JeQ6rKMIOustO2RnOygle2VmOqyjCDrkZDrtoDrpbwg7JeO7Jy866mwIOuNmOynhCDrjIDsgqwuIOyhtOuMk+unkOqzvCDrsJjrp5DsnYQg7ISe7J2AIOuDieyGjOyggSDslrTsobDqsIAg7ZmU7KCc66W8IOuqqOyVhCDqt7jtlbQg7Jes66aEIOy1nOqzoCDsnKDtlonslrTqsIAg65CQ6rOgLCDsnbTsmIHslaDsnZgg7ZGc7KCVIOy6oeyymOqwgCDrsJjrsJXCt+u5hOybg+ydjOyaqSDrpqzslaHshZgg7Kek67Cp7Jy866GcIOuEkOumrCDsk7DsmIDri6QuIiwic291cmNlX29yaWdpbiI6IuyYge2ZlCAn7Lmc7KCI7ZWcIOq4iOyekOyUqCco67CV7LCs7JqxIOqwkOuPhSwgMjAwNSkg7IaNIOydtOyYgeyVoOydmCDrjIDsgqwiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6Iu2biOqzhO2VmOuKlCDsg4HrjIDsl5Dqsowg65CY67Cb7JWE7LmY64qUIOumrOyVoeyFmOycvOuhnCDsgqzsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi6riI7J6Q7JSoIOuEiOuCmOyemO2VmOyEuOyalCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLsnpTshozrpqwg6re466eM7ZW0LCDrhIjrgpgg7J6Y7ZWY7IS47JqUIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuyggCDrpqzslaHshZgg7JmE7KCEIOuEiOuCmOyemO2VmOyEuOyalCDsp6Qg6rCBIn1dLCJsb2NhbGl6ZWRfc2x1ZyI6IuiHquWIhuOBruOBk+OBqOOCkuOBoeOCg+OCk+OBqOOBl+OBquOBleOBhC3jg43jgqrjg4ot44OB44Oj44Op44K744OoIiwidGl0bGUiOiLjgIzoh6rliIbjga7jgZPjgajjgpLjgaHjgoPjgpPjgajjgZfjgarjgZXjgYTjgI3vvIjjg43jgqrjg4rjg7vjg4Hjg6Pjg6njgrvjg6jvvIkiLCJzdW1tYXJ5Ijoi5pig55S744CO6Kaq5YiH44Gq44Kv44Og44K444Oj44GV44KT44CP77yIMjAwNeW5tO+8ieOBp+OCpOODu+ODqOODs+OCqOOBjOaUvuOBpOearuiCieOBquOBm+OCiuOBteOBp+OAgeODquOCouOCr+OCt+ODp+ODs+eUu+WDj+OBqOOBl+OBpuS9v+OCj+OCjOOCi+OAgiIsImRlc2NyaXB0aW9uIjoi5Ye65omA44GX44Gf44Kv44Og44K444Oj44Gr6LGG6IWQ44KS5beu44GX5Ye644GX44CB5ZaE6Imv44Gr55Sf44GN44KL44KI44GG6Kut44GZ5Lyd6YGT5bir44G444CB5b285aWz44GM54Sh6KGo5oOF44Gn6LGG6IWQ44KS44Gy44Gj44GP44KK6L+U44GX44Gm6KiA44GG44Gb44KK44G144CC5pWs6Kqe44Go44GP44Gg44GR44Gf6KiA44GE5pa544GM5re344GY44KL55qu6IKJ44Gq5Y+j6Kq/44GM44Gd44Gu5bm044Gu5aSP44Gr5aSn44GN44Gq5rWB6KGM6Kqe44Go44Gq44KK44CB44Kk44O744Oo44Oz44Ko44Gu6KGo5oOF44KS5YiH44KK5Y+W44Gj44Gf55S75YOP44Gv5Y+N6KuW44KE44GC44GW44GR44KK44Gu44Oq44Ki44Kv44K344On44Oz55S75YOP44Go44GX44Gm5bqD44GP5L2/44KP44KM44Gf44CCIiwib3JpZ2luIjoi44OR44Kv44O744OB44Oj44OM44Kv55uj552j44GuMjAwNeW5tOaYoOeUu+OAjuimquWIh+OBquOCr+ODoOOCuOODo+OBleOCk+OAj+OBp+OBruOCpOODu+ODqOODs+OCqOOBruOBm+OCiuOBteOAgiIsInVzYWdlX25vdGUiOiLoqqzmlZnjgZfjgabjgY/jgovnm7jmiYvjgavoqIDjgYTov5TjgZnjg6rjgqLjgq/jgrfjg6fjg7PjgajjgZfjgabkvb/jgYbjgIIiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIuiHquWIhuOBruOBk+OBqOOCkuOBoeOCg+OCk+OBqOOBl+OBquOBleOBhCIsIuOCr+ODoOOCuOODo+OBleOCk+OBruODquOCouOCr+OCt+ODp+ODs+eUu+WDjyIsIuq4iOyekOyUqCDrhIjrgpjsnpjtlZjshLjsmpQiXSwidXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6IuODgeODo+ODg+ODiCIsInRleHQiOiLoqqzmlZnjga/jgoTjgoHjgabjgIHoh6rliIbjga7jgZPjgajjgpLjgaHjgoPjgpPjgajjgZfjgarjgZXjgYTjgIIifSx7InNpdHVhdGlvbiI6IlNOU+OCs+ODoeODs+ODiCIsInRleHQiOiLjgYLjga7jg6rjgqLjgq/jgrfjg6fjg7PjgIHlrozlhajjgavjgIzoh6rliIbjga7jgZPjgajjgpLjgaHjgoPjgpPjgajjgZfjgarjgZXjgYTjgI3nlLvlg4/jgaDjgIIifV0sInByb3ZpZGVyIjoib3BlbmFpIiwibW9kZWwiOiJncHQtNS42LWx1bmEiLCJwcm9tcHRfdmVyc2lvbiI6MX0=', 'base64'), 'utf8')::jsonb
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
      convert_from(decode('eyJtZW1lX2lkIjoiMzM2YWRmZTQtNjExMS00NmY0LWJjM2YtMzVhNTAyZTE0NGE5IiwibG9jYWxlIjoiamEiLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJiMTc1ZTgxYzRiZDc2MDQ0MzNhNTZhNDE0NDUxZjM3YTRjNzY4MDRmNGMzMTkyZWU2NTE2YzhkMTI0ZTZhZDZhIiwic291cmNlX3RpdGxlIjoi6r+I7J2AIOydtOujqOyWtOynhOuLpCIsInNvdXJjZV9zdW1tYXJ5IjoiMjAwMuuFhCDtlZzsnbwg7JuU65Oc7Lu1IDTqsJUg7Iug7ZmU66W8IOyDgeynle2VmOuKlCDqta3rr7wg7Iqs66Gc6rG0Iiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMjAwMuuFhCDtlZzsnbwg7JuU65Oc7Lu17JeQ7IScIO2VnOq1rSDrjIDtkZztjIDsnbQg7Y+0656A65OcLCDtj6zrpbTtiKzqsIgsIOydtO2DiOumrOyVhCwg7Iqk7Y6Y7J247J2EIOyXsO2MjO2VmOupsCDslYTsi5zslYQg7LWc7LSI66GcIDTqsJXsl5Ag7Jik66W064qUIOqzvOygleyXkOyEnCDsnZHsm5Ag6rWs7Zi466GcIOyekOumrOyeoeydgCDrrLjqtazroZwsIOydtO2bhCDstpXqtazrpbwg64SY7Ja0IOyCrO2ajCDsoITrsJjsl5DshJwg7Z2s66ed7J2EIOucu+2VmOuKlCDrp5DroZwg7J247Jqp65CQ64ukLiIsInNvdXJjZV9vcmlnaW4iOiIyMDAy64WEIO2VnOydvCDsm5Trk5zsu7Ug7J2R7JuQIO2YhOyepeqzvCDrsKnshqEg7KSR6rOE7JeQ7IScIO2ZleyCsOuQnCDqtaztmLguIiwic291cmNlX3VzYWdlX25vdGUiOiLtnazrp53soIHsnbgg66mU7Iuc7KeA66W8IOyghO2VoCDrlYwg7J247Jqp7ZWY6riwIOyii+ydjCIsInNvdXJjZV9jYXV0aW9uIjoi7JeG7J2MIiwic291cmNlX2FsaWFzZXMiOlsi6r+I4piF7J2AIOydtOujqOyWtOynhOuLpCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLtj6zquLDtlZjsp4Ag66eILCDqv4jsnYAg7J2066Oo7Ja07KeE64ukIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuydtCDsiqzroZzqsbQg7JWE7KeB64+EIO2emOydtCDrkJzri6QifV0sImxvY2FsaXplZF9zbHVnIjoi5aSi44Gv44GL44Gq44GGIiwidGl0bGUiOiLlpKLjga/jgYvjgarjgYYiLCJzdW1tYXJ5IjoiMjAwMuW5tOaXpemfk+ODr+ODvOODq+ODieOCq+ODg+ODl+OBp+mfk+WbveS7o+ihqOOBjOODmeOCueODiDTjgbjpgLLjgpPjgaDlv6vpgLLmkoPjgpLosaHlvrTjgZnjgovlm73msJHnmoTjgarjgrnjg63jg7zjgqzjg7PjgIIiLCJkZXNjcmlwdGlvbiI6IjIwMDLlubTjga7ml6Xpn5Pjg6/jg7zjg6vjg4njgqvjg4Pjg5fjgafpn5Plm73ku6PooajjgYzjg53jg7zjg6njg7Pjg4njgIHjg53jg6vjg4jjgqzjg6vjgIHjgqTjgr/jg6rjgqLjgIHjgrnjg5rjgqTjg7PjgpLnoLTjgorjgIHjgqLjgrjjgqLli6LjgajjgZfjgabliJ3jgoHjgabjg5njgrnjg4g044Gr6YCy44KA6YGO56iL44Gn44CB44GT44Gu6KiA6JGJ44Gv5b+c5o+044Gu5o6b44GR5aOw44Go44GX44Gm5a6a552A44GX44Gf44CC44Gd44Gu5b6M44Gv44K144OD44Kr44O844Gr6ZmQ44KJ44Ga44CB5biM5pyb44KS6KGo44GZ6KiA6JGJ44Go44GX44Gm5byV55So44GV44KM44Gm44GE44KL44CCIiwib3JpZ2luIjoiMjAwMuW5tOaXpemfk+ODr+ODvOODq+ODieOCq+ODg+ODl+OBrumfk+WbveOBruW/nOaPtOS8muWgtOOChOODhuODrOODk+S4ree2meOBp+W6g+OBvuOBo+OBn+aOm+OBkeWjsOOAgiIsInVzYWdlX25vdGUiOiLluIzmnJvjgpLkvJ3jgYjjgZ/jgYTjgajjgY3jgavlvJXnlKjjgZfjgoTjgZnjgYTjgIIiLCJjYXV0aW9uIjoi54m544Gr5rOo5oSP54K544Gv44GC44KK44G+44Gb44KT44CCIiwiYWxpYXNlcyI6WyLlpKLjga/jgYvjgarjgYYiLCIyMDAy5bm044Ov44O844Or44OJ44Kr44OD44OX6Z+T5Zu944K544Ot44O844Ks44OzIiwi6r+I4piF7J2AIOydtOujqOyWtOynhOuLpCJdLCJ1c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi44OB44Oj44OD44OIIiwidGV4dCI6IuOBguOBjeOCieOCgeOBquOBhOOBp+OAgeWkouOBr+OBi+OBquOBhuOAgiJ9LHsic2l0dWF0aW9uIjoiU05T44Kz44Oh44Oz44OIIiwidGV4dCI6IuOBk+OBruOCueODreODvOOCrOODs+OBr+S7iuOBp+OCguWKm+OCkuOBj+OCjOOCi+OAgiJ9XSwicHJvdmlkZXIiOiJvcGVuYWkiLCJtb2RlbCI6ImdwdC01LjYtbHVuYSIsInByb21wdF92ZXJzaW9uIjoxfQ==', 'base64'), 'utf8')::jsonb
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

