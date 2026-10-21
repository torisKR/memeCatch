-- One reviewed correction, not a bulk correction or automatic publisher.
-- Read-only before/after snapshot and rollback fields live in admin_audit_log.
-- A stale record, changed card binding, or unexpected existing media causes 0 writes.
WITH target AS MATERIALIZED (
  SELECT m.id, jsonb_build_object(
    'summary',m.summary,'description',m.description,'origin',m.origin,
    'aliases',m.aliases,'updated_at',m.updated_at
  ) AS before
  FROM public.memes m
  WHERE m.id = 'dbe93730-0dbd-4ef0-a318-92c7e775caf3'
    AND m.short_id = '89b37mrx'
    AND m.title = '새삥 챌린지 (지코)'
    AND m.updated_at = '2026-07-21T01:57:30.257416+00:00'::timestamptz
    AND m.moderation_status = 'approved' AND m.safety_level = 'green'
    AND m.published_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.meme_collectible_cards c
      WHERE c.id='mc-0012' AND c.meme_id=m.id AND c.card_no=12
        AND c.edition=1 AND c.art_seed=1381021653 AND c.active)
    AND NOT EXISTS (SELECT 1 FROM public.meme_sources s WHERE s.meme_id=m.id)
    AND NOT EXISTS (SELECT 1 FROM public.meme_contents c WHERE c.meme_id=m.id)
  FOR UPDATE OF m
), corrected AS (
  UPDATE public.memes m SET
    summary = 'Mnet 스트릿 맨 파이터 리더 계급 미션곡 ‘새삥’ 안무를 따라 하는 댄스 챌린지',
    description = '‘새삥 챌린지’는 Mnet 스트릿 맨 파이터 리더 계급 미션곡 ‘새삥 (Prod. ZICO) (Feat. 호미들)’의 안무를 따라 하는 댄스 챌린지다. The CHOOM 공식 댄스 비디오는 안무가를 위댐보이즈 바타로 표기하며, 바타가 알려주는 공식 안무 튜토리얼도 공개되어 있다.' || E'\n\n' || 'CJ 공식 뉴스룸은 이 곡의 댄스 비디오와 지코 등 아티스트의 챌린지 참여를 소개한다. 곡을 듣고 감상하는 콘텐츠와 안무를 따라 하는 챌린지는 구분해서 설명한다. 상세 동작 순서는 연결된 공식 댄스 비디오·튜토리얼에서 확인할 수 있으며, 이 문서는 메타데이터만으로 특정 팔 동작이나 단계 수를 단정하지 않는다.',
    origin = '2022년 Mnet 스트릿 맨 파이터 리더 계급 미션곡 ‘새삥 (Prod. ZICO) (Feat. 호미들)’; 안무: 위댐보이즈 바타',
    aliases = ARRAY['새삥 챌린지','새삥','SMF 새삥 챌린지']::text[],
    updated_at = now()
  FROM target t WHERE m.id=t.id
  RETURNING m.id,m.updated_at,m.summary,m.description,m.origin,m.aliases
), added_sources AS (
  INSERT INTO public.meme_sources
    (meme_id,platform,source_url,title,creator_name,captured_at,copyright_status,source_role,rights_basis)
  SELECT c.id,v.platform,v.url,v.title,v.creator,now(),v.copyright_status::public.copyright_status,v.source_role,v.rights_basis
  FROM corrected c CROSS JOIN (VALUES
    ('youtube','https://www.youtube.com/watch?v=JnQu_5O4lh4','Mnet 새삥 리더 계급 댄스 비디오 — 안무: 위댐보이즈 바타','The CHOOM (더 춤)','embeddable','original','official_embed'),
    ('youtube','https://www.youtube.com/watch?v=WG2YQEzgH8c','Mnet 바타의 새삥 안무 튜토리얼','The CHOOM (더 춤)','embeddable','usage_example','official_embed'),
    ('web','https://cjnews.cj.net/?p=32515','CJ 뉴스룸: 스트릿 맨 파이터 새삥 챌린지','CJ 뉴스룸','unknown','secondary_reference','link_only')
  ) AS v(platform,url,title,creator,copyright_status,source_role,rights_basis)
  RETURNING id,source_url
), added_content AS (
  INSERT INTO public.meme_contents
    (meme_id,type,platform,content_id,url,caption,is_representative,availability,moderation_status)
  SELECT c.id,'video','youtube','JnQu_5O4lh4','https://www.youtube.com/watch?v=JnQu_5O4lh4',
    'Mnet 리더 계급 댄스 비디오 · 새삥 (Prod. ZICO) · 안무: 위댐보이즈 바타',true,'live','approved'
  FROM corrected c RETURNING id,url
), audited AS (
  INSERT INTO public.admin_audit_log (actor_id,action,entity_type,entity_id,detail)
  SELECT NULL,'meme.editorial_correction','meme',c.id::text,
    jsonb_build_object('reason','User requested verified 새삥 meaning correction',
      'reviewed_by','Codex operator; official CJ and The CHOOM metadata reviewed',
      'before',t.before,'after',to_jsonb(c),
      'sources',(SELECT jsonb_agg(to_jsonb(s)) FROM added_sources s),
      'contents',(SELECT jsonb_agg(to_jsonb(mc)) FROM added_content mc),
      'preserved','slug,title,moderation_status,safety_level,published_at,card identity,edition,seed,claims')
  FROM corrected c JOIN target t ON t.id=c.id RETURNING id
)
SELECT jsonb_build_object('memes_corrected',(SELECT count(*) FROM corrected),
  'sources_added',(SELECT count(*) FROM added_sources),
  'contents_added',(SELECT count(*) FROM added_content),
  'audit_ids',(SELECT jsonb_agg(id) FROM audited),
  'after',(SELECT jsonb_agg(to_jsonb(c)) FROM corrected c));
