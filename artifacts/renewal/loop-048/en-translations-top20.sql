-- EN meme_translations batch — loop-048, generated 2026-08-04.
-- Source: local MLX (mlx-community/Qwen2.5-14B-Instruct-4bit) via
-- scripts/translate-memes-mlx-linked.mjs's own requestMlxTranslation() /
-- buildAtomicInsertSql() (imported unmodified, never executed against DB here).
-- Candidates: top by trend_score among approved/limited memes with no existing
-- 'en' row, filtered through lib/content-depth.ts isIndexableMeme() — the same
-- gate the sitemap/pipeline already use. 18 of the requested 20 produced valid
-- output; 2 were rejected by the pipeline's own language-purity validator
-- (title is a short proper noun that is mostly/only Hangul — see
-- generation-skipped.txt in this directory for the 2 short_ids and reasons).
--
-- Each statement below is IDEMPOTENT and SELF-VALIDATING:
--   - 'on conflict (meme_id, locale) do nothing' — safe to re-run.
--   - the 'locked' CTE re-checks that the source meme is still
--     approved/limited AND every source field still matches the exact
--     snapshot that was translated (m.updated_at = source_updated_at, plus
--     per-field IS NOT DISTINCT FROM checks). If the Korean source changed
--     since this file was generated, that row inserts nothing.
--   - status is inserted as 'machine' (matches the DB check constraint and
--     mark_meme_translations_stale() invariant: reviewed_at/reviewed_by must
--     both be null unless status='reviewed'). A human must review and flip
--     status to 'reviewed' (with reviewed_at/reviewed_by set) before the
--     meme_translations_public_read RLS policy will ever serve these rows to
--     anon — see "how to apply" in the loop report.
--
-- Run with: supabase db query --linked --file artifacts/renewal/loop-048/en-translations-top20.sql
-- (or paste into the SQL editor). Each statement returns inserted_count (0 or 1).

