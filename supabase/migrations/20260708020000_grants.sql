-- GRANT 계층 (레인 B/D 발견 42501 해결)
-- 원칙: GRANT는 열고, 행 접근은 RLS가 지킨다.
grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated;
grant all on all sequences in schema public to service_role;

grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant all on sequences to service_role;

-- 운영자의 discussions 숨김/해제 및 감사 로그 기록을 RLS로도 허용
-- (레인 D가 service-role 우회로 처리한 부분의 정식 경로)
create policy discussions_operator_update on discussions for update
  using (is_operator()) with check (is_operator());
create policy audit_operator_insert on admin_audit_log for insert
  with check (is_operator());
