-- After a replica-mode load, foreign keys were not checked. Fail if any
-- public or auth foreign key has an orphan row. MATCH SIMPLE: a row with a
-- null key column is not a violation.
DO $$
DECLARE
  fk record;
  missing bigint;
  child_cols text;
  child_pred text;
  parent_cols text;
BEGIN
  FOR fk IN
    SELECT con.oid,
           con.conname,
           con.conrelid,
           con.confrelid,
           con.conkey,
           con.confkey
      FROM pg_constraint con
      JOIN pg_namespace n ON n.oid = con.connamespace
     WHERE con.contype = 'f'
       AND n.nspname IN ('public', 'auth')
  LOOP
    SELECT string_agg(format('child.%I', a.attname), ', ' ORDER BY cols.ord),
           string_agg(format('child.%I IS NOT NULL', a.attname), ' AND ' ORDER BY cols.ord)
      INTO child_cols, child_pred
      FROM unnest(fk.conkey) WITH ORDINALITY AS cols(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = cols.attnum;

    SELECT string_agg(format('parent.%I', a.attname), ', ' ORDER BY cols.ord)
      INTO parent_cols
      FROM unnest(fk.confkey) WITH ORDINALITY AS cols(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = fk.confrelid AND a.attnum = cols.attnum;

    EXECUTE format(
      'SELECT count(*) FROM %s AS child WHERE %s AND NOT EXISTS (SELECT 1 FROM %s AS parent WHERE (%s) = (%s))',
      fk.conrelid::regclass,
      child_pred,
      fk.confrelid::regclass,
      parent_cols,
      child_cols
    ) INTO missing;

    IF missing > 0 THEN
      RAISE EXCEPTION 'memecatch: foreign key % on % has % orphan row(s)',
        fk.conname, fk.conrelid::regclass, missing;
    END IF;
  END LOOP;
END $$;
