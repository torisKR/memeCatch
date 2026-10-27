-- 2026-10-27 운영 DB 전용: 갑툭튀·레게노의 연도 칸 정정 (설명 정정과 맞춤)
-- 바꾸는 칸: origin_year, korea_viral_year, year_precision 만.
-- 바꾸기 전 값: data/memes/backup/20261027-prod-2-before-year-fix.json
-- 근거: 나무위키 '갑툭튀'(2003년경 신혜성이 공식 홈페이지 게시판에서 사용), 'LEGENO'(2020년 유행, 2020년 중반 식음)
do $migration$
begin

update memes set origin_year = 2003, korea_viral_year = 2005, year_precision = 'approximate'
where id = '17fb266c-9ee8-48d6-8d4b-95363fbd3855' and title = '갑툭튀';

update memes set origin_year = 2019, korea_viral_year = 2020, year_precision = 'approximate'
where id = '12561d8c-5aac-44c7-9303-16ba8633128d' and title = '레게노';

-- 원문이 바뀌면 번역이 stale 처리되므로, 이번 작업에서 넣은 en 번역만 새 원문 시점으로 다시 맞춘다.
update meme_translations t
set status = 'reviewed', source_updated_at = m.updated_at, reviewed_at = now(),
    reviewed_by = (select id from profiles where role = 'operator' order by created_at limit 1)
from memes m
where t.meme_id = m.id and t.locale = 'en' and t.provider = 'editorial' and t.model = 'human'
  and m.id in ('17fb266c-9ee8-48d6-8d4b-95363fbd3855', '12561d8c-5aac-44c7-9303-16ba8633128d');

end
$migration$;
