alter table memes add column if not exists usage_examples jsonb;

alter table memes
  drop constraint if exists memes_usage_examples_is_array;

alter table memes
  add constraint memes_usage_examples_is_array
  check (usage_examples is null or jsonb_typeof(usage_examples) = 'array');
;
