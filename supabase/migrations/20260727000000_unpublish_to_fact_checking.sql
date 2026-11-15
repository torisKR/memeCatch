-- 게시 밈의 검수 되돌리기 경로 추가 (approved/limited → fact_checking)
-- 배경: 게시 중인 밈에 출처·사실 확인 문제가 뒤늦게 발견되면(예: 맥락 주의 밈의 SNS 출처 부재)
--       공개를 내리고 다시 검수할 수 있어야 한다. 기존 규칙은 approved → limited → rejected(종결)뿐이라
--       되돌릴 수 있는 비공개 경로가 없었다.
-- fact_checking은 공개 읽기 정책(approved/limited만 허용)에 포함되지 않으므로 비공개가 되고,
-- /admin/memes?status=fact_checking 에서 이어서 검수할 수 있다.
create or replace function check_moderation_transition() returns trigger
language plpgsql as $$
begin
  if old.moderation_status = new.moderation_status then return new; end if;
  if not (
    (old.moderation_status = 'pending' and new.moderation_status in ('fact_checking','rejected')) or
    (old.moderation_status = 'fact_checking' and new.moderation_status in ('rights_checking','rejected','pending')) or
    (old.moderation_status = 'rights_checking' and new.moderation_status in ('approved','limited','rejected','fact_checking')) or
    (old.moderation_status = 'limited' and new.moderation_status in ('approved','rejected','fact_checking')) or
    (old.moderation_status = 'approved' and new.moderation_status in ('limited','fact_checking'))
  ) then
    raise exception 'invalid moderation transition: % -> %', old.moderation_status, new.moderation_status;
  end if;
  if new.moderation_status in ('approved','limited') and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;
