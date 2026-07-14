-- 공개 임베드 URL을 출처 테이블에도 정규화한다.
--
-- meme_contents는 재생용 URL을 보유하지만, 과거 데이터의 meme_sources는
-- 나무위키 같은 맥락 링크만 보유한 경우가 있다. 이 쿼리는 실제 공개 콘텐츠
-- URL을 같은 밈의 출처로 추가해 상세·목록 출처가 일관되게 실제 콘텐츠를
-- 가리키도록 한다. 이미 연결된 URL은 건너뛰므로 안전하게 재실행할 수 있다.

insert into meme_sources (meme_id, platform, source_url, copyright_status)
select
  content.meme_id,
  coalesce(content.platform, 'Community'),
  content.url,
  'embeddable'::copyright_status
from meme_contents as content
where content.url is not null
  and not exists (
    select 1
    from meme_sources as source
    where source.meme_id = content.meme_id
      and source.source_url = content.url
  );