-- 7jtq8bwe  trend_score=335.98  따름 챌린지
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiMDk1OWRlMjItMjZlMC00YTg0LTg3OWEtMjBhYjI4MDRkZWI1IiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI1MGQ4YzMzYzM1Y2NiNjBmOWNmZmM1YmNhYzIyNGQzMjYyZTFmNjkzMzJkOTgwM2MyZDNkYmY0NTBkZjJlMWRiIiwic291cmNlX3RpdGxlIjoi65Sw66aEIOyxjOumsOyngCIsInNvdXJjZV9zdW1tYXJ5Ijoi7Yis7Ja07IqkICfrhJAg65Sw65286rCAJyDtm4TroLTqtazsl5Ag66ee7LaYIOyKpO2FnSDrjITsiqQg7LGM66aw7KeAIiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMjAyNuuFhCA07JuUIOuwnOunpOuQnCDtiKzslrTsiqQg66+464uIIDXsp5Eg7YOA7J207YuA6rOhICfrhJAg65Sw65286rCAKFlvdSwgWW91KSfsnZgg7KSR64+F7KCB7J24ICdEZGEtcnVtJyDtm4TroLTqtazsl5Ag66ee7LaYIOuMhOyKpCDssYzrprDsp4Dri6QuIOyii+yVhO2VmOuKlCDsg4HrjIDrpbwg65Sw65286rCA6rOgIOyLtuydgCDrp4jsnYzsnYQg66as65Oc66+47Lus7ZWcIOyKpO2FneycvOuhnCDtkZztmITtlojsnLzrqbAsIOyEuOu4kO2LtCDsirnqtIDCt05DVCBXSVNIwrdFWE8g7Lm07J20IOuTsSDri6TsiJgg7JWE7J2064+M7J20IOywuOyXrO2VmOupsCDtmZTsoJzrpbwg66qo7JWY64ukLiDsmIYg7IKs656M7J2YIOuPmeyekeydhCDrlLDrnbwg7ZWY64qUIOydkeyaqSDrsoTsoITrj4Qg7Jyg7ZaJ7ZaI64ukLiIsInNvdXJjZV9vcmlnaW4iOiIyMDI264WEIDTsm5Qg7Yis7Ja07IqkICdOTyBUUkFHRURZJyDrsJzrp6TsmYAg7ZWo6ruYIOyLnOyekSIsInNvdXJjZV91c2FnZV9ub3RlIjoi7JWE7J2064+MIOyxjOumsOyngCwg7Luk67KE64yE7IqkIOy9mO2FkOy4oOuhnCDsgqzsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi7Yis7Ja07IqkIOuUsOumhCDssYzrprDsp4AiLCLrhJAg65Sw65286rCAIOyxjOumsOyngCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOm51bGwsImxvY2FsaXplZF9zbHVnIjoiZGRhLXJ1bS1jaGFsbGVuZ2UiLCJ0aXRsZSI6IkRkYS1ydW0gQ2hhbGxlbmdlIiwic3VtbWFyeSI6IkEgZGFuY2UgY2hhbGxlbmdlIHNldCB0byB0aGUgY2F0Y2h5ICdEZGEtcnVtJyBjaG9ydXMgb2YgdGhlIHNvbmcgJ1lvdSwgWW91JyBieSBUT08iLCJkZXNjcmlwdGlvbiI6IlRoZSAnRGRhLXJ1bSBDaGFsbGVuZ2UnIGlzIGEgZGFuY2UgY2hhbGxlbmdlIHNldCB0byB0aGUgaW5mZWN0aW91cyAnRGRhLXJ1bScgY2hvcnVzIG9mIFRPTydzIHRpdGxlIHRyYWNrICdZb3UsIFlvdScgZnJvbSB0aGVpciBtaW5pIGFsYnVtICdOTyBUUkFHRURZJyByZWxlYXNlZCBpbiBBcHJpbCAyMDI2LiBUaGUgY2hhbGxlbmdlIGV4cHJlc3NlcyB0aGUgZGVzaXJlIHRvIGZvbGxvdyBzb21lb25lIHlvdSBsaWtlIHRocm91Z2ggcmh5dGhtaWMgZGFuY2Ugc3RlcHMuIEl0IGdhaW5lZCBwb3B1bGFyaXR5IHdpdGggdGhlIHBhcnRpY2lwYXRpb24gb2Ygc2V2ZXJhbCBLLXBvcCBpZG9scyBzdWNoIGFzIFNldW5nd29uIGZyb20gU0VWRU5URUVOLCBOQ1QgV0lTSCwgYW5kIEthaSBmcm9tIEVYTy4gQW4gYWRhcHRhdGlvbiBvZiB0aGUgY2hhbGxlbmdlIHdoZXJlIHBhcnRpY2lwYW50cyBtaW1pYyB0aGUgYWN0aW9ucyBvZiB0aG9zZSBhcm91bmQgdGhlbSBhbHNvIGJlY2FtZSBwb3B1bGFyLiIsIm9yaWdpbiI6IlN0YXJ0ZWQgd2l0aCB0aGUgcmVsZWFzZSBvZiBUT08ncyAnTk8gVFJBR0VEWScgaW4gQXByaWwgMjAyNiIsInVzYWdlX25vdGUiOiJVc2VkIGFzIGlkb2wgY2hhbGxlbmdlIGNvbnRlbnQgYW5kIGNvdmVyIGRhbmNlIHZpZGVvcyIsImNhdXRpb24iOm51bGwsImFsaWFzZXMiOlsiVG91cnVzIEZvbGxvdyBDaGFsbGVuZ2UiLCJGb2xsb3cgWW91IENoYWxsZW5nZSJdLCJ1c2FnZV9leGFtcGxlcyI6W10sIm1vZGVsIjoibWx4LWNvbW11bml0eS9Rd2VuMi41LTE0Qi1JbnN0cnVjdC00Yml0In0=', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- g76rc5fs  trend_score=335.98  에픽하이 Love Love Love 챌린지
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiZjNiY2YzNjktOTM3Yy00NjVkLWJjOTQtOTU3MDY5YTJlZGRjIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiIwMjAyNWNmOTZhZDE0ZDI0ZDc5NjQ5MGJhZjUwZDk2NGI0MGZlZjdlYmM4ZGIxMjU3YTJlZTYzZTZhMGEyM2RmIiwic291cmNlX3RpdGxlIjoi7JeQ7ZS97ZWY7J20IExvdmUgTG92ZSBMb3ZlIOyxjOumsOyngCIsInNvdXJjZV9zdW1tYXJ5IjoiMjAwN+uFhCDrsJzrp6TrkJwg7JeQ7ZS97ZWY7J207J2YIOqzoeydtCDsnpDsl7DrsJzsg53soIEg7IiP7Y+8IOyxjOumsOyngOuhnCAxOeuFhCDrp4zsl5Ag7Jet7KO87ZaJ7ZWcIOyCrOuhgC4iLCJzb3VyY2VfZGVzY3JpcHRpb24iOiLsl5DtlL3tlZjsnbTqsIAgMjAwN+uFhCDrsJzrp6TtlZwgJ0xvdmUgTG92ZSBMb3ZlJ+ydmCDtm4TroLTsl5Ag66ee7LawIO2VmO2KuOulvCDqt7jrpqzripQg6rCE64uo7ZWcIOyViOustOqwgCDti7HthqHCt+umtOyKpMK37Ie87Lig7JeQ7IScIOyekOyXsOyKpOufveqyjCDsg53qsqjrgpjrqbAgMjAyNuuFhCDstIgg7J2M7JuQIOywqO2KuOulvCDsl63so7ztlontlojri6QuIOqzoeydhCDrp4zrk6Qg64u57IucIOyxjOumsOyngOulvCDsl7zrkZDsl5Ag65GQ7KeAIOyViuyVmOuLpOuKlCDsoJDsl5DshJwg7ZmU7KCc6rCAIOuQkOqzoCwgWuyEuOuMgOyXkOqyjOuKlCDsg4jroZzsmrQg6rOh7Jy866GcLCDquLDsobQg7Yys7JeQ6rKM64qUIOy2lOyWteycvOuhnCDri6TqsIDqsJTri6QuIiwic291cmNlX29yaWdpbiI6IjIwMDfrhYQg67Cc66ek65CcIOyXkO2Uve2VmOydtCDqs6HsnbQgMjAyNuuFhCDsiI/tj7wg7LGM66aw7KeA66GcIOyXreyjvO2WiSIsInNvdXJjZV91c2FnZV9ub3RlIjoi7JibIOuqheqzoeydhCDsg4jroa3qsowg7LGM66aw7KeA66GcIOymkOq4uCDrlYwg7IKs7JqpIiwic291cmNlX2NhdXRpb24iOm51bGwsInNvdXJjZV9hbGlhc2VzIjpbXSwic291cmNlX3VzYWdlX2V4YW1wbGVzIjpudWxsLCJsb2NhbGl6ZWRfc2x1ZyI6ImVwaWNoaWdoLWxvdmUtbG92ZS1sb3ZlLWNoYWxsZW5nZSIsInRpdGxlIjoiRXBpY0hpZ2ggTG92ZSBMb3ZlIExvdmUgQ2hhbGxlbmdlIiwic3VtbWFyeSI6IkFuIG9yZ2FuaWMgc2hvcnQtZm9ybSBkYW5jZSBjaGFsbGVuZ2UgYmFzZWQgb24gdGhlIDIwMDcgc29uZyAnTG92ZSBMb3ZlIExvdmUnIGJ5IEVwaWNIaWdoIHJlc3VyZmFjZWQgaW4gMjAyNiwgbGVhZGluZyB0byB0aGUgc29uZydzIHVuZXhwZWN0ZWQgY2hhcnQgc3VjY2Vzcy4iLCJkZXNjcmlwdGlvbiI6IkluIDIwMjYsIGEgc2ltcGxlIGRhbmNlIHJvdXRpbmUgaW52b2x2aW5nIGRyYXdpbmcgaGVhcnRzIHRvIHRoZSBjaG9ydXMgb2YgRXBpY0hpZ2gncyAyMDA3IHNvbmcgJ0xvdmUgTG92ZSBMb3ZlJyBzcG9udGFuZW91c2x5IGVtZXJnZWQgb24gVGlrVG9rLCBSZWVscywgYW5kIFNob3J0cy4gVGhpcyBjaGFsbGVuZ2UgbGVkIHRvIHRoZSBzb25nJ3MgdW5leHBlY3RlZCByZXN1cmdlbmNlIG9uIG11c2ljIGNoYXJ0cy4gVGhlIG5vdmVsdHkgb2YgdGhpcyBjaGFsbGVuZ2UsIGdpdmVuIHRoYXQgdGhlIHNvbmcgd2FzIG5vdCBvcmlnaW5hbGx5IGludGVuZGVkIGZvciBzdWNoIHB1cnBvc2VzLCBnYXJuZXJlZCBzaWduaWZpY2FudCBhdHRlbnRpb24uIEZvciB0aGUgWiBnZW5lcmF0aW9uLCBpdCB3YXMgYSBuZXcgZGlzY292ZXJ5LCB3aGlsZSBmb3IgZXhpc3RpbmcgZmFucywgaXQgZXZva2VkIG5vc3RhbGdpYS4iLCJvcmlnaW4iOiJFcGljSGlnaCdzIDIwMDcgc29uZyAnTG92ZSBMb3ZlIExvdmUnIGJlY2FtZSBhIHZpcmFsIGRhbmNlIGNoYWxsZW5nZSBpbiAyMDI2IiwidXNhZ2Vfbm90ZSI6IlRoaXMgbWVtZSBpbnZvbHZlcyB1c2luZyBhbiBvbGQgaGl0IHNvbmcgaW4gYSBuZXcgZGFuY2UgY2hhbGxlbmdlIGZvcm1hdC4iLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbXSwidXNhZ2VfZXhhbXBsZXMiOltdLCJtb2RlbCI6Im1seC1jb21tdW5pdHkvUXdlbjIuNS0xNEItSW5zdHJ1Y3QtNGJpdCJ9', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- ra86attn  trend_score=335.25  봉숭아학당 그까이꺼 대충
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiNTJjMzgxYzUtODAwYi00NGRiLWIwNGItOTcxNjUzNjIwY2U1IiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI4MDZmMTEwYWRkNTVkYmE0NWMzMjg5NjI0NTMwMDdkMjgxZDM1M2UzMGU2ZDM5NzQ2OTQ3ZDE5YjFjZGY4ODYwIiwic291cmNlX3RpdGxlIjoi67SJ7Iit7JWE7ZWZ64u5IOq3uOq5jOydtOq6vCDrjIDstqkiLCJzb3VyY2Vfc3VtbWFyeSI6IuyepeuPmeuvvOydmCAyMDA064WEIOqyveu5hCDsupDrpq3thLAg7Jyg7ZaJ7Ja0Iiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMjAwNOuFhCDrp5DrtoDthLAg6rCc6re47L2Y7ISc7Yq4IOu0ieyIreyVhO2VmeuLueydmCDqsr3ruYQg7Jet7J2EIOunoeydgCDsnqXrj5nrr7zsnbQgJ+q3uOq5jOydtOq6vCDqt7jrg6Ug662QIOuMgH7stql+J+ydtOudvOuKlCDsnKDtlonslrTroZwg7Ja066Ck7Jq0IOydvOuPhCDqsITri6jtnogg7ZW06rKw65Cc64uk64qUIOychO2KuOulvCDshKDrs7TsmIDri6QuIiwic291cmNlX29yaWdpbiI6IjIwMDTrhYQgMTHsm5Qg66eQ67aA7YSwIDIwMDbrhYQgNOyblOq5jOyngCDrsKnsmIHrkJwgS0JTIDzqsJzqt7jsvZjshJztirg+ICfrtInsiK3slYQg7ZWZ64u5J+ydmCDqsr3ruYQg7JWE7KCA7JSoIOy6kOumre2EsOyXkOyEnCDrgpjsmKgg7Jyg7ZaJ7Ja064ukLiAyMDA064WEIEtCUyDqs7XssYQgMTnquLDroZwg642w67eU7ZWcIOyepeuPmeuvvOydtCDstqnssq3rj4Qg7IKs7Yis66as66W8IOyTsOuKlCDqsr3ruYTsm5Ag7Jet7J2EIOunoeyVhCwg7IiY7JeFIOuPhOykkSDrtojskaUg65Ox7J6l7ZW0IO2XiO2SjeydhCDripjslrTrhpPsnYAg65KkIFwi6re46rmM7J206rq8IOq3uOuDpSDrrZAg64yAfn7stqkhXCLsnbTrnbzqs6Ag66eI66y066as7ZWY64qUIO2MqO2EtOycvOuhnCDsm4PsnYzsnYQg7KSs64ukLiDsnbQg7Jyg7ZaJ7Ja064qUIOuNsOu3lOyZgCDrj5nsi5zsl5Ag7J6l64+Z66+87J2YIOydtOumhOydhCDrjIDspJHsl5Dqsowg6rCB7J247Iuc7Lyw6rOgLCDsnbTtm4Qg64uk7JaR7ZWcIOuwqeyGoeyXkOyEnCDsnbjsmqnCt+2MqOufrOuUlOuQkOuLpC4iLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6IuyWtOugpOyatCDsnbzsnYQg6rCA67ON6rKMIOuEmOq4uCDrlYwg7IKs7JqpIiwic291cmNlX2NhdXRpb24iOm51bGwsInNvdXJjZV9hbGlhc2VzIjpbIuq3uOq5jOydtOq6vCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOm51bGwsImxvY2FsaXplZF9zbHVnIjoiYm9uZ3N1bmdhYWhha2RhbmctZ2V1a2thaWtrZW8tZGFlY2h1bmciLCJ0aXRsZSI6IkJvbmdTdW5nQWFIYWtEYW5nIEdldWtLYWlLa2VvIERhZUNodW5nIiwic3VtbWFyeSI6IkEgcG9wdWxhciBjYXRjaHBocmFzZSBmcm9tIGEgS29yZWFuIHNrZXRjaCBjb21lZHkgY2hhcmFjdGVyIGluIDIwMDQiLCJkZXNjcmlwdGlvbiI6IkluIDIwMDQsIEphbmcgRG9uZy1taW4sIGEgY29tZWRpYW4sIHBsYXllZCBhIGd1YXJkIGNoYXJhY3RlciBpbiB0aGUgc2tldGNoIGNvbWVkeSAnQm9uZ1N1bmdBYUhha0RhbmcnIG9uIEtCUy4gSGUgdXNlZCB0aGUgcGhyYXNlICdHZXVrS2FpS2tlbyBqdXN0IHdoYXQsIHJvdWdobHknIHRvIGNvbnZleSB0aGUgaWRlYSB0aGF0IGV2ZW4gZGlmZmljdWx0IHRhc2tzIGNhbiBiZSBlYXNpbHkgcmVzb2x2ZWQgd2l0aCBhIGxpZ2h0LWhlYXJ0ZWQgYXBwcm9hY2guIFRoaXMgY2F0Y2hwaHJhc2UgYmVjYW1lIHdpZGVseSByZWNvZ25pemVkIGFuZCBoZWxwZWQgZXN0YWJsaXNoIEphbmcgRG9uZy1taW4ncyBuYW1lIGluIHRoZSBwdWJsaWMgZXllLiIsIm9yaWdpbiI6IlRoaXMgbWVtZSBvcmlnaW5hdGVkIGZyb20gYSBza2V0Y2ggY29tZWR5IGNoYXJhY3RlciBuYW1lZCAnQm9uZ1N1bmdBYUhha0RhbmcnIG9uIEtCUydzICdHYWcgQ29uY2VydCcgaW4gbGF0ZSAyMDA0LiBKYW5nIERvbmctbWluLCBhIGNvbWVkaWFuIHdobyBkZWJ1dGVkIGluIDIwMDQgYXMgcGFydCBvZiBLQlMncyAxOXRoIHJlY3J1aXRtZW50IGNsYXNzLCBwb3J0cmF5ZWQgYSBndWFyZCBjaGFyYWN0ZXIgd2hvIHdvdWxkIHN1ZGRlbmx5IGFwcGVhciBkdXJpbmcgY2xhc3NlcyBhbmQgdGVsbCB0YWxsIHRhbGVzIGJlZm9yZSBjb25jbHVkaW5nIHdpdGggdGhlIHBocmFzZSAnR2V1a0thaUtrZW8ganVzdCB3aGF0LCByb3VnaGx5LicgVGhpcyBjYXRjaHBocmFzZSBiZWNhbWUgcG9wdWxhciBhbmQgd2FzIGxhdGVyIHJlZmVyZW5jZWQgYW5kIHBhcm9kaWVkIGluIHZhcmlvdXMgYnJvYWRjYXN0cy4iLCJ1c2FnZV9ub3RlIjoiVXNlZCB0byBleHByZXNzIHRoYXQgYSBkaWZmaWN1bHQgdGFzayBjYW4gYmUgaGFuZGxlZCB3aXRoIGEgY2FzdWFsIG9yIHJlbGF4ZWQgYXR0aXR1ZGUiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIkdldWtLYWlLa2VvIl0sInVzYWdlX2V4YW1wbGVzIjpbXSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- 9ctd73f3  trend_score=324.98  코리안특급
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiYWRkNjMyYjktZDBmMy00MjU1LTkwOGMtN2E5OWMwY2QwN2ZlIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI2MGE3MmJjMGRmM2U4ZTkxZWJhN2UwZjUyYTk2YmY3NjdiNWVhYTQ2YzAxYmY4ZTkzNDY3YTk2MjJlNjdjYmJkIiwic291cmNlX3RpdGxlIjoi7L2U66as7JWI7Yq56riJIiwic291cmNlX3N1bW1hcnkiOiIxOTk064WEIOuwleywrO2YuCDrqZTsnbTsoIDrpqzqt7gg642w67eUIO2bhCDslrvsnYAg67OE66qFIiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMTk5NOuFhCDtlZzqta3snbgg7LWc7LSI66GcIExBIOuLpOyggOyKpOyXkOyEnCDrqZTsnbTsoIDrpqzqt7jsl5Ag642w67eU7ZWcIOuwleywrO2YuOqwgCDqsJXsho3qtawg7Yis7IiYIOuGgOuegCDrnbzsnbTslrjsnZgg67OE66qFICdSeWFuIEV4cHJlc3Mn7JeQ7IScIOywqeyViO2VtCDslrvsnYAg67OE66qF7Jy866GcLCDsnbTtm4Qg7ZWc6rWtIOyKpO2PrOy4oCDsiqTtg4Drpbwg67aA66W064qUIOq0gOyaqeyggSDsiJjsi53slrTroZwg64SQ66asIOyTsOydtOqyjCDrkJjsl4jri6QuIiwic291cmNlX29yaWdpbiI6IjE5OTTrhYQg67CV7LCs7Zi4IExBIOuLpOyggOyKpCDrqZTsnbTsoIDrpqzqt7gg642w67eUIOq0gOugqCDrs7Trj4QiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6Iu2VnOq1rSDsiqTtj6zsuKAg7Iqk7YOA7J2YIO2VtOyZuCDsp4Tstpwg7ISx6rO17J2EIOydtOyVvOq4sO2VoCDrlYwg7J247JqpIiwic291cmNlX2NhdXRpb24iOm51bGwsInNvdXJjZV9hbGlhc2VzIjpbIuuwleywrO2YuCDrs4TrqoUiXSwic291cmNlX3VzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiLsubTthqEiLCJ0ZXh0Ijoi7ZW07Jm47JeQ7IScIOyggOugh+qyjCDsnpjtlZjri6Tri4gg7JmE7KCEIOy9lOumrOyViO2Kueq4ieydtOuEpCJ9LHsic2l0dWF0aW9uIjoiU05TIOuMk+q4gCIsInRleHQiOiLsnbQg7Zmc7JW9IOy9lOumrOyViO2Kueq4ieq4ieydtOuLpCJ9XSwibG9jYWxpemVkX3NsdWciOiJrb3JlYW4tZXhwcmVzcyIsInRpdGxlIjoiS29yZWFuIEV4cHJlc3MiLCJzdW1tYXJ5IjoiQSBuaWNrbmFtZSBnaXZlbiB0byBQYXJrIENoYW4taG8gYWZ0ZXIgaGlzIGRlYnV0IGluIE1ham9yIExlYWd1ZSBCYXNlYmFsbCBpbiAxOTk0IiwiZGVzY3JpcHRpb24iOiJQYXJrIENoYW4taG8sIHRoZSBmaXJzdCBLb3JlYW4gcGxheWVyIHRvIGRlYnV0IGluIE1ham9yIExlYWd1ZSBCYXNlYmFsbCB3aXRoIHRoZSBMQSBEb2RnZXJzIGluIDE5OTQsIGVhcm5lZCB0aGUgbmlja25hbWUgJ0tvcmVhbiBFeHByZXNzJyBpbnNwaXJlZCBieSBOb2xhbiBSeWFuJ3MgJ1J5YW4gRXhwcmVzcycuIFRoaXMgdGVybSBoYXMgc2luY2UgYmVjb21lIGEgY29tbW9uIHdheSB0byByZWZlciB0byBzdWNjZXNzZnVsIEtvcmVhbiBzcG9ydHMgc3RhcnMgYWJyb2FkLiIsIm9yaWdpbiI6IjE5OTQgUGFyayBDaGFuLWhvJ3MgZGVidXQgd2l0aCB0aGUgTEEgRG9kZ2VycyBpbiBNYWpvciBMZWFndWUgQmFzZWJhbGwiLCJ1c2FnZV9ub3RlIjoiVXNlZCB3aGVuIGRpc2N1c3NpbmcgdGhlIHN1Y2Nlc3Mgb2YgS29yZWFuIHNwb3J0cyBzdGFycyBhYnJvYWQiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIlBhcmsgQ2hhbi1obydzIG5pY2tuYW1lIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJLYWthb1RhbGsiLCJ0ZXh0IjoiRG9pbmcgc28gd2VsbCBvdmVyc2VhcywgeW91J3JlIHRydWx5IGEgS29yZWFuIEV4cHJlc3MifSx7InNpdHVhdGlvbiI6IlNOUyBjb21tZW50IiwidGV4dCI6IlRoaXMgcGVyZm9ybWFuY2UgaXMgb24gcGFyIHdpdGggYSBLb3JlYW4gRXhwcmVzcyJ9XSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- 6bgyw6gb  trend_score=324.98  몬주익의 영웅
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiYjZjYmYxZjUtZTY3Yi00MDE4LTkxMTYtMGIzN2E5Yzc5ZjJhIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI4YTMwYzU2M2I3OGY3ZjU1YjUwY2FiZDZjYTgyOGRjZGU2OWFmNTY0MjJiNTgxNjYxY2QwMWNiYWRlZjY2YzI1Iiwic291cmNlX3RpdGxlIjoi66qs7KO87J217J2YIOyYgeybhSIsInNvdXJjZV9zdW1tYXJ5IjoiMTk5MuuFhCDrsJTrpbTshYDroZzrgpgg7Jis66a87ZS9IOuniOudvO2GpOyXkOyEnCDtmansmIHsobDqsIAg7Ja77J2AIOuzhOuqhSIsInNvdXJjZV9kZXNjcmlwdGlvbiI6IjE5OTLrhYQg67CU66W07IWA66Gc64KYIOyYrOumvO2UvSDrp4jrnbzthqTsl5DshJwg7IaQ6riw7KCVIOydtO2bhCA1NuuFhCDrp4zsl5Ag6riI66mU64us7J2EIOuUtCDtmansmIHsobDqsIAg6rKw7Iq57ISgIOyVniDquInqsr3sgqwgJ+uqrOyjvOydtSDslrjrjZUn7JeQ7IScIOyXreyghCwg66eI7KeA66eJIOyKpO2NvO2KuOulvCDtjrzsuZjqs6Ag7JOw65+s7KeEIOyepeuptOyXkOyEnCDsnKDrnpjtlZwg67OE66qF7J2064ukLiDsp4DquIjrj4Qg6re57KCB7J24IOuniOyngOuniSDrkqTsp5HquLAg7IOB7Zmp7J2EIO2RnO2YhO2VoCDrlYwg7J247Jqp65Cc64ukLiIsInNvdXJjZV9vcmlnaW4iOiIxOTky64WEIDjsm5QgOeydvCDrsJTrpbTshYDroZzrgpgg7Jis66a87ZS9IOuniOudvO2GpCDspJHqs4Qg67Cp7IahIiwic291cmNlX3VzYWdlX25vdGUiOiLrp4ntjJAg64yA7Jet7KCE6re57J2064KYIO2IrO2YvOydhCDsnbTslbzquLDtlaAg65WMIOyduOyaqSIsInNvdXJjZV9jYXV0aW9uIjpudWxsLCJzb3VyY2VfYWxpYXNlcyI6WyLtmansmIHsobAiLCLrqqzso7zsnbUg7Ja4642VIl0sInNvdXJjZV91c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi7Lm07YahIiwidGV4dCI6Iuunie2MkOyXkCDsmYTsoIQg65Kk7KeR7JeI64SkLCDrqqzso7zsnbXsnZjsmIHsm4XquInsnbTri6QifSx7InNpdHVhdGlvbiI6IlNOUyDrjJPquIAiLCJ0ZXh0Ijoi7J20IO2IrO2YvCDrqqzso7zsnbUg7Ja4642VIOyerO2YhOydtOuLpCJ9XSwibG9jYWxpemVkX3NsdWciOiJtb25qdWlrLXMtaGVybyIsInRpdGxlIjoiTW9uanVpaydzIEhlcm8iLCJzdW1tYXJ5IjoiQSBuaWNrbmFtZSBnaXZlbiB0byBId2FuZyBZb3VuZy1qbyBhZnRlciBoaXMgZHJhbWF0aWMgdmljdG9yeSBpbiB0aGUgMTk5MiBCYXJjZWxvbmEgT2x5bXBpYyBNYXJhdGhvbiIsImRlc2NyaXB0aW9uIjoiSHdhbmcgWW91bmctam8gZWFybmVkIHRoZSBuaWNrbmFtZSAnTW9uanVpaydzIEhlcm8nIGFmdGVyIHdpbm5pbmcgdGhlIGdvbGQgbWVkYWwgaW4gdGhlIDE5OTIgQmFyY2Vsb25hIE9seW1waWMgTWFyYXRob24sIDU2IHllYXJzIGFmdGVyIFNvaG4gS2VlLWNodW5nLiBUaGUgbmlja25hbWUgY29tZXMgZnJvbSBoaXMgZmluYWwgc3ByaW50IGFuZCBjb2xsYXBzZSBhdCB0aGUgJ01vbmp1aWsgSGlsbCcgbmVhciB0aGUgZmluaXNoIGxpbmUsIHN5bWJvbGl6aW5nIGEgZHJhbWF0aWMgbGFzdC1taW51dGUgY29tZWJhY2suIEl0IGlzIG5vdyB1c2VkIHRvIGRlc2NyaWJlIGFueSBzaXR1YXRpb24gd2hlcmUgc29tZW9uZSBtYWtlcyBhIGRyYW1hdGljIGxhc3QtbWludXRlIGNvbWViYWNrIG9yIHNob3dzIGV4Y2VwdGlvbmFsIGVmZm9ydC4iLCJvcmlnaW4iOiJCcm9hZGNhc3Qgb2YgdGhlIDE5OTIgQmFyY2Vsb25hIE9seW1waWMgTWFyYXRob24gb24gQXVndXN0IDksIDE5OTIiLCJ1c2FnZV9ub3RlIjoiVXNlZCB0byBkZXNjcmliZSBsYXN0LW1pbnV0ZSBjb21lYmFja3Mgb3IgZGlzcGxheXMgb2YgZXhjZXB0aW9uYWwgZWZmb3J0IiwiY2F1dGlvbiI6bnVsbCwiYWxpYXNlcyI6WyJId2FuZyBZb3VuZy1qbyIsIk1vbmp1aWsgSGlsbCJdLCJ1c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoiS2FrYW9UYWxrIiwidGV4dCI6IkhlIGNvbXBsZXRlbHkgdHVybmVkIHRoZSB0YWJsZXMgYXQgdGhlIGxhc3QgbW9tZW50LCBpdCdzIE1vbmp1aWsncyBIZXJvIGxldmVsLiJ9LHsic2l0dWF0aW9uIjoiU05TIGNvbW1lbnQiLCJ0ZXh0IjoiVGhpcyBsZXZlbCBvZiBlZmZvcnQgaXMgcmVjcmVhdGluZyB0aGUgTW9uanVpayBIaWxsLiJ9XSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- knk2hsye  trend_score=324.26  우정의 무대 그리운 어머니
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiZDVmYmJjZmYtODA1YS00MTQxLWIyMDMtNjEwOWQyMTgyM2U5IiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI5ZjA1MjZkOTEzNDc3MzI2ZWUxY2U4MGRmMGZmYjQzODc0MjBkNTY3NjdiZjAwNTdmOGFmMzk5MGUyZmQ0N2JmIiwic291cmNlX3RpdGxlIjoi7Jqw7KCV7J2YIOustOuMgCDqt7jrpqzsmrQg7Ja066i464uIIiwic291cmNlX3N1bW1hcnkiOiLqtbDrtoDrjIAg7JyE66y46rO17Jew7JeQ7IScIOyWtOuouOuLiOyZgCDslYTrk6TsnbQg7IOB67SJ7ZWY64qUIOuIiOusvCDsvZTrhIgiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiIxOTkw64WEIDfsm5TrtoDthLAgS0JTICfsmrDsoJXsnZgg66y064yAJ+ydmCDrp4jsp4Drp4kg7Iic7ISc66GcIOyCveyeheqzoSAn6re466as7Jq0IOyWtOuouOuLiCfqsIAg7Z2Q66W066mwIOq3uOumrOyatCDsnbTrpoTsnZgg7Ja066i464uI6rCAIOustOuMgOuhnCDqsbjslrTrgpjsmYAg7JWE65Ok6rO8IOq3ueyggeycvOuhnCDsg4HrtIntlZjripQg7J6l66m07J20IOuwqeyGoeuQoCDrlYzrp4jri6Qg7Iuc7LKt7J6Q65Ok7J2EIOyauOuguOuLpC4g7KeA6riI64+EICfsl4Trp4jqsIAg67O06rOg7ZSMIOuVjCcg64+E7J6F67aA64qUIOy2lOyWteydmCDsg4Hsp5XsnLzroZwg7YG066a97ZmU64+8IOyerOyDneuQnOuLpC4iLCJzb3VyY2Vfb3JpZ2luIjoiS0JTICfsmrDsoJXsnZgg66y064yAJyDsvZTrhIgoMTk5MH4xOTkw64WE64yAKSIsInNvdXJjZV91c2FnZV9ub3RlIjoi6rCQ64+Z7KCB7J24IOyerO2ajCDsnqXrqbTsnYQg7J207JW86riw7ZWgIOuVjCDruYTsnKDroZwg7J247JqpIiwic291cmNlX2NhdXRpb24iOm51bGwsInNvdXJjZV9hbGlhc2VzIjpbIuq3uOumrOyatCDslrTrqLjri4giLCLsl4Trp4jqsIAg67O06rOg7ZSMIOuVjCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLsnbQg7IOB67SJIOyepeuptCDsmYTsoIQg7Jqw7KCV7J2Y66y064yA6riJIOuIiOusvOydtOuLpCJ9LHsic2l0dWF0aW9uIjoiU05TIOuMk+q4gCIsInRleHQiOiLqt7jrpqzsmrQg7Ja066i464uIIOuCmOyYpOuLiOq5jCDriIjrrLwg7LC46riwIO2emOuTnOuEpCJ9XSwibG9jYWxpemVkX3NsdWciOiJ1anVuZ3VpLW11ZG8tZ3dpd29uc2FlIiwidGl0bGUiOiJVanVuZ3VpIE11ZG8gR3dpd29uc2FlIiwic3VtbWFyeSI6IkEgdG91Y2hpbmcgcmV1bmlvbiBzY2VuZSBmcm9tIGEgbWlsaXRhcnnmhbDpl67mvJTlh7osIHdoZXJlIGEgc29sZGllciBtZWV0cyBoaXMgbW90aGVyIG9uIHN0YWdlIiwiZGVzY3JpcHRpb24iOiJGcm9tIEp1bHkgMTk5MCB0byB0aGUgMTk5MHMsIHRoZSBmaW5hbCBzZWdtZW50IG9mIEtCUydzICdVanVuZ3VpIE11ZG8nIGZlYXR1cmVkIGEgc29uZyBjYWxsZWQgJ0d3aXdvbnNhZScgKE1vdGhlciBJIE1pc3MpLCBkdXJpbmcgd2hpY2ggYSBtb3RoZXIgd291bGQgd2FsayBvbnRvIHRoZSBzdGFnZSB0byByZXVuaXRlIHdpdGggaGVyIHNvbiwgYnJpbmdpbmcgdmlld2VycyB0byB0ZWFycy4gVG8gdGhpcyBkYXksIHRoZSBvcGVuaW5nIGxpbmVzIG9mICdHd2l3b25zYWUnIGFyZSBzdGlsbCB1c2VkIGFzIGEgbm9zdGFsZ2ljIHN5bWJvbCBhbmQgYXJlIG9mdGVuIGNsaXBwZWQgYW5kIHNoYXJlZC4iLCJvcmlnaW4iOiJLQlMgJ1VqdW5ndWkgTXVkbycgc2VnbWVudCAoMTk5MC0xOTkwcykiLCJ1c2FnZV9ub3RlIjoiVXNlZCBhcyBhIG1ldGFwaG9yIGZvciBlbW90aW9uYWwgcmV1bmlvbnMiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIkd3aXdvbnNhZSIsIkVvbW1hLWdhIEJvZ28tcHVsIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJLYWthb1RhbGsiLCJ0ZXh0IjoiVGhpcyByZXVuaW9uIHNjZW5lIGlzIHRydWx5IGhlYXJ0LXdyZW5jaGluZyBsaWtlIGEgc2NlbmUgZnJvbSAnVWp1bmd1aSBNdWRvJyJ9LHsic2l0dWF0aW9uIjoiU05TIGNvbW1lbnQiLCJ0ZXh0IjoiV2hlbiAnR3dpd29uc2FlJyBjb21lcyBvbiwgaXQncyBoYXJkIHRvIGhvbGQgYmFjayB0ZWFycyJ9XSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- r2fg5gqv  trend_score=322.21  잘자 내꿈꿔
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiYmZmMWI2MGYtYzI0Ny00MDMzLWE4Y2ItODA2YmNhZDAxNzNiIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJkZjFhNTVmYzI4NmFlNDQ0ZmZmMDFiMmNkNGE2MmM5MTBmNDE4NDZhNWU1NzYwNmM3MzFlOWJmNDEzMzdmOTFmIiwic291cmNlX3RpdGxlIjoi7J6Y7J6QIOuCtOq/iOq/lCIsInNvdXJjZV9zdW1tYXJ5IjoiMTk5OX4yMDAw64WEIENG7JeQ7IScIOycoOuemO2VtCDsnbjsgqzrp5DroZwg7J6Q66as7J6h7J2AIOycoO2WieyWtCIsInNvdXJjZV9kZXNjcmlwdGlvbiI6IjE5OTl+MjAwMOuFhCDsobDshLHrqqjCt+ydtOygle2YhOydtCDstpzsl7DtlZwg6rSR6rOg7JeQ7IScIOyTsOyduCAn7J6YIOyekCwg64K0IOq/iCDqv5Qn652864qUIOuMgOyCrOqwgCDqt7gg7Iuc7KCIIOycoO2WieyWtCDsiJzsnITsl5Ag6ry97Z6I66mwIOuwpCDsnbjsgqzrp5DroZwg64SQ66asIOyTsOyYgOuLpC4iLCJzb3VyY2Vfb3JpZ2luIjoiMTk5OeuFhCBLVEYg7J2066mU7J28IOyEnOu5hOyKpCDqtJHqs6Dsl5DshJwg7KGw7ISx66qo7JmAIOydtOygle2YhOydtCDstpzsl7DtlbQg7J2067OE7ZWY64qUIOyXsOyduCDsgqzsnbTsnZgg7JWg6rWQIOyEnuyduCDrjIDsgqzroZwg64Ko6ri0IOunkOydtCAn7J6Y7J6QIOuCtOq/iOq/lCfri6QuIOq0keqzoCDsho0g67CY7Ked7J20IOqzsOuPjOydtCDsnbjtmJXquYzsp4Ag7YGs6rKMIO2ZlOygnOqwgCDrkJjrqbTshJwg7ZWZ7IOd65OkIOyCrOydtOyXkOyEnCAn64K06r+I6r+UIOqzsOuPjOydtCDsnbjtmJUn7J20IO2VhOyImCDshozsp4Dtkojsspjrn7wg7Jes6rKo7KeIIOygleuPhOuhnCDsnbjquLDrpbwg64GM7JeI64ukLiDsnbQg66eQ7Yis66W8IOycoOuqheyduOuTpOydmCDrqqnshozrpqzroZwg7Z2J64K0IOuCuCDtjKjrn6zrlJQg67KE7KCE7J20IOuwqeyGocK3652865SU7Jik66W8IO2Gte2VtCAyMDDsl6wg6rCA7KeA64KYIOunjOuTpOyWtOyhjOuLpOqzoCDsoITtlbTsp4DrqbAsIDE5OTnrhYQg7Jyg7ZaJ7Ja0IOyInOychCDsg4HsnITqtozsl5Ag7Jik66W8IOunjO2BvCDqtJHqs6Ag7Lm07ZS86rCAIOydvOyDgSDsnbjsgqzrp5DroZwg7J6Q66as7J6h7J2AIOuMgO2RnCDsgqzroYDroZwg6ry97Z6M64ukLiIsInNvdXJjZV91c2FnZV9ub3RlIjoi7Lmc7ZWcIOyCrOydtOyXkCDsnqDrk6TquLAg7KCEIOyduOyCrOuhnCDqt7jrjIDroZwg7JO4IOyImCDsnojri6QiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi7J6YIOyekCwg64K0IOq/iCDqv5QiXSwic291cmNlX3VzYWdlX2V4YW1wbGVzIjpudWxsLCJsb2NhbGl6ZWRfc2x1ZyI6InNsZWVwLXdlbGwtbXktZHJlYW0iLCJ0aXRsZSI6IlNsZWVwIFdlbGwsIE15IERyZWFtIiwic3VtbWFyeSI6IkEgcG9wdWxhciBmYXJld2VsbCBwaHJhc2UgZGVyaXZlZCBmcm9tIGEgMTk5OS0yMDAwIGFkdmVydGlzZW1lbnQgZmVhdHVyaW5nIENobyBTZXVuZy13b28gYW5kIExlZSBKdW5nLWh5dW4iLCJkZXNjcmlwdGlvbiI6IlRoZSBwaHJhc2UgJ1NsZWVwIHdlbGwsIG15IGRyZWFtJyBmcm9tIGEgMTk5OS0yMDAwIEtURiBlbWFpbCBzZXJ2aWNlIGFkdmVydGlzZW1lbnQsIHN0YXJyaW5nIENobyBTZXVuZy13b28gYW5kIExlZSBKdW5nLWh5dW4sIGJlY2FtZSB3aWRlbHkgdXNlZCBhcyBhIG5pZ2h0dGltZSBmYXJld2VsbCBncmVldGluZy4gVGhlIGFkdmVydGlzZW1lbnQsIHdoaWNoIGZlYXR1cmVkIGEgc3BhcmtsaW5nIHRlZGR5IGJlYXIsIGJlY2FtZSBhIGhpdCBhbmQgbWFkZSB0aGUgYmVhciBhIG11c3QtaGF2ZSBpdGVtIGFtb25nIHN0dWRlbnRzLiBUaGUgY2F0Y2hwaHJhc2Ugd2FzIHBhcm9kaWVkIGluIG92ZXIgMjAwIHZlcnNpb25zIGJ5IGNlbGVicml0aWVzIGFuZCB3YXMgY29uc2lkZXJlZCBvbmUgb2YgdGhlIHRvcCB0cmVuZGluZyBwaHJhc2VzIG9mIDE5OTkuIiwib3JpZ2luIjoiVGhlIHBocmFzZSAnU2xlZXAgd2VsbCwgbXkgZHJlYW0nIG9yaWdpbmF0ZWQgZnJvbSBhIDE5OTkgS1RGIGVtYWlsIHNlcnZpY2UgYWR2ZXJ0aXNlbWVudCB3aGVyZSBDaG8gU2V1bmctd29vIGFuZCBMZWUgSnVuZy1oeXVuIHBsYXllZCBhIGNvdXBsZSBzYXlpbmcgZ29vZGJ5ZSB3aXRoIGEgcGxheWZ1bCB0b25lLiBUaGUgYWR2ZXJ0aXNlbWVudCwgd2hpY2ggZmVhdHVyZWQgYSBzcGFya2xpbmcgdGVkZHkgYmVhciwgYmVjYW1lIGEgaGl0IGFuZCBtYWRlIHRoZSBiZWFyIGEgbXVzdC1oYXZlIGl0ZW0gYW1vbmcgc3R1ZGVudHMuIFRoZSBjYXRjaHBocmFzZSB3YXMgcGFyb2RpZWQgaW4gb3ZlciAyMDAgdmVyc2lvbnMgYnkgY2VsZWJyaXRpZXMgYW5kIHdhcyBjb25zaWRlcmVkIG9uZSBvZiB0aGUgdG9wIHRyZW5kaW5nIHBocmFzZXMgb2YgMTk5OS4iLCJ1c2FnZV9ub3RlIjoiVGhpcyBwaHJhc2UgY2FuIGJlIHVzZWQgYXMgYSBmYXJld2VsbCBncmVldGluZyBhbW9uZyBjbG9zZSBmcmllbmRzIGJlZm9yZSBnb2luZyB0byBzbGVlcC4iLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIlNsZWVwIFdlbGwsIE15IERyZWFtIl0sInVzYWdlX2V4YW1wbGVzIjpbXSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- uvdujpcy  trend_score=322.21  그리운 어머니
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiYzgwYWM4M2QtMDAwMi00OTgxLWExYjgtOTM5NDVhOTY1ZTE3IiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiIzMmZkZjk4ZjUwYzU2MWY5YzNiNmM5YWNlNGYxYjAyODBlYmU3YzM1OWQzOTYwNDU1MWJlM2YxNTQzNjY2Zjg3Iiwic291cmNlX3RpdGxlIjoi6re466as7Jq0IOyWtOuouOuLiCIsInNvdXJjZV9zdW1tYXJ5Ijoi7Jqw7KCV7J2YIOustOuMgOydmCDriIjrrLwg7L2U64SILCDsnqXrs5Hqs7wg7Ja066i464uI7J2YIOq5nOynnSDsg4HrtIkiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiIxOTg5fjE5OTfrhYQg67Cp7JiB65CcIE1CQyA87Jqw7KCV7J2YIOustOuMgD7sl5DshJwg7KeE7ZaJ7J6QIOydtOyDgeyaqeydtCDrrLTrjIAg65KkIOuqqeyGjOumrOunjOycvOuhnCDsnpDsi6DsnZgg7Ja066i464uI66W8IOyVjOyVhOunnu2eiOqyjCDtlZwg65KkIOyLpOygnCDsg4HrtInsi5ztgqTripQg7L2U64SI66GcLCAxOTkw64WEIDfsm5TrtoDthLAg7IKs7Jqp65CcIOuwsOqyveydjOyVhSAn6re466as7Jq0IOyWtOuouOuLiCfsmYAg7ZWo6ruYIOyghCDqta3rr7zsnYQg64iI66y87KeT6rKMIO2VnCDsg4Hsp5XsoIEg7J6l66m07J2064ukLiIsInNvdXJjZV9vcmlnaW4iOiIxOTkw64WEIDfsm5QgMjPsnbwg67Cp7JiB67aE67aA7YSwIOy9lOuEiCDrsLDqsr3snYzslYXsnLzroZwg7KCV7LCpLCBNQkMgPOyasOygleydmCDrrLTrjIA+Iiwic291cmNlX3VzYWdlX25vdGUiOiLqsJDrj5nsoIHsnbgg6rCA7KGxIOyDgeu0iSDsnqXrqbTsnYQg7J207JW86riw7ZWgIOuVjCDsnbjsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi7Jqw7KCV7J2YIOustOuMgCIsIuyWtOuouOuLiCDsg4HrtIkg7L2U64SIIl0sInNvdXJjZV91c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi7Lm07YahIiwidGV4dCI6IuydtCDsg4HrtIkg7JiB7IOBIOynhOynnCDqt7jrpqzsmrTslrTrqLjri4gg7L2U64SI6riJIOqwkOuPmeydtOuLpCJ9LHsic2l0dWF0aW9uIjoiU05TIOuMk+q4gCIsInRleHQiOiLsmrDsoJXsnZjrrLTrjIAg6re466as7Jq07Ja066i464uIIOuLpOyLnCDrtJDrj4Qg7Jq064ukIn1dLCJsb2NhbGl6ZWRfc2x1ZyI6ImdyaXZ1bi1lb21lb25pIiwidGl0bGUiOiJHcml2dW4gRW9tZW9uaSIsInN1bW1hcnkiOiJBIHRlYXItamVya2luZyBzZWdtZW50IGZyb20gdGhlIEtvcmVhbiBUViBzaG93ICdVanVuZy11aSBNdWRhZWInIHdoZXJlIHNvbGRpZXJzIHJldW5pdGUgd2l0aCB0aGVpciBtb3RoZXJzIGluIGEgc3VycHJpc2UgcmV1bmlvbiIsImRlc2NyaXB0aW9uIjoiQSBzZWdtZW50IGZyb20gdGhlIEtvcmVhbiBUViBzaG93ICdVanVuZy11aSBNdWRhZWInIGJyb2FkY2FzdCBmcm9tIDE5ODkgdG8gMTk5Nywgd2hlcmUgaG9zdCBMZWUgU2FuZy15b25nIHdvdWxkIHN1cnByaXNlIHNvbGRpZXJzIHdpdGggYSByZXVuaW9uIHdpdGggdGhlaXIgbW90aGVycyBhZnRlciB0aGV5IGlkZW50aWZpZWQgdGhlaXIgbW90aGVycycgdm9pY2VzLiBUaGUgc2VnbWVudCwgYWNjb21wYW5pZWQgYnkgdGhlIGJhY2tncm91bmQgbXVzaWMgJ0dyaXZ1biBFb21lb25pJyBmcm9tIEp1bHkgMTk5MCwgYmVjYW1lIGljb25pYyBmb3IgaXRzIGVtb3Rpb25hbCBpbXBhY3QuIiwib3JpZ2luIjoiVGhlIHNlZ21lbnQgYmVjYW1lIGEgcmVndWxhciBmZWF0dXJlIHdpdGggdGhlIGJhY2tncm91bmQgbXVzaWMgJ0dyaXZ1biBFb21lb25pJyBzdGFydGluZyBmcm9tIEp1bHkgMjMsIDE5OTAsIG9uIE1CQydzICdVanVuZy11aSBNdWRhZWInIiwidXNhZ2Vfbm90ZSI6IlVzZWQgdG8gcmVmZXJlbmNlIHRvdWNoaW5nIGZhbWlseSByZXVuaW9uIHNjZW5lcyIsImNhdXRpb24iOm51bGwsImFsaWFzZXMiOlsiVWp1bmctdWkgTXVkYWViIFJldW5pb24gU2VnbWVudCIsIlN1cnByaXNlIE1vdGhlciBSZXVuaW9uIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJLYWthb1RhbGsiLCJ0ZXh0IjoiVGhpcyByZXVuaW9uIHZpZGVvIGlzIHJlYWxseSB0b3VjaGluZywgbGlrZSB0aGUgJ0dyaXZ1biBFb21lb25pJyBzZWdtZW50In0seyJzaXR1YXRpb24iOiJTTlMgY29tbWVudCIsInRleHQiOiJXYXRjaGluZyAnVWp1bmctdWkgTXVkYWViJyBhZ2FpbiBicmluZ3MgdGVhcnMgdG8gbXkgZXllcyJ9XSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- fhn6bcju  trend_score=320.59  원더걸스 Tell Me 꼭지점춤
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiMDIwNzVhNzQtNzdiZi00Yjk2LWJjMGYtZDQwMDI3ZTVlYzZjIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI1YjUxYWIzMWNhNWQxNzUzODZlMzAwZjEzYWFiMDY1NThiOWJiODE5ZmYxNWQ0OTJkZmZiMGY4MmEwNDc5NDFkIiwic291cmNlX3RpdGxlIjoi7JuQ642U6rG47IqkIFRlbGwgTWUg6ryt7KeA7KCQ7LakIiwic291cmNlX3N1bW1hcnkiOiLsm5DrjZTqsbjsiqQgVGVsbCBNZSDtm4TroLTqtawg7IaQ64+Z7J6R7J20IOyghCDqta3rr7wg7Jyg7ZaJIOuMhOyKpOqwgCDrkJwg7IKs6rG0Iiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMjAwN+uFhCDrsJzrp6TrkJwg7JuQ642U6rG47Iqk7J2YICdUZWxsIE1lJ+uKlCDsgrTrnpHsgrTrnpEg7LakLCDssIzrpbTquLAg7LakLCDtjJTssIwg7LakIOuTsSDtm4TroLTqtawg7IaQ64+Z7J6R7J20IOyEuOuMgOyZgCDsp4Hsl4XsnYQg67aI66y47ZWY6rOgIOuUsOudvCDtlZjripQg6rWt66+8IOyLoOuTnOuhrOydhCDsnbzsnLzsvLDri6QuIO2VmeyDneu2gO2EsCDrhbjsnbgsIOqyveywsCwg6rWw7J246rmM7KeAIOy2pOydhCDrlLDrnbwg7LaU64qUIFVDQ+qwgCDsj5/slYTsp4DrqbAgJ+ybkOuNlOqxuOyKpCDrqqjrpbTrqbQg6rCE7LKpJ+ydtOudvOuKlCDrp5DquYzsp4Ag7IOd6rK864ukLiIsInNvdXJjZV9vcmlnaW4iOiJKWVDsl5TthLDthYzsnbjrqLztirgg7JuQ642U6rG47IqkICdUZWxsIE1lJygyMDA3KSDslYjrrLQsIOuwleynhOyYgSDsp4Drj4QiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6IjIwMDDrhYTrjIAg7ZuE67CYIEvtjJ0g64yE7IqkIOycoO2WieydhCDtmozqs6DtlZjqsbDrgpgg7Luk67KE64yE7IqkIOy9mO2FkOy4oOyXkCDtmZzsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi7YWU66+4IOy2pCIsIuyCtOuekeyCtOuekSDstqQiLCLtjJTssIwg7LakIl0sInNvdXJjZV91c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi7ZqM7IudIOuLqO2GoSIsInRleHQiOiLtmozsi50g65WMIO2FlOuvuCDqvK3sp4DsoJDstqQg7ZWc67KIIOy2lOyekOOFi+OFiyJ9LHsic2l0dWF0aW9uIjoiU05TIOuMk+q4gCIsInRleHQiOiLsnbQg7JWI66y0IOyZhOyghCDthZTrr7gg6ryt7KeA7KCQ7Lak6riJIOykkeuPheyEsSJ9XSwibG9jYWxpemVkX3NsdWciOiJ3b25kZXItZ2lybHMtdGVsbC1tZS1kYW5jZSIsInRpdGxlIjoiV29uZGVyIEdpcmxzIFRlbGwgTWUgRGFuY2UiLCJzdW1tYXJ5IjoiVGhlIGhhbmQgZ2VzdHVyZXMgZnJvbSB0aGUgY2hvcnVzIG9mIFdvbmRlciBHaXJscycgJ1RlbGwgTWUnIGJlY2FtZSBhIG5hdGlvbndpZGUgZGFuY2UgY3JhemUiLCJkZXNjcmlwdGlvbiI6IkluIDIwMDcsIFdvbmRlciBHaXJscycgJ1RlbGwgTWUnIHNwYXJrZWQgYSBkYW5jZSBjcmF6ZSB3aXRoIGl0cyBpY29uaWMgaGFuZCBtb3ZlbWVudHMsIGtub3duIGFzIHRoZSAnVGVsbCBNZSBkYW5jZSwnICdzd2F5aW5nIGRhbmNlLCcgb3IgJ2JyYWNlbGV0IGRhbmNlLicgVGhlIGRhbmNlIGJlY2FtZSBhIGhpdCBhY3Jvc3MgYWxsIGdlbmVyYXRpb25zIGFuZCBwcm9mZXNzaW9ucywgd2l0aCB2aWRlb3Mgb2YgcGVvcGxlIGZyb20gc3R1ZGVudHMgdG8gZWxkZXJseSBpbmRpdmlkdWFscywgcG9saWNlIG9mZmljZXJzLCBhbmQgc29sZGllcnMgcGVyZm9ybWluZyB0aGUgZGFuY2UgZmxvb2RpbmcgdGhlIGludGVybmV0LiBUaGUgcG9wdWxhcml0eSBsZWQgdG8gdGhlIGNyZWF0aW9uIG9mIHRoZSBwaHJhc2UgJ0lmIHlvdSBkb24ndCBrbm93IFdvbmRlciBHaXJscywgeW91J3JlIGEgc3B5LiciLCJvcmlnaW4iOiJKWVAgRW50ZXJ0YWlubWVudCBXb25kZXIgR2lybHMgJ1RlbGwgTWUnICgyMDA3KSBjaG9yZW9ncmFwaHksIGRpcmVjdGVkIGJ5IFBhcmsgSmluLXlvdW5nIiwidXNhZ2Vfbm90ZSI6IlJlY2FsbGVkIGluIHJldHJvc3BlY3RpdmVzIG9mIEstcG9wIGRhbmNlIHRyZW5kcyBmcm9tIHRoZSBsYXRlIDIwMDBzIG9yIHVzZWQgaW4gY292ZXIgZGFuY2UgY29udGVudCIsImNhdXRpb24iOm51bGwsImFsaWFzZXMiOlsiVGVsbCBNZSBkYW5jZSIsInN3YXlpbmcgZGFuY2UiLCJicmFjZWxldCBkYW5jZSJdLCJ1c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoiQWZ0ZXItd29yayBkaW5uZXIgY2hhdCIsInRleHQiOiJMZXQncyBkbyB0aGUgVGVsbCBNZSBkYW5jZSBhdCB0aGUgYWZ0ZXItd29yayBkaW5uZXIsIGhhaGEifSx7InNpdHVhdGlvbiI6IlNvY2lhbCBtZWRpYSBjb21tZW50IiwidGV4dCI6IlRoaXMgY2hvcmVvZ3JhcGh5IGlzIGFzIGFkZGljdGl2ZSBhcyB0aGUgVGVsbCBNZSBkYW5jZSJ9XSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- h5ragtd9  trend_score=320.59  이수영 - 라라라
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiMjBlZTkwYzgtZTkxNy00NjI3LWE3ODEtOTg2NzZlNTZjN2IzIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJhZTcwODI0YmU4YjRkOGVmNGE1ZjcwMTVkODVlNjk4ZWY2Nzk2ZTQ0N2E1ZDNjZGYyOGFlNjIxMjliNGJiNWIyIiwic291cmNlX3RpdGxlIjoi7J207IiY7JiBIC0g652865286528Iiwic291cmNlX3N1bW1hcnkiOiLri6jsiJztlZjqs6Ag7KSR64+F7KCB7J24IO2bhOugtOq1rOuhnCDsgqzrnpHrsJvsnYAg7J207IiY7JiB7J2YIDIwMDLrhYQg7Z6I7Yq46rOhIiwic291cmNlX2Rlc2NyaXB0aW9uIjoiMjAwMuuFhCDrsJzrp6TrkJwg7J207IiY7JiBIOygleq3nCA07KeR7J2YIO2DgOydtO2LgOqzoeycvOuhnCwgJ+udvOudvOudvCfrnbzripQg64uo7Iic7ZWcIO2bhOugtOq1rOqwgCDtgbAg7J246riw66W8IOuBjOupsCDri7nsi5wg6rCA7JqUIOyInOychOulvCDtnKnsk7jsl4jri6QuIOuwnOudvOuTnCDqsIDsiJjroZzshJwg7J207IiY7JiB7J2YIOyeheyngOulvCDri6Tsp4Qg64yA7ZGc6rOhIOykkSDtlZjrgpjri6QuIiwic291cmNlX29yaWdpbiI6IjIwMDLrhYQg7J207IiY7JiBIOygleq3nCA07KeRICfrp4jsnbQg7Iqk7YWM7J20IOyduCDshLzri6TsnbQnIO2DgOydtO2LgOqzoeycvOuhnCDrsJzrp6QiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6IjIwMDDrhYTrjIAg7LSIIOuwnOudvOuTnCDrqoXqs6HsnYQg7J207JW86riw7ZWgIOuVjCDslrjquIkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi7J207IiY7JiBIDTsp5Eg7YOA7J207YuA6rOhIl0sInNvdXJjZV91c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi7Lm07YahIiwidGV4dCI6IuudvOudvOudvH4g7J20IO2bhOugtOq1rCDsnYDqt7wg6rOE7IaNIO2dpeyWvOqxsOugpOynhOuLpCJ9LHsic2l0dWF0aW9uIjoiU05TIOuMk+q4gCIsInRleHQiOiIyMDAw64WE64yAIOy0iCDrsJzrnbzrk5wg66qF6rOhIO2VmOuptCDrnbzrnbzrnbzsp4AifV0sImxvY2FsaXplZF9zbHVnIjoibGVlLXNvby15b3VuZy1sYS1sYS1sYSIsInRpdGxlIjoiTGVlIFNvby15b3VuZyAtIExhIExhIExhIiwic3VtbWFyeSI6IkEgc2ltcGxlIGFuZCBjYXRjaHkgY2hvcnVzIGxvdmVkIGJ5IG1hbnksIHRoaXMgc29uZyB3YXMgYSBoaXQgaW4gMjAwMiIsImRlc2NyaXB0aW9uIjoiUmVsZWFzZWQgYXMgdGhlIHRpdGxlIHRyYWNrIG9mIExlZSBTb28teW91bmcncyBmb3VydGggc3R1ZGlvIGFsYnVtIGluIDIwMDIsICdMYSBMYSBMYScgYmVjYW1lIHdpZGVseSBwb3B1bGFyIGR1ZSB0byBpdHMgc2ltcGxlIGFuZCBjYXRjaHkgY2hvcnVzLiBJdCBzd2VwdCB0aGUgbXVzaWMgY2hhcnRzIGFuZCBzb2xpZGlmaWVkIExlZSBTb28teW91bmcncyBwb3NpdGlvbiBhcyBhIGJhbGxhZCBzaW5nZXIuIiwib3JpZ2luIjoiUmVsZWFzZWQgYXMgdGhlIHRpdGxlIHRyYWNrIG9mIExlZSBTb28teW91bmcncyBmb3VydGggc3R1ZGlvIGFsYnVtICdNeSBTdGF5IGluIFNlbmRhaScgaW4gMjAwMiIsInVzYWdlX25vdGUiOiJPZnRlbiBtZW50aW9uZWQgd2hlbiBkaXNjdXNzaW5nIGJhbGxhZCBoaXRzIGZyb20gdGhlIGVhcmx5IDIwMDBzIiwiY2F1dGlvbiI6bnVsbCwiYWxpYXNlcyI6WyJMZWUgU29vLXlvdW5nJ3MgZm91cnRoIGFsYnVtIHRpdGxlIHRyYWNrIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJLYWthb1RhbGsiLCJ0ZXh0IjoiTGEgTGEgTGF+IFRoaXMgY2hvcnVzIGtlZXBzIGdldHRpbmcgaHVtbWVkIn0seyJzaXR1YXRpb24iOiJTTlMgY29tbWVudCIsInRleHQiOiJXaGVuIHRhbGtpbmcgYWJvdXQgYmFsbGFkIGhpdHMgZnJvbSB0aGUgZWFybHkgMjAwMHMsIExhIExhIExhIGNvbWVzIHVwIn1dLCJtb2RlbCI6Im1seC1jb21tdW5pdHkvUXdlbjIuNS0xNEItSW5zdHJ1Y3QtNGJpdCJ9', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- h6wskk4v  trend_score=320.59  친구의 친구를 사랑했네
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiNjJkNmIxODUtY2ZhYy00ZmExLTllOWItOGI3ZjMzZmViZjcwIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiIwOGU2YjAzMmRjNzhlZmM3ZDMwYzJiNjQyMDFlMjY5NzgzZDk4ZDdjNWNhN2YyNDJhNDJhNTA3NzMyNGQ4Yjg0Iiwic291cmNlX3RpdGxlIjoi7Lmc6rWs7J2YIOy5nOq1rOulvCDsgqzrnpHtlojrhKQiLCJzb3VyY2Vfc3VtbWFyeSI6IuydtOyKueyyoOydmCDrhbjrnpjrpbwgQ03shqHsnLzroZwg7JO0IO2VnOyGlFBDUyAwMTjsnZgg6rCQ7ISx7KCB7J24IOydtOuPme2GteyLoCDqtJHqs6AiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiIxOTk364WEIO2VnOyGlFBDU+uKlCAwMTgg67iM656c65OcIOq0keqzoOyXkCDsnbTsirnssqDsnbQg67aA66W4IOy5nOq1rOydmCDsuZzqtazrpbwg7IKs656R7ZaI64Sk66W8IENN7Iah7Jy866GcIOyCrOyaqe2VtCDqsJDshLHsoIHsnbgg67aE7JyE6riw66W8IOyXsOy2nO2WiOuLpC4g64yA7KSR7KCB7Jy866GcIOyduOq4sCDsnojrjZgg67Cc652865Oc66W8IOq0keqzoCDsnYzslYXsnLzroZwg7LCo7Jqp7ZW0IOu4jOuenOuTnCDsnbTrr7jsp4Drpbwg67aA65Oc65+96rKMIOyghOuLrO2VnCDsgqzroYDroZwg6ry97Z6M64ukLiAwMTjsnYAg7J20IENN7IahIOuTseydmCDsnbjquLDsl5Drj4Qg67aI6rWs7ZWY6rOgIOydtO2bhCBLVEbsl5Ag7ZWp67OR65CY66mwIOu4jOuenOuTnOqwgCDsgqzrnbzsoYzri6QuIiwic291cmNlX29yaWdpbiI6IjE5OTfrhYQg7ZWc7IaUUENTIDAxOCBUVuq0keqzoCwg7J207Iq57LKgIOuFuOuemCDsgr3snoUiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6IuuwnOudvOuTnOulvCBDTeyGoeycvOuhnCDtmZzsmqntlZwg6rCQ7ISxIOuniOy8gO2MhSDsgqzroYDroZwg7J247Jqp65Cc64ukIiwic291cmNlX2NhdXRpb24iOm51bGwsInNvdXJjZV9hbGlhc2VzIjpbIu2VnOyGlFBDUyAwMTggQ03shqEiXSwic291cmNlX3VzYWdlX2V4YW1wbGVzIjpudWxsLCJsb2NhbGl6ZWRfc2x1ZyI6ImNoaW5ndS11aS1jaGluZ3UtcmV1bC1zYXJhbmdoYWV0dGVvIiwidGl0bGUiOiJDaGluZ3UtdWkgY2hpbmd1LXJldWwgc2FyYW5naGFldHRlbyIsInN1bW1hcnkiOiJBIHNlbnRpbWVudGFsIGFkdmVydGlzZW1lbnQgdXNpbmcgYSBiYWxsYWQgc29uZyBieSBMZWUgU2V1bmctY2hlb2wsIHBvcHVsYXIgaW4gS29yZWEgaW4gdGhlIGxhdGUgMTk5MHMuIiwiZGVzY3JpcHRpb24iOiJJbiAxOTk3LCBIYW5zb2wgUENTIHVzZWQgTGVlIFNldW5nLWNoZW9sJ3Mgc29uZyAnQ2hpbmd1LXVpIGNoaW5ndS1yZXVsIHNhcmFuZ2hhZXR0ZW8nIGFzIGEgY29tbWVyY2lhbCBqaW5nbGUgZm9yIHRoZWlyIDAxOCBicmFuZC4gVGhpcyBlbW90aW9uYWwgYWQgY2FtcGFpZ24gdXRpbGl6ZWQgYSBwb3B1bGFyIGJhbGxhZCB0byBjb252ZXkgYSBzb2Z0IGFuZCBnZW50bGUgYnJhbmQgaW1hZ2UuIERlc3BpdGUgdGhlIHN1Y2Nlc3Mgb2YgdGhpcyBhbmQgb3RoZXIgY2FtcGFpZ25zLCBIYW5zb2wgUENTIHdhcyBsYXRlciBtZXJnZWQgd2l0aCBLVEYsIGxlYWRpbmcgdG8gdGhlIGJyYW5kJ3MgZGlzYXBwZWFyYW5jZS4iLCJvcmlnaW4iOiIxOTk3IEhhbnNvbCBQQ1MgMDE4IFRWIGNvbW1lcmNpYWwsIGZlYXR1cmluZyBMZWUgU2V1bmctY2hlb2wncyBzb25nIiwidXNhZ2Vfbm90ZSI6IkNpdGVkIGFzIGFuIGV4YW1wbGUgb2YgZW1vdGlvbmFsIG1hcmtldGluZyB1c2luZyBiYWxsYWRzIGFzIGNvbW1lcmNpYWwgamluZ2xlcyIsImNhdXRpb24iOm51bGwsImFsaWFzZXMiOlsiSGFuc29sIFBDUyAwMTggQ00gc29uZyJdLCJ1c2FnZV9leGFtcGxlcyI6W10sIm1vZGVsIjoibWx4LWNvbW11bml0eS9Rd2VuMi41LTE0Qi1JbnN0cnVjdC00Yml0In0=', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- hy3gqdv6  trend_score=320.59  몸짱 아줌마
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiOGViYjI0YTktYWMwNC00MTI5LWI4NmYtNGUxN2NjMzFkMTIxIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI5MWE3NTQzNjYzMTkzMzMxMjZlNTRlZjkxMzY2ZWFkMWRjZWI4ZmFhY2U3ZDNkYjdkMTY1MDRiYWVjYzQ5MGUxIiwic291cmNlX3RpdGxlIjoi66q47KexIOyVhOykjOuniCIsInNvdXJjZV9zdW1tYXJ5Ijoi7Y+J67KU7ZWcIOyjvOu2gOqwgCDri6TsnbTslrTtirjCt+q3vOycoSDrqrjrp6TroZwg7KCE6rWt7KCBIOyXtO2SjeydhCDsnbzsnLztgqggMjAwNeuFhCDtmITsg4EiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiLsoJXri6Tsl7Ag7JSo6rCAIDcwa2fsl5DshJwg7LK07KeA67Cp7J2EIOqwkOufie2VtCDtg4Ttg4TtlZwg66q466ek66GcIOuzgOyLoO2VnCDsoITtm4Qg7IKs7KeE7J20IDIwMDXrhYQg7Ja466Gg6rO8IOyYqOudvOyduOyXkCDtjbzsp4DrqbAgJ+uquOynsSDslYTspIzrp4gnIOyXtO2SjeydhCDsnbzsnLzsvLDri6QuIOyWvOynsSDsi6Drk5zroazqs7wg64yA67mE65CY64qULCDrhbjroKXsnLzroZwg66eM65OgIOqxtOqwle2VnCDrqrjsnbTrnbzripQg7ISc7IKs6rCAIOuMgOykkeyggSDqs7XqsJDsnYQg7Ja77Ja0IOq1reuvvOyggSDri6TsnbTslrTtirgg67aQ7Jy866GcIOydtOyWtOyhjOuLpC4iLCJzb3VyY2Vfb3JpZ2luIjoiMjAwMuuFhCDrlLTsp4Dsnbzrs7Qg6riw6rOg66GcIOyVjOugpOynhCDsoJXri6Tsl7Ag7JSo7J2YIOuLpOydtOyWtO2KuCDshLHqs7Xri7TsnbQgMjAwNeuFhCDslrjroaAg67O064+E66GcIOyghOq1reyggSDtmZTsoJztmZQiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6IjIwMDDrhYTrjIAg64uk7J207Ja07Yq4IOyXtO2SjeydtOuCmCDrqrjrp6Qg6rSA66asIOydtOyVvOq4sCDshozsnqzroZwiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi67SE64KgIOyVhOykjOuniCIsIuygleuLpOyXsCJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLrgpgg7JqU7KaYIOyatOuPme2VmOuKlOuNsCDrqrjsp7HslYTspIzrp4jsspjrn7wg65CY6rOgIOyLtuuLpCJ9LHsic2l0dWF0aW9uIjoiU05TIOuMk+q4gCIsInRleHQiOiLrhbjroKXsnLzroZwg66eM65OgIOuquCDsp4Tsp5wg66q47Kex7JWE7KSM66eI6riJ7J2064SkIn1dLCJsb2NhbGl6ZWRfc2x1ZyI6ImJvZHlmaXQtbW9tIiwidGl0bGUiOiJCb2R5Zml0IE1vbSIsInN1bW1hcnkiOiJBIHBoZW5vbWVub24gaW4gMjAwNSB3aGVyZSBhIHR5cGljYWwgaG91c2V3aWZlIHRyYW5zZm9ybWVkIGludG8gYSBmaXRuZXNzIGljb24sIHNwYXJraW5nIGEgbmF0aW9ud2lkZSB0cmVuZCIsImRlc2NyaXB0aW9uIjoiSW4gMjAwNSwgdGhlIGJlZm9yZS1hbmQtYWZ0ZXIgcGhvdG9zIG9mIEplb25nIERhLXllb24sIHdobyByZWR1Y2VkIGhlciBib2R5IGZhdCBmcm9tIDcwa2cgdG8gYWNoaWV2ZSBhIHRvbmVkIHBoeXNpcXVlLCB3ZW50IHZpcmFsIHRocm91Z2ggbWVkaWEgYW5kIG9ubGluZSBwbGF0Zm9ybXMsIGlnbml0aW5nIGEgJ0JvZHlmaXQgTW9tJyBjcmF6ZS4gVGhpcyBuYXJyYXRpdmUgb2YgYWNoaWV2aW5nIGEgaGVhbHRoeSBib2R5IHRocm91Z2ggZWZmb3J0IHJlc29uYXRlZCB3aXRoIHRoZSBwdWJsaWMsIGxlYWRpbmcgdG8gYSBuYXRpb253aWRlIGZpdG5lc3MgYm9vbS4iLCJvcmlnaW4iOiJKZW9uZyBEYS15ZW9uJ3Mgc3VjY2VzcyBzdG9yeSBvZiB3ZWlnaHQgbG9zcywgd2hpY2ggd2FzIGZpcnN0IHNoYXJlZCBpbiBhbiBhcnRpY2xlIG9uIHRoZSBvbmxpbmUgbWFnYXppbmUgJ0RkYW5nJyBpbiAyMDAyLCBnYWluZWQgbmF0aW9uYWwgYXR0ZW50aW9uIGluIDIwMDUgdGhyb3VnaCBtZWRpYSBjb3ZlcmFnZSIsInVzYWdlX25vdGUiOiJVc2VkIGFzIGEgcmVmZXJlbmNlIGluIGRpc2N1c3Npb25zIGFib3V0IGZpdG5lc3MgdHJlbmRzIGFuZCBib2R5IHRyYW5zZm9ybWF0aW9uIGluIHRoZSAyMDAwcyIsImNhdXRpb24iOm51bGwsImFsaWFzZXMiOlsiU3ByaW5nIE1vbSIsIkplb25nIERhLXllb24iXSwidXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iktha2FvVGFsayIsInRleHQiOiJJJ3ZlIGJlZW4gd29ya2luZyBvdXQgYW5kIEkgd2FudCB0byBiZWNvbWUgbGlrZSBhIEJvZHlmaXQgTW9tIn0seyJzaXR1YXRpb24iOiJTTlMgY29tbWVudCIsInRleHQiOiJUaGlzIGJvZHkgaXMgdHJ1bHkgQm9keWZpdCBNb20gbGV2ZWwsIGFjaGlldmVkIHRocm91Z2ggaGFyZCB3b3JrIn1dLCJtb2RlbCI6Im1seC1jb21tdW5pdHkvUXdlbjIuNS0xNEItSW5zdHJ1Y3QtNGJpdCJ9', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- ckzrrca9  trend_score=320.59  히밥
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiOTgxYmJmOGYtM2M4NS00ZTQ1LTg5NjEtZTA2NDIxMDE4NmE3IiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiIyMTU5ZDdiODllNGY0MzE2Njk1YjhkZDhkMDM4MjgxNDg0NTQ0YzQ0NjFhNTA2MTg4MjgyZDJlNTE3YjJmYTc2Iiwic291cmNlX3RpdGxlIjoi7Z6I67ClIiwic291cmNlX3N1bW1hcnkiOiIyMDE564WEIOuNsOu3lO2VtCDrjIDsi53qsIAg66i567Cp7Jy866GcIOycoOuqhe2VtOynhCDsl6zshLEg7Jyg7Yqc67KEIOuzhOuqheydtOyekCDrsIgiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiIyMDE564WEIDEy7JuUIOyVhO2UhOumrOy5tFRWKO2YhCBTT09QKeyXkOyEnCDrjbDrt5TtlZwg7Z6I67Cl7J2AIOyvlOyWkeuztOuLpCDruaDrpbTqsowg64yA7JmVIOuPiOqwgOyKpOulvCDtlbTsuZjsmrDrqbAg7ZmU7KCc6rCAIOuQnCDrjIDsi50g66i567CpIO2BrOumrOyXkOydtO2EsOuLpC4g7J207ZuEIOycoO2KnOu4jCDqtazrj4XsnpAgMTAw66eM7J2EIOuEmOq4sOupsCDrjIDtkZwg66i567CpIOycoO2KnOuyhOuhnCDsnpDrpqzsnqHslZjri6QuICfruajqsIQg7J2M7Iud7J20IOyhsO2ajOyImOqwgCDsoovri6Qn64qUIOq3uOydmCDrsJzslrgg65Ox7J20IOuoueuwqSDsl4Xqs4Qg67CI7Jy866GcIO2ajOyekOuQnOuLpC4iLCJzb3VyY2Vfb3JpZ2luIjoiMjAxOeuFhCDslYTtlITrpqzsubRUViDrjbDrt5Qg7ZuEIOycoO2KnOu4jCDrqLnrsKnsnLzroZwg7Iug65Oc66Gs7ZmUIiwic291cmNlX3VzYWdlX25vdGUiOiLrqLnrsKkg7Jyg7Yqc67KEwrfrjIDsi53qsIAg7JaY6riw7ZWgIOuVjCDsgqzsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsiaGVlYmFiIiwi66i567CpIO2eiOuwpSJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOm51bGwsImxvY2FsaXplZF9zbHVnIjoiaGVlYmFiIiwidGl0bGUiOiJoZWViYWIiLCJzdW1tYXJ5IjoiQSBuaWNrbmFtZSBhbmQgbWVtZSBmb3IgYSBmZW1hbGUgWW91VHViZSBmb29kaWUgd2hvIGdhaW5lZCBmYW1lIGluIDIwMTkgZm9yIGhlciBlYXRpbmcgdmlkZW9zIiwiZGVzY3JpcHRpb24iOiJEZWJ1dGVkIG9uIEFmcmVlY2FUViAobm93IFNPT1ApIGluIERlY2VtYmVyIDIwMTksIEhlZWJhYiBiZWNhbWUga25vd24gZm9yIGhlciByYXBpZCBjb25zdW1wdGlvbiBvZiBsYXJnZSBtZWFscywgc3VjaCBhcyB0aGUga2luZy1zaXplZCBjdXRsZXQuIFNoZSBzdXJwYXNzZWQgMSBtaWxsaW9uIHN1YnNjcmliZXJzIG9uIFlvdVR1YmUgYW5kIGlzIHJlY29nbml6ZWQgYXMgb25lIG9mIHRoZSBsZWFkaW5nIGZvb2RpZSBjcmVhdG9ycy4gSGVyIHN0YXRlbWVudCB0aGF0ICdyZWQgZm9vZCBnZXRzIG1vcmUgdmlld3MnIGhhcyBiZWNvbWUgYSBwb3B1bGFyIG1lbWUgaW4gdGhlIGZvb2RpZSBjb21tdW5pdHkuIiwib3JpZ2luIjoiRGVidXRlZCBvbiBBZnJlZWNhVFYgaW4gMjAxOSBhbmQgZ2FpbmVkIHBvcHVsYXJpdHkgdGhyb3VnaCBZb3VUdWJlIGZvb2QgdmlkZW9zIiwidXNhZ2Vfbm90ZSI6IlVzZWQgd2hlbiBkaXNjdXNzaW5nIGZvb2RpZSBZb3VUdWJlcnMgb3IgZ2x1dHRvbnMiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbImhlZWJhYiIsImVhdGluZyBjaGFsbGVuZ2UgaGVlYmFiIl0sInVzYWdlX2V4YW1wbGVzIjpbXSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- 345hhqyt  trend_score=320.59  말하지 않아도 알아요
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiYTkwYjg2MzktMTUxYS00NWVlLTljNWMtNmQ1NzYwMTk1MGM1IiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI2NmE4MGI5NzYwNzc0OWY4MzViNjNmNjEyOWYzOTZhNDY5NDU5YzQ0NjQzNWVmNzAxZmMzNTFmNTVjMWJmOGNmIiwic291cmNlX3RpdGxlIjoi66eQ7ZWY7KeAIOyViuyVhOuPhCDslYzslYTsmpQiLCJzb3VyY2Vfc3VtbWFyeSI6Iuy0iOy9lO2MjOydtCDsoJXsnYQg7IOB7KeV7ZWY64qUIOq1reuvvCBDTeyGoSIsInNvdXJjZV9kZXNjcmlwdGlvbiI6IjE5ODnrhYQg7KCc7J6R64+8IDE5OTDrhYTrjIAg64K064K0IOy0iOy9lO2MjOydtCDqtJHqs6Dsl5Ag7JOw7J24IENN7Iah7Jy866GcLCDsoJUo5oOFKeydtOudvOuKlCDsoJXshJzrpbwg64W4656Y7ZWcIOynp+ydgCDtm4TroLTqtazqsIAg7IS464yA66W8IOuEmOyWtCDqsIHsnbjrkJDri6QuIOydtO2bhCDri6TslpHtlZwg67KE7KCE7Jy866GcIO2OuOqzoeuQmOupsCDsp4DquIjquYzsp4Drj4Qg67iM656c65OcIOynleq4gOuhnCDsk7Dsnbjri6QuIiwic291cmNlX29yaWdpbiI6IuyYpOumrOyYqCDstIjsvZTtjIzsnbQg7KCVIFRWIOq0keqzoCBDTeyGoSgxOTg5fjE5OTDrhYTrjIApIiwic291cmNlX3VzYWdlX25vdGUiOiLsoJUo5oOFKeydtOuCmCDrlLDrnLvtlZwg66eI7J2M7J2EIO2RnO2YhO2VoCDrlYwg7Z2l7Ja86rGw66as65OvIOyduOyaqSIsInNvdXJjZV9jYXV0aW9uIjpudWxsLCJzb3VyY2VfYWxpYXNlcyI6WyLstIjsvZTtjIzsnbQg7KCVIENN7IahIl0sInNvdXJjZV91c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi7Lm07YahIiwidGV4dCI6IuqzoOunmeuLpOuKlCDrp5Ag7JWIIO2VtOuPhCDrp5DtlZjsp4Ag7JWK7JWE64+EIOyVjOyVhOyalCwg7Jqw66asIOyCrOydtOyXkCJ9LHsic2l0dWF0aW9uIjoiU05TIOuMk+q4gCIsInRleHQiOiLsnbQg7J6l66m0IOuztOuLiOq5jCDstIjsvZTtjIzsnbQg7KCVIENN7IahIOuWoOyYpOuluOuLpCJ9XSwibG9jYWxpemVkX3NsdWciOiJtYWxoYWppLWFuaGFuZGFlLWFsbGFlb3lvIiwidGl0bGUiOiJNYWxoYWppIGFuaGFuZGFlIGFsbGFlb3lvIiwic3VtbWFyeSI6IkEgcG9wdWxhciBqaW5nbGUgZnJvbSBhIENob2NvIFBpZSBhZCBjYW1wYWlnbiB0aGF0IHN5bWJvbGl6ZXMgZW1vdGlvbmFsIGNvbm5lY3Rpb24iLCJkZXNjcmlwdGlvbiI6IkEgc2hvcnQgY2hvcnVzIGZyb20gYSBqaW5nbGUgY3JlYXRlZCBpbiAxOTg5IGFuZCB1c2VkIGluIENob2NvIFBpZSBhZHZlcnRpc2VtZW50cyB0aHJvdWdob3V0IHRoZSAxOTkwcy4gVGhlIHNvbmcgZXhwcmVzc2VzIGZlZWxpbmdzIG9mIGFmZmVjdGlvbiBhbmQgaGFzIGJlY29tZSBkZWVwbHkgaW5ncmFpbmVkIGFjcm9zcyBnZW5lcmF0aW9ucy4gSXQgaGFzIGJlZW4gYWRhcHRlZCBpbnRvIHZhcmlvdXMgdmVyc2lvbnMgYW5kIGNvbnRpbnVlcyB0byBiZSB1c2VkIGFzIGEgYnJhbmQgamluZ2xlLiIsIm9yaWdpbiI6IkNob2NvIFBpZSAnSmVvbmcnIFRWIGNvbW1lcmNpYWwgamluZ2xlICgxOTg5LTE5OTBzKSIsInVzYWdlX25vdGUiOiJVc2VkIHRvIGh1bW0gb3IgcXVvdGUgd2hlbiBleHByZXNzaW5nIGFmZmVjdGlvbiBvciB3YXJtdGgiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIkNob2NvIFBpZSBKZW9uZyBDTSBzb25nIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJLYWthb1RhbGsiLCJ0ZXh0IjoiRXZlbiB3aXRob3V0IHNheWluZyAndGhhbmsgeW91LCcgSSBrbm93IGl0LCBvdXIgZmVlbGluZ3Mgc3BlYWsgZm9yIHRoZW1zZWx2ZXMifSx7InNpdHVhdGlvbiI6IlNOUyBjb21tZW50IiwidGV4dCI6IlRoaXMgc2NlbmUgcmVtaW5kcyBtZSBvZiB0aGUgQ2hvY28gUGllIEplb25nIENNIHNvbmcifV0sIm1vZGVsIjoibWx4LWNvbW11bml0eS9Rd2VuMi41LTE0Qi1JbnN0cnVjdC00Yml0In0=', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- uskrnffh  trend_score=320.59  나야나(프로듀스101)
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiYjU0ZTM5NDQtOWRlZS00ZjRlLThiYTQtY2IwODc3ODcxMWIyIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI4ZTljMTBhN2U2NTExZjFlZDMxZWY3Y2MyYmRhOGI2YzQxZGU4NmIyNWNkY2QyMjQyNmVlODc1ZTI0MDJlYTJlIiwic291cmNlX3RpdGxlIjoi64KY7JW864KYKO2UhOuhnOuTgOyKpDEwMSkiLCJzb3VyY2Vfc3VtbWFyeSI6Iu2UhOuhnOuTgOyKpDEwMSDsi5zspowyIOyjvOygnOqzoeydtOyekCDqta3rr7wg67CI7J20IOuQnCDqs6EiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiJNbmV0IOyEnOuwlOydtOuyjCDtlITroZzqt7jrnqgg7ZSE66Gc65OA7IqkMTAxIOyLnOymjDIoMjAxNynsnZgg7KO87KCc6rOh7Jy866GcIOyXsOyKteyDneuTpOydtCAn64KY7JW8IOuCmCfrpbwg7Jm47LmY66mwIOyekOyLoOydhCDslrTtlYTtlZjripQg7JWI66y06rCAIO2ZlOygnOqwgCDrkJDri6QuIO2KueycoOydmCDqs7zsnqXrkJwg7ZGc7KCV6rO8IOuquOynk+ydtCDqsIHsooUg7Yyo65+s65SU7JmAIO2VqeyEsSDsp6TroZwg7J6s7IOd7IKw65CY66mwIDIwMTfrhYQg64yA7ZGc7KCB7J24IOyYiOuKpcK37J247YSw64S3IOuwiOydtCDrkJDri6QuIiwic291cmNlX29yaWdpbiI6IjIwMTfrhYQgTW5ldCDtlITroZzrk4DsiqQxMDEg7Iuc7KaMMiDrsKnsmIHsnYQg6rOE6riw66GcIO2ZleyCsCIsInNvdXJjZV91c2FnZV9ub3RlIjoi7J6Q6riwIOyWtO2VhOydtOuCmCDshKDtg53snYQg67CU652864qUIOyDge2ZqeydhCDsnKDsvoztlZjqsowg7ZGc7ZiE7ZWgIOuVjCDsgqzsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsiUElDSyBNRSIsIuuCmOyVvCDrgpgiXSwic291cmNlX3VzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiLsubTthqEiLCJ0ZXh0Ijoi64KY7JW8IOuCmCEg7J2067KI7JeUIOuCtOqwgCDrvZHtnpAg7LCo66GA7JW844WL44WLIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuydtCDslrTtlYQg7JmE7KCEIOuCmOyVvOuCmHN064ukIn1dLCJsb2NhbGl6ZWRfc2x1ZyI6Im5heWEtbmEtcHJvZHVjZTEwMSIsInRpdGxlIjoiTmF5YSBOYSAoUHJvZHVjZTEwMSkiLCJzdW1tYXJ5IjoiQSBzb25nIGZyb20gUHJvZHVjZTEwMSBTZWFzb24gMiB0aGF0IGJlY2FtZSBhIHBvcHVsYXIgbWVtZSIsImRlc2NyaXB0aW9uIjoiVGhlIHNvbmcgJ05heWEgTmEnIGZyb20gTW5ldCdzIHN1cnZpdmFsIHByb2dyYW0gUHJvZHVjZTEwMSBTZWFzb24gMiAoMjAxNykgYmVjYW1lIGZhbW91cyB3aGVuIHRyYWluZWVzIHVzZWQgaXQgdG8gc2hvd2Nhc2UgdGhlbXNlbHZlcy4gVGhlIGV4YWdnZXJhdGVkIGV4cHJlc3Npb25zIGFuZCBkYW5jZSBtb3ZlcyB3ZXJlIHBhcm9kaWVkIGFuZCByZW1peGVkIGludG8gdmFyaW91cyBtZW1lcywgbWFraW5nIGl0IG9uZSBvZiB0aGUgbW9zdCBwb3B1bGFyIG1lbWVzIGluIEtvcmVhIGluIDIwMTcuIiwib3JpZ2luIjoiU3ByZWFkIGFzIGEgcmVzdWx0IG9mIE1uZXQncyBQcm9kdWNlMTAxIFNlYXNvbiAyIGFpcmluZyBpbiAyMDE3IiwidXNhZ2Vfbm90ZSI6IlVzZWQgdG8gZXhwcmVzcyBzZWxmLXByb21vdGlvbiBvciBkZXNpcmUgZm9yIHNlbGVjdGlvbiBpbiBhIGxpZ2h0aGVhcnRlZCBtYW5uZXIiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIlBJQ0sgTUUiLCJOYXlhIE5hIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJLYWthb1RhbGsiLCJ0ZXh0IjoiTmF5YSBOYSEgSXQncyBteSB0dXJuIHRvIGJlIHBpY2tlZCB0aGlzIHRpbWUhIDpEIn0seyJzaXR1YXRpb24iOiJTTlMgY29tbWVudCIsInRleHQiOiJUaGlzIHNlbGYtcHJvbW90aW9uIGlzIHRvdGFsbHkgTmF5YSBOYSEifV0sIm1vZGVsIjoibWx4LWNvbW11bml0eS9Rd2VuMi41LTE0Qi1JbnN0cnVjdC00Yml0In0=', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- g2s5d2v6  trend_score=320.59  브라운아이드걸스 하우컴 레트로댄스
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiZDgyYjY2YTgtMjVlYS00MjM4LWE0OGItMWY4ZWJiMDg2MmUyIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJkMWIzOGIxN2NmNWMyNmYwMDY4ZjQ2NjM5MmNjYjdlZWRlMTBmODllMmRlNTE3MTFkMjIxYWJlN2QwY2NmMzU0Iiwic291cmNlX3RpdGxlIjoi67iM65287Jq07JWE7J2065Oc6rG47IqkIO2VmOyasOy7tCDroIjtirjroZzrjITsiqQiLCJzb3VyY2Vfc3VtbWFyeSI6IuugiO2KuOuhnO2SjSDruIzslYTqsbggSG93IENvbWUg7JWI66y07JmAIOugiOq5heyKpCDsnKDtlokiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiIyMDA464WEIOuwnOunpOuQnCDruIzrnbzsmrTslYTsnbTrk5zqsbjsiqTsnZggJ0hvdyBDb21lJ+ydgCDrs7Xqs6Dtko0g64yE7Iqk6rOh7Jy866GcIOq3uOujueydmCDsnbTrr7jsp4DrpbwgUiZCIOuztOy7rO2MgOyXkOyEnCDrjITsiqTtjIDsnLzroZwg67CU6r68IOyghO2ZmOygkOydtCDrkJDqs6AsIOustOuMgCDsnZjsg4HsnZgg66CI6rmF7IqkIO2MqOyFmOydtCDsnKDtlontlojri6QuIiwic291cmNlX29yaWdpbiI6Iuu4jOudvOyatOyVhOydtOuTnOqxuOyKpCDrr7jri4jslajrspQgJ015IFN0eWxlJyDtg4DsnbTti4Dqs6Eg7JWI66y0Iiwic291cmNlX3VzYWdlX25vdGUiOiIyMDA464WEIOugiO2KuOuhnCDrjITsiqQg7Jyg7ZaJIOyCrOuhgOuhnCDslrjquIkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsiSG93IENvbWUg64yE7IqkIl0sInNvdXJjZV91c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoi7Lm07YahIiwidGV4dCI6IuugiOq5heyKpCDtjKjshZgg7JmE7KCEIO2VmOyasOy7tCDsi5zsoIhzdCJ9LHsic2l0dWF0aW9uIjoiU05TIOuMk+q4gCIsInRleHQiOiLrs7Xqs6Ag64yE7IqkIO2VmOuptCDtlZjsmrDsu7TsnbTsp4AifV0sImxvY2FsaXplZF9zbHVnIjoiYnJvd24tZXllZC1naXJscy1ob3ctY29tZS1yZXRyby1kYW5jZSIsInRpdGxlIjoiQnJvd24gRXllZCBHaXJscyBIb3cgQ29tZSBSZXRybyBEYW5jZSIsInN1bW1hcnkiOiJBIHJldHJvIGRhbmNlIHN0eWxlIGZyb20gQnJvd24gRXllZCBHaXJscycgJ0hvdyBDb21lJyBhbmQgdGhlIGFzc29jaWF0ZWQgZmFzaGlvbiB0cmVuZCIsImRlc2NyaXB0aW9uIjoiSW4gMjAwOCwgQnJvd24gRXllZCBHaXJscyByZWxlYXNlZCAnSG93IENvbWUsJyBhIHJldHJvIGRhbmNlIHNvbmcgdGhhdCBtYXJrZWQgYSBzaGlmdCBpbiB0aGUgZ3JvdXAncyBpbWFnZSBmcm9tIGFuIFImQiB2b2NhbCB0ZWFtIHRvIGEgZGFuY2UgdGVhbS4gVGhlIGRhbmNlIHJvdXRpbmUgYW5kIHRoZSBncm91cCdzIHN0YWdlIG91dGZpdHMsIHdoaWNoIGZlYXR1cmVkIGxlZ2dpbmdzLCBiZWNhbWUgcG9wdWxhci4iLCJvcmlnaW4iOiJEYW5jZSByb3V0aW5lIGZyb20gQnJvd24gRXllZCBHaXJscycgbWluaSBhbGJ1bSAnTXkgU3R5bGUnIHRpdGxlIHRyYWNrIiwidXNhZ2Vfbm90ZSI6IkNpdGVkIGFzIGFuIGV4YW1wbGUgb2YgdGhlIHJldHJvIGRhbmNlIHRyZW5kIGluIDIwMDgiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIkhvdyBDb21lIERhbmNlIl0sInVzYWdlX2V4YW1wbGVzIjpbeyJzaXR1YXRpb24iOiJLYWthb1RhbGsiLCJ0ZXh0IjoiTGVnZ2luZ3MgZmFzaGlvbiBpcyB0b3RhbGx5IEhvdyBDb21lIGVyYSJ9LHsic2l0dWF0aW9uIjoiU05TIGNvbW1lbnQiLCJ0ZXh0IjoiV2hlbiBpdCBjb21lcyB0byByZXRybyBkYW5jZSwgaXQncyBIb3cgQ29tZSJ9XSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- 5qw2ggqg  trend_score=320.59  회상(터보)
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiZGJmZjFkNWItZTZkNi00ZmNkLTk1NjQtNDhjNGNlNmRlMWU0IiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiI1YzQ2N2Y1NzBkYjRkNmFlNjZmMGMyNGI3MTcxMmQ4OTYxYTQ2OGNkNzUzMmEyYTI1Zjg5OTYzYTM3OWY1YzNhIiwic291cmNlX3RpdGxlIjoi7ZqM7IOBKO2EsOuztCkiLCJzb3VyY2Vfc3VtbWFyeSI6Iu2EsOuztOydmCDqsqjsmrgg7Z6I7Yq46rOhLCDsoIjsoIjtlZwg6rCA7IKs7JmAIOyViOustOqwgCDsnbjquLAiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiIxOTk364WEIOuwnOunpOuQnCDthLDrs7QgM+ynkSAnQm9ybiBBZ2FpbifsnZgg7ZuE7IaN6rOhICftmozsg4EoRGVjZW1iZXIpJ+ydgCDslaDsoIjtlZwg66mc66Gc65SU7JmAIOustOuMgCDtjbztj6zrqLzsiqTroZwg7YGwIOyduOq4sOulvCDslrvsl4jri6QuIOqyqOyauOyyoOydtOuptCDrsKnshqHCt+qxsOumrOyXkOyEnCDrsJjrs7Ug7J6s7IOd65CY642YIDkw64WE64yAIOuMgO2RnCDrsJzrnbzrk5wg64yE7Iqk6rOhIOykkSDtlZjrgpjri6QuIiwic291cmNlX29yaWdpbiI6Iu2EsOuztCAz7KeRICdCb3JuIEFnYWluJyDtm4Tsho3qs6EoMTk5Ny4xMCkiLCJzb3VyY2VfdXNhZ2Vfbm90ZSI6IuyXsOunkMK36rKo7Jq4IOqwkOyEseydhCDsnbTslbzquLDtlaAg65WMIOugiO2KuOuhnCDqs6HsnLzroZwg7J247JqpIiwic291cmNlX2NhdXRpb24iOm51bGwsInNvdXJjZV9hbGlhc2VzIjpbIu2EsOuztCDtmozsg4EiLCJEZWNlbWJlciJdLCJzb3VyY2VfdXNhZ2VfZXhhbXBsZXMiOlt7InNpdHVhdGlvbiI6Iuy5tO2GoSIsInRleHQiOiLqsqjsmrgg65CY64uI6rmMIO2EsOuztCDtmozsg4Eg7J6Q64+Z7J6s7IOd65Cc64ukIn0seyJzaXR1YXRpb24iOiJTTlMg64yT6riAIiwidGV4dCI6IuydtCDqsJDshLEg6re4IOyLnOygiCDqsqjsmrgg6re4IOyekOyytOuLpCJ9XSwibG9jYWxpemVkX3NsdWciOiJob2VzYW5nLXR1cmJvIiwidGl0bGUiOiJIb2VzYW5nKFR1cmJvKSIsInN1bW1hcnkiOiJBIHBvcHVsYXIgYmFsbGFkIGRhbmNlIHNvbmcgYnkgVHVyYm8sIGtub3duIGZvciBpdHMgZW1vdGlvbmFsIGx5cmljcyBhbmQgY2hvcmVvZ3JhcGh5IiwiZGVzY3JpcHRpb24iOiJSZWxlYXNlZCBpbiAxOTk3IGFzIGEgZm9sbG93LXVwIHRvIFR1cmJvJ3MgdGhpcmQgYWxidW0gJ0Jvcm4gQWdhaW4nLCAnSG9lc2FuZyhEZWNlbWJlciknIGdhaW5lZCBpbW1lbnNlIHBvcHVsYXJpdHkgZHVlIHRvIGl0cyBwb2lnbmFudCBtZWxvZHkgYW5kIHN0YWdlIHBlcmZvcm1hbmNlLiBJdCB3YXMgZnJlcXVlbnRseSBwbGF5ZWQgZHVyaW5nIHdpbnRlciBtb250aHMgb24gYnJvYWRjYXN0cyBhbmQgaW4gcHVibGljIHNwYWNlcywgbWFraW5nIGl0IG9uZSBvZiB0aGUgcmVwcmVzZW50YXRpdmUgYmFsbGFkIGRhbmNlIHNvbmdzIG9mIHRoZSA5MHMuIiwib3JpZ2luIjoiRm9sbG93LXVwIHNvbmcgdG8gVHVyYm8ncyB0aGlyZCBhbGJ1bSAnQm9ybiBBZ2FpbicgKDE5OTcuMTApIiwidXNhZ2Vfbm90ZSI6Ik9mdGVuIHJlZmVyZW5jZWQgYXMgYSByZXRybyBzb25nIHdoZW4gZGlzY3Vzc2luZyB3aW50ZXIgb3IgZW5kLW9mLXllYXIgZW1vdGlvbnMiLCJjYXV0aW9uIjpudWxsLCJhbGlhc2VzIjpbIlR1cmJvIEhvZXNhbmciLCJEZWNlbWJlciJdLCJ1c2FnZV9leGFtcGxlcyI6W3sic2l0dWF0aW9uIjoiS2FrYW9UYWxrIiwidGV4dCI6Ikl0IGF1dG9tYXRpY2FsbHkgcGxheXMgVHVyYm8gSG9lc2FuZyB3aGVuIHdpbnRlciBjb21lcyJ9LHsic2l0dWF0aW9uIjoiU05TIGNvbW1lbnQiLCJ0ZXh0IjoiVGhpcyBlbW90aW9uIGlzIHRoZSBlc3NlbmNlIG9mIHRoYXQgd2ludGVyIGJhY2sgdGhlbiJ9XSwibW9kZWwiOiJtbHgtY29tbXVuaXR5L1F3ZW4yLjUtMTRCLUluc3RydWN0LTRiaXQifQ==', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

