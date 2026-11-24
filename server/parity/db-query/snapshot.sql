-- Helpers db-query.mjs uses on its THROWAWAY database, as a superuser:
-- `parity.save()` copies every table of `public` and `private` (and their
-- sequences) into the schema `parity_copy`; `parity.restore()` puts back
-- the tables that changed since; `parity.digest()` names each table with its
-- row count and a hash of its rows, leaving out the columns a write fills
-- differently on each run (timestamps, random ids). The servers never see
-- these schemas: the plan compiler reads `public` only.
--
-- better-auth's tables are left alone: a session row moves when Next
-- extends it, and neither restore nor digest should care.
create schema if not exists parity;

create or replace function parity.tables() returns table (nsp text, rel text)
language sql stable as $$
  select n.nspname::text, c.relname::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private') and c.relkind = 'r'
     and not (n.nspname = 'public' and c.relname in ('user', 'session', 'account', 'verification'))
   order by 1, 2
$$;

create or replace function parity.columns(p_nsp text, p_rel text, p_stable boolean) returns text
language sql stable as $$
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where n.nspname = p_nsp and c.relname = p_rel and a.attnum > 0 and not a.attisdropped
     and a.attgenerated = ''
     and (not p_stable or (
       a.atttypid not in ('timestamptz'::regtype, 'timestamp'::regtype)
       and coalesce(pg_get_expr(d.adbin, d.adrelid), '') not like '%gen_random_uuid%'))
$$;

create or replace function parity.save() returns void language plpgsql as $$
declare t record;
begin
  drop schema if exists parity_copy cascade;
  create schema parity_copy;
  for t in select * from parity.tables() loop
    execute format('create table parity_copy.%I as select * from %I.%I', t.nsp || '.' || t.rel, t.nsp, t.rel);
  end loop;
  create table parity_copy.sequences as
    select format('%I.%I', schemaname, sequencename) as name, last_value, last_value is not null as called
      from pg_sequences where schemaname in ('public', 'private');
end $$;

create or replace function parity.table_hash(p_nsp text, p_rel text, p_from text, p_stable boolean) returns text
language plpgsql as $$
declare cols text := parity.columns(p_nsp, p_rel, p_stable); result text;
begin
  if cols is null then return 'no columns'; end if;
  execute format('select count(*) || '' '' || coalesce(md5(string_agg(r, E''\n'' order by r)), ''-'')
                    from (select row(%s)::text as r from %s) rows', cols, p_from)
    into result;
  return result;
end $$;

create or replace function parity.restore() returns integer language plpgsql as $$
declare t record; s record; cols text; restored integer := 0;
begin
  set local session_replication_role = replica;
  for t in select * from parity.tables() loop
    if parity.table_hash(t.nsp, t.rel, format('%I.%I', t.nsp, t.rel), false)
       is distinct from parity.table_hash(t.nsp, t.rel, format('parity_copy.%I', t.nsp || '.' || t.rel), false) then
      cols := parity.columns(t.nsp, t.rel, false);
      execute format('delete from %I.%I', t.nsp, t.rel);
      execute format('insert into %I.%I (%s) overriding system value select %s from parity_copy.%I',
                     t.nsp, t.rel, cols, cols, t.nsp || '.' || t.rel);
      restored := restored + 1;
    end if;
  end loop;
  for s in select * from parity_copy.sequences loop
    if s.called then
      perform setval(s.name, s.last_value, true);
    else
      perform setval(s.name, (select start_value from pg_sequences where format('%I.%I', schemaname, sequencename) = s.name), false);
    end if;
  end loop;
  return restored;
end $$;

create or replace function parity.digest() returns table (rel text, digest text) language plpgsql as $$
declare t record;
begin
  for t in select * from parity.tables() loop
    rel := t.nsp || '.' || t.rel;
    digest := parity.table_hash(t.nsp, t.rel, format('%I.%I', t.nsp, t.rel), true);
    return next;
  end loop;
end $$;

-- The rows of one table without the volatile columns, to show a difference.
create or replace function parity.rows(p_nsp text, p_rel text) returns setof text language plpgsql as $$
begin
  return query execute format('select row(%s)::text from %I.%I order by 1', parity.columns(p_nsp, p_rel, true), p_nsp, p_rel);
end $$;
