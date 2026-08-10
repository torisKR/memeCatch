-- MemeCatch reviewable translation pack; not executed by this command.
-- Apply only after human review through the existing operator process.
-- locale=zh; slice=132; generated_at=2026-08-09T17:26:03.614Z

with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiZjlkYTdhMDMtMDFkZS00MmMzLThlMWMtYzA1YWYxZmNjZjZiIiwibG9jYWxlIjoiemgiLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTVUMTU6MzA6MDAuMTkxMzczKzAwOjAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiIxZWZjNWI3ZDY1Y2IwN2ExNGU4Y2IxZWI0NTQyOTA1M2M3YzhiMzE4MmE0NmE1ZDhhZWQ3Y2JiZjg0NDYxZGZmIiwic291cmNlX3RpdGxlIjoi7Yq4656E656E66CI66GcIO2KuOuehOuehOudvCIsInNvdXJjZV9zdW1tYXJ5Ijoi64KY7J207YKkIOyLoOuwnCDsi6DsnYAg7IS464uk66asIOyDgeyWtOqwgCDrk7HsnqXtlZjripQg7J207YOI66as7JWE7Ja0IO2Xm+yGjOumrCDrsIgiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiIyMDI164WEIDHsm5Qg7Yux7Yah7JeQ7IScIOuTseyepe2VnCAn7J207YOI66as7JWIIOu4jOugiOyduOuhrycg7LqQ66at7YSwIDHtmLjroZwsIOuCmOydtO2CpCDsmrTrj5ntmZTrpbwg7Iug7J2AIOyEuCDri6Trpqwg7IOB7Ja06rCAIOuTseyepe2VnOuLpC4g7KCA7ZKI7KeIIEFJIOyDneyEsSDsmIHsg4Hqs7wg7J2Y66+4IOyXhuuKlCDsnbTtg4jrpqzslYTslrQg6rCA7IKs6rCAIO2KueynleydtOupsCwg7Y+t6rKp6riw7JmAIOyVheyWtOqwgCDtlanss5Dsp4Qg7LqQ66at7YSwICfrtITrsJTrpbTrlJTroZwg7YGs66Gc7L2U65Sc66GcJ+yZgCDshLjtirjroZwg7Jyg7ZaJ7ZaI64ukLiAyMDI164WEIDPsm5Qg7KCEIOyEuOqzhOuhnCDtmZXsgrDrj7wg7ZWc6rWtIOumtOyKpMK37Ie87Lig7JeQ7ISc64+EIO2MqOufrOuUlOqwgCDsj5/slYTsoYzri6QuIiwic291cmNlX29yaWdpbiI6Iu2Lse2GoSDsgqzsmqnsnpDqsIAg7Jis66awIEFJIOyDneyEsSDsmIHsg4Hsl5DshJwg7Iuc7J6RLCAyMDI164WEIDPsm5Qg7IS46rOE7KCB7Jy866GcIO2ZleyCsCIsInNvdXJjZV91c2FnZV9ub3RlIjoiQUkg67CIwrfsnbTtg4jrpqzslYgg67iM66CI7J2466GvIOyWmOq4sO2VoCDrlYwiLCJzb3VyY2VfY2F1dGlvbiI6IuydmOuvuCDsl4bripQg7Zeb7IaM66as6528IOycoOy5mO2VmOuLpOuKlCDtj4nrj4Qg7J6I7J2MIiwic291cmNlX2FsaWFzZXMiOlsi7Yq4656E656E66CI66Gc7Yq4656E656E6528Iiwi7J207YOI66as7JWIIOu4jOugiOyduOuhryIsIu2LsO2LsO2LsCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOltdLCJsb2NhbGl6ZWRfc2x1ZyI6IuaEj+Wkp+WIqeiEkeiFkOS4ieiEmumyqOmxvOi/t+WboC10cmFsYWxlcm8tdHJhbGFsYSIsInRpdGxlIjoi5oSP5aSn5Yip6ISR6IWQ5LiJ6ISa6bKo6bG86L+35Zug77yaVHJhbGFsZXJvIFRyYWxhbGEiLCJzdW1tYXJ5Ijoi5LiA5Y+q56m/552A6ICQ5YWL6Z6L55qE5LiJ5p2h6IW/6bKo6bG855m75Zy655qE5oSP5aSn5Yip6K+t6IOh6KiA5Lmx6K+t5qKX44CCIiwiZGVzY3JpcHRpb24iOiLlroPmmK8gMjAyNSDlubQgMSDmnIjlnKggVGlrVG9rIOS4iuWHuueOsOeahOKAnOaEj+Wkp+WIqeiEkeiFkOKAneesrOS4gOWPt+inkuiJsu+8jOS4u+inkuaYr+S4gOWPquepv+edgOiAkOWFi+i/kOWKqOmei+eahOS4ieadoeiFv+myqOmxvOOAguS9jui0qOmHjyBBSSDnlJ/miJDop4bpopHlkozmr6vml6DmhI/kuYnnmoTmhI/lpKfliKnor63mrYzor43mmK/lhbbnibnlvoHvvJvlroPov5jkuI7igJzovbDngrjmnLrps4TpsbzigJ3ov5nkuIDnlLHovbDngrjmnLrlkozps4Tpsbznu5PlkIjogIzmiJDnmoTop5LoibLmiJDlpZfmtYHooYzjgIIyMDI1IOW5tCAzIOaciOaJqeaVo+WIsOWFqOeQg+WQju+8jOmfqeWbveeahCBSZWVscyDlkowgU2hvcnRzIOS5n+WHuueOsOS6huWkp+mHj+aooeS7v+S9nOWTgeOAgiIsIm9yaWdpbiI6Iui1t+a6kOS6jiBUaWtUb2sg55So5oi35LiK5Lyg55qEIEFJIOeUn+aIkOinhumike+8jOW5tuS6jiAyMDI1IOW5tCAzIOaciOWcqOWFqOeQg+S8oOaSreW8gOadpeOAgiIsInVzYWdlX25vdGUiOiLnlKjkuo7osIjorrogQUkg5qKX5oiW5oSP5aSn5Yip6ISR6IWQ44CCIiwiY2F1dGlvbiI6IueUseS6juWGheWuueaYr+avq+aXoOaEj+S5ieeahOiDoeiogOS5seivre+8jOS5n+acieS6uuinieW+l+Wug+W+iOW5vOeomuOAgiIsImFsaWFzZXMiOlsiVHJhbGFsZXJvIFRyYWxhbGEiLCLmhI/lpKfliKnohJHohZAiLCJUaXRpIFRpdGkiXSwidXNhZ2VfZXhhbXBsZXMiOltdLCJwcm92aWRlciI6Im9wZW5haSIsIm1vZGVsIjoiZ3B0LTUuNi1zb2wiLCJwcm9tcHRfdmVyc2lvbiI6MTF9', 'base64'), 'utf8')::jsonb
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
select count(*)::int as inserted_count from inserted;;