-- 7jwfbdck  trend_score=317.82  아기상어 (핑크퐁)
with input as (
  select *
    from jsonb_to_record(
      convert_from(decode('eyJtZW1lX2lkIjoiZmVlZDZkZmEtYjA3My00NmI3LTk2OTQtZTI4MWYzMzA3ZTZkIiwibG9jYWxlIjoiZW4iLCJzb3VyY2VfdXBkYXRlZF9hdCI6IjIwMjYtMDctMTUgMTU6MzA6MDAuMTkxMzczKzAwIiwic291cmNlX3NuYXBzaG90X2hhc2giOiJlNDM1NmVmNDM1M2MzMjVhMWFhNjFjMmM2NDJkNjU3MTJlMGUyMjRkNzFjODg4NGMzMDliYzFiNmJhNDM5MmFkIiwic291cmNlX3RpdGxlIjoi7JWE6riw7IOB7Ja0ICjtlZHtgaztkIEpIiwic291cmNlX3N1bW1hcnkiOiLsiqTrp4jtirjsiqTthLDrlJTsnZgg7ZWR7YGs7ZCB7J20IOunjOuToCDrj5nsmpTqsIAg6rWt64K07Jm47JeQ7IScIO2PreuwnOyggeycvOuhnCDtnaXtlontlZwg7Jyg7JWEIOy9mO2FkOy4oCDrsIgiLCJzb3VyY2VfZGVzY3JpcHRpb24iOiLrr7jqta0g6rWs7KCEIOuPmeyalOulvCDsm5DtmJXsnLzroZwg7Iqk66eI7Yq47Iqk7YSw65SUKO2Vke2BrO2QgSnqsIAg7Y646rOhwrfslYjrrLTrpbwg67aZ7JesIDIwMTXrhYQgMTHsm5Qg6rWt66y4IOuyhOyghOydhCwgMjAxNuuFhCA27JuUIOyViOustOqwgCDstpTqsIDrkJwg7JiB66y4IOuyhOyghOydhCDsnKDtipzruIzsl5Ag6rO16rCc7ZaI64ukLiDspJHrj4XshLEg7J6I64qUIO2bhOugtOq1rOyZgCDsnKjrj5nsnbQg7Ja066aw7J2065OkIOyCrOydtOyXkOyEnCDtj63rsJzsoIEg7J246riw66W8IOuBjOupsCAyMDE264WEIOq1reuCtCDsnKDtipzruIwg7LWc64ukIOyhsO2ajCDsmIHsg4EgMeychCwgM+uMgCDsnYzsm5DsgqzsnbTtirgg64+Z7JqUIOywqO2KuCAx7JyE7JeQIOyYrOuekOuLpC4iLCJzb3VyY2Vfb3JpZ2luIjoiMjAxNeuFhCAxMeyblCDsiqTrp4jtirjsiqTthLDrlJQo7ZWR7YGs7ZCBKSDqta3rrLgg67KE7KCEIOqzteqwnCwgMjAxNuuFhCA27JuUIOyYgeusuCDslYjrrLQg67KE7KCEIOqzteqwnCIsInNvdXJjZV91c2FnZV9ub3RlIjoi6rCA7KGxwrfslrTrprDsnbQg7L2Y7YWQ7Lig7JeQ7IScIOy5nOq3vO2VmOqyjCDsnbjsmqkiLCJzb3VyY2VfY2F1dGlvbiI6bnVsbCwic291cmNlX2FsaWFzZXMiOlsi7ZWR7YGs7ZCBIOyVhOq4sOyDgeyWtCIsIkJhYnkgU2hhcmsiLCLsg4HslrTqsIDsobEiXSwic291cmNlX3VzYWdlX2V4YW1wbGVzIjpudWxsLCJsb2NhbGl6ZWRfc2x1ZyI6ImJhYnktc2hhcmstcGlua2ZvbmciLCJ0aXRsZSI6IkJhYnkgU2hhcmsgKFBpbmtmb25nKSIsInN1bW1hcnkiOiJBIGNoaWxkcmVuJ3MgY29udGVudCBtZW1lIGNyZWF0ZWQgYnkgUGlua2ZvbmcgdGhhdCBleHBsb2RlZCBpbiBwb3B1bGFyaXR5IGJvdGggaW4gS29yZWEgYW5kIGludGVybmF0aW9uYWxseSIsImRlc2NyaXB0aW9uIjoiUGlua2ZvbmcsIGEgY29tcGFueSBrbm93biBmb3IgUGlua2ZvbmcsIGFkYXB0ZWQgYSB0cmFkaXRpb25hbCBBbWVyaWNhbiBudXJzZXJ5IHJoeW1lIGFuZCBhZGRlZCBjaG9yZW9ncmFwaHkgdG8gY3JlYXRlIGEgY2F0Y2h5IGNoaWxkcmVuJ3Mgc29uZy4gVGhlIEtvcmVhbiB2ZXJzaW9uIHdhcyByZWxlYXNlZCBpbiBOb3ZlbWJlciAyMDE1LCBmb2xsb3dlZCBieSBhbiBFbmdsaXNoIHZlcnNpb24gd2l0aCBjaG9yZW9ncmFwaHkgaW4gSnVuZSAyMDE2LiBUaGUgc29uZydzIGFkZGljdGl2ZSBjaG9ydXMgYW5kIGRhbmNlIG1vdmVzIGJlY2FtZSBleHRyZW1lbHkgcG9wdWxhciBhbW9uZyBjaGlsZHJlbiwgcmVhY2hpbmcgdGhlIHRvcCBzcG90IG9uIHRoZSBLb3JlYW4gWW91VHViZSB2aWV3cyBjaGFydCBhbmQgdGhlIHRvcCBvZiB0aGUgY2hpbGRyZW4ncyBtdXNpYyBjaGFydHMgb24gdGhyZWUgbWFqb3IgS29yZWFuIG11c2ljIHBsYXRmb3Jtcy4iLCJvcmlnaW4iOiJOb3ZlbWJlciAyMDE1LCBLb3JlYW4gdmVyc2lvbiByZWxlYXNlZCBieSBQaW5rZm9uZywgSnVuZSAyMDE2LCBFbmdsaXNoIHZlcnNpb24gd2l0aCBjaG9yZW9ncmFwaHkgcmVsZWFzZWQiLCJ1c2FnZV9ub3RlIjoiT2Z0ZW4gcmVmZXJlbmNlZCBpbiBmYW1pbHkgYW5kIGNoaWxkcmVuJ3MgY29udGVudCIsImNhdXRpb24iOm51bGwsImFsaWFzZXMiOlsiUGlua2ZvbmcgQmFieSBTaGFyayIsIlNoYXJrIEZhbWlseSJdLCJ1c2FnZV9leGFtcGxlcyI6W10sIm1vZGVsIjoibWx4LWNvbW11bml0eS9Rd2VuMi41LTE0Qi1JbnN0cnVjdC00Yml0In0=', 'base64'), 'utf8')::jsonb
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
      model text
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
    'mlx',
    model,
    11,
    now(),
    null,
    null
  from locked
  on conflict (meme_id, locale) do nothing
  returning meme_id
)
select count(*)::int as inserted_count from inserted;

