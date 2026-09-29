-- Run after the Fairy foundation and PR32 migrations in a rollback-only transaction.
do $$
declare
  v_user uuid := gen_random_uuid();
  v_old uuid;
  v_new uuid;
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (v_user, v_user::text || '@example.invalid', now(), '{}'::jsonb, now(), now());
  v_old := public.create_fairy_billing_intent(v_user, 'memecatch', 1000);
  update public.fairy_billing_intents
     set created_at = now() - interval '40 minutes', expires_at = now() - interval '10 minutes'
   where id = v_old;
  v_new := public.create_fairy_billing_intent(v_user, 'memecatch', 1000);
  if v_new = v_old or exists (select 1 from public.fairy_billing_intents where id = v_old) then
    raise exception 'Expected PR32 to replace and delete expired intent';
  end if;
  begin
    perform public.process_fairy_payment('local-delayed-repro-' || v_user::text, 'memecatch', v_old, 1000, now() - interval '20 minutes');
    raise exception 'Expected delayed payment rejection was not reproduced';
  exception when sqlstate '22023' then
    if sqlerrm <> 'unknown_intent' then raise; end if;
    raise notice 'REPRODUCED: valid delayed payment loses reconciliation key after checkout retry';
  end;
end;
$$;
