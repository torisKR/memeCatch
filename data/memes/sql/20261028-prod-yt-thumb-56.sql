-- 2026-10-28 production: fill exactly 56 missing YouTube thumbnails.
-- Backup: data/memes/backup/20261028-prod-yt-null-thumb-56.json
-- Only thumbnail_url changes; platform/type/representative state are preserved.
begin;
do $media_fill$
declare
  v_expected constant integer := 56;
  v_matched integer;
  v_updated integer;
begin
  with targets(id, content_id, platform, content_type) as (
    values
    ('68024ab9-fac5-42ec-8321-9ec1c92ab0e8'::uuid, '9qDCU96l5fU'::text, 'YouTube'::text, 'embed'::media_type),
    ('d1fc3cb3-fb24-45fa-a7a6-304d31cc42d1'::uuid, 'PifWnGxFxRg'::text, 'YouTube'::text, 'embed'::media_type),
    ('ec8cd835-eac7-4ba2-8fae-1cf3c336267d'::uuid, 'cGOfV2sl_6g'::text, 'YouTube'::text, 'embed'::media_type),
    ('b1016be1-4f55-440c-9605-db019f98f6d0'::uuid, 'LKOJzFryRhs'::text, 'YouTube'::text, 'embed'::media_type),
    ('687d0148-7589-4ee8-8ceb-712b0af5664d'::uuid, 'kgM-k1Jbm54'::text, 'YouTube'::text, 'embed'::media_type),
    ('d327c5ca-716f-48e4-8262-9c3d8d1d45e1'::uuid, 'CB05d2cxu2s'::text, 'YouTube'::text, 'embed'::media_type),
    ('228ef15c-e185-49e6-b3aa-37acac15d45f'::uuid, 'g3hVg98AMlI'::text, 'YouTube'::text, 'embed'::media_type),
    ('2e82bacd-7b32-411c-8813-83a303350258'::uuid, 'GdfznKAqmCE'::text, 'YouTube'::text, 'embed'::media_type),
    ('6e8814cb-05f5-4873-a664-ef5f5bd35676'::uuid, 'aiIp3a2zPZY'::text, 'YouTube'::text, 'embed'::media_type),
    ('454a668f-bdd0-405c-a9ff-14d04260851c'::uuid, 'S9kZFLE6KHw'::text, 'YouTube'::text, 'embed'::media_type),
    ('99f2fa62-8ca5-407d-8ec0-6f731f89c841'::uuid, 'm09i1BQJBmw'::text, 'YouTube'::text, 'embed'::media_type),
    ('6551d389-0a9f-4462-a724-7144adcde8fd'::uuid, 'usykygO2UIA'::text, 'YouTube'::text, 'embed'::media_type),
    ('d0161fd0-f453-4228-bf3c-5e63108c28d7'::uuid, 'j19IG0wIoMQ'::text, 'YouTube'::text, 'embed'::media_type),
    ('8bf8d855-931e-4427-8c71-bd153242f526'::uuid, 'ZsRfUpSSTfA'::text, 'YouTube'::text, 'embed'::media_type),
    ('d1f5517c-d503-41d6-b94d-c79d282ac545'::uuid, '1adbfK5Jybc'::text, 'YouTube'::text, 'embed'::media_type),
    ('8774e88e-8991-45ef-b103-b1c543bc150a'::uuid, 'BQ0mxQXmLsk'::text, 'YouTube'::text, 'embed'::media_type),
    ('f1fc0c7e-6ec2-4a1b-abda-4904fdf86ec8'::uuid, 'HcbV4RRK_no'::text, 'YouTube'::text, 'embed'::media_type),
    ('d9cc2351-cae7-419d-8c5a-d3077595aea4'::uuid, 'v3imkK-uQ3E'::text, 'YouTube'::text, 'embed'::media_type),
    ('eca934c7-ccee-4bfb-9bf1-1fc3c9bfb7f3'::uuid, 'e9uS_XNMEJk'::text, 'YouTube'::text, 'embed'::media_type),
    ('089fa693-79fd-4c9f-9190-604aff3fdd61'::uuid, '9EsKLveY3Rc'::text, 'YouTube'::text, 'embed'::media_type),
    ('9be8b61d-b5f5-4d25-acce-ffbd209a67fa'::uuid, 'dDi7N2lgkWI'::text, 'YouTube'::text, 'embed'::media_type),
    ('9e820b1e-3501-46ce-b25c-d505ef7d3ccd'::uuid, 'AyHrh7PrE0Y'::text, 'YouTube'::text, 'embed'::media_type),
    ('4a274363-fbbf-4498-8fc9-5ae5fe934a0e'::uuid, 'qJdOoplB1GQ'::text, 'YouTube'::text, 'embed'::media_type),
    ('769d37a4-3012-459d-b8e5-b2b08c8b854c'::uuid, 'lZ6uVGgPDDI'::text, 'YouTube'::text, 'embed'::media_type),
    ('0afab452-e50d-45c7-b277-974ae349bded'::uuid, 'ex6aLaJb9o8'::text, 'YouTube'::text, 'embed'::media_type),
    ('8f3227d3-6b83-4996-9ae1-1a841c236d2b'::uuid, 'RdGZAVN0pr4'::text, 'YouTube'::text, 'embed'::media_type),
    ('46e82e1c-3840-4e3e-b015-7f9f4b09c85a'::uuid, 'ealY4_1VNx4'::text, 'YouTube'::text, 'embed'::media_type),
    ('98281dde-941d-4d50-ada9-149e77332cf8'::uuid, 'mXZGJavQR6E'::text, 'YouTube'::text, 'embed'::media_type),
    ('df1b05cc-fe3c-4205-bcf1-7f88d82f134c'::uuid, 'SNb4OmaeEq0'::text, 'YouTube'::text, 'embed'::media_type),
    ('e2caa9a2-110d-4d50-9b84-1d961fba6632'::uuid, 'JnQu_5O4lh4'::text, 'youtube'::text, 'video'::media_type),
    ('947ceed7-d775-4962-a403-aba731d29dab'::uuid, 'OUf85QwSByA'::text, 'YouTube'::text, 'embed'::media_type),
    ('0ab829a3-d655-420f-9e1f-4958cd2e71d4'::uuid, 'OUf85QwSByA'::text, 'YouTube'::text, 'embed'::media_type),
    ('abd28de6-fde5-401b-9b75-b22063718f05'::uuid, 'CeFMhbE9u3E'::text, 'YouTube'::text, 'embed'::media_type),
    ('f4d681b7-e0d8-43ad-aee6-a08674ebd773'::uuid, 'f1a27fuOSRQ'::text, 'YouTube'::text, 'embed'::media_type),
    ('39f0b0a1-8c5d-41a9-8dae-11cddc44fd59'::uuid, 'RkzbXQBjhgQ'::text, 'YouTube'::text, 'embed'::media_type),
    ('76f0d6c2-682e-40c1-b84a-ae66f8323381'::uuid, 'y5iXdP6jXpY'::text, 'YouTube'::text, 'embed'::media_type),
    ('5ccfbc30-772c-4c5f-897a-be386e27d84a'::uuid, 'AvoPhSuciww'::text, 'YouTube'::text, 'embed'::media_type),
    ('04487804-766e-4968-84dd-0dfd2720f12b'::uuid, 'vzWNxVED6_I'::text, 'YouTube'::text, 'embed'::media_type),
    ('a07e5b53-9953-488c-a56e-5db13f8f0a99'::uuid, 'aSSbeCsEJF0'::text, 'YouTube'::text, 'embed'::media_type),
    ('e837c3e0-a235-41da-8d4b-3c062e16659b'::uuid, 'x9XoA84sffM'::text, 'YouTube'::text, 'embed'::media_type),
    ('2450a5c1-5d4d-4f4f-84d9-2d687e79c320'::uuid, 'hqX7S9PuGt0'::text, 'YouTube'::text, 'embed'::media_type),
    ('efe60fa9-2103-4d80-9d04-94e1d133801a'::uuid, 'tCSBgOIA63M'::text, 'YouTube'::text, 'embed'::media_type),
    ('92146ed3-03ac-4ff1-8545-bb56f0852424'::uuid, 'ByirCSSopew'::text, 'YouTube'::text, 'embed'::media_type),
    ('2555d1a1-7146-40ac-96e9-3bf05578e5e0'::uuid, '40fMNZINGbw'::text, 'YouTube'::text, 'embed'::media_type),
    ('17a127ea-65d0-4f15-92c7-9fd3e3c92764'::uuid, 'G40rsdi_Z0A'::text, 'YouTube'::text, 'embed'::media_type),
    ('e609cef3-f9d5-47f9-a02e-f88654a3c1ea'::uuid, 'nN0cldn73YY'::text, 'YouTube'::text, 'embed'::media_type),
    ('7e945b17-3c3d-42ab-9ffa-e5ae6e778667'::uuid, 'CGK7aYOMJUg'::text, 'YouTube'::text, 'embed'::media_type),
    ('a759a643-de4f-41b4-be68-1dcd491c532a'::uuid, 'ABW9KzQ1oYM'::text, 'YouTube'::text, 'embed'::media_type),
    ('4a8ff329-a3e4-4949-984b-b03fa58574d9'::uuid, 'AhreKIF8odU'::text, 'YouTube'::text, 'embed'::media_type),
    ('dc2d0fa9-e167-4c47-911e-49a1bb038e93'::uuid, 'TZKMfy8qewk'::text, 'YouTube'::text, 'embed'::media_type),
    ('b4e0ddec-a2c3-4963-9141-9539d2a886fc'::uuid, 'pvkfYaOk7Ns'::text, 'YouTube'::text, 'embed'::media_type),
    ('b6a65c9f-1332-4543-8e00-c9f0b0670dc6'::uuid, 'mTDKg9BeEW4'::text, 'YouTube'::text, 'embed'::media_type),
    ('1c36e668-f570-4079-a84f-915833179d7b'::uuid, 'F_C7qnUVwzU'::text, 'YouTube'::text, 'embed'::media_type),
    ('89f4bb21-e565-4220-a396-7d0891841e53'::uuid, 'YiiGSbKjhgA'::text, 'YouTube'::text, 'embed'::media_type),
    ('6371c1c9-f53f-4ea9-ae98-399afe902c02'::uuid, '30zrr8hzSJE'::text, 'YouTube'::text, 'embed'::media_type),
    ('57748193-4f5e-4b23-80d9-d7a0f08b3874'::uuid, '_-GwbFEU99E'::text, 'YouTube'::text, 'embed'::media_type)
  )
  select count(*) into v_matched
  from public.meme_contents c
  join targets t on t.id = c.id
  join public.memes m on m.id = c.meme_id
  where c.content_id = t.content_id
    and c.platform = t.platform
    and c.type = t.content_type
    and c.thumbnail_url is null
    and c.availability = 'live'::availability_status
    and c.moderation_status = 'approved'::submission_status
    and m.moderation_status in ('approved'::moderation_status, 'limited'::moderation_status)
    and m.published_at is not null
    and m.origin_kind <> 'house_original';

  if v_matched <> v_expected then
    raise exception 'youtube thumbnail precondition mismatch: expected %, matched %', v_expected, v_matched;
  end if;

  with targets(id, content_id, platform, content_type) as (
    values
    ('68024ab9-fac5-42ec-8321-9ec1c92ab0e8'::uuid, '9qDCU96l5fU'::text, 'YouTube'::text, 'embed'::media_type),
    ('d1fc3cb3-fb24-45fa-a7a6-304d31cc42d1'::uuid, 'PifWnGxFxRg'::text, 'YouTube'::text, 'embed'::media_type),
    ('ec8cd835-eac7-4ba2-8fae-1cf3c336267d'::uuid, 'cGOfV2sl_6g'::text, 'YouTube'::text, 'embed'::media_type),
    ('b1016be1-4f55-440c-9605-db019f98f6d0'::uuid, 'LKOJzFryRhs'::text, 'YouTube'::text, 'embed'::media_type),
    ('687d0148-7589-4ee8-8ceb-712b0af5664d'::uuid, 'kgM-k1Jbm54'::text, 'YouTube'::text, 'embed'::media_type),
    ('d327c5ca-716f-48e4-8262-9c3d8d1d45e1'::uuid, 'CB05d2cxu2s'::text, 'YouTube'::text, 'embed'::media_type),
    ('228ef15c-e185-49e6-b3aa-37acac15d45f'::uuid, 'g3hVg98AMlI'::text, 'YouTube'::text, 'embed'::media_type),
    ('2e82bacd-7b32-411c-8813-83a303350258'::uuid, 'GdfznKAqmCE'::text, 'YouTube'::text, 'embed'::media_type),
    ('6e8814cb-05f5-4873-a664-ef5f5bd35676'::uuid, 'aiIp3a2zPZY'::text, 'YouTube'::text, 'embed'::media_type),
    ('454a668f-bdd0-405c-a9ff-14d04260851c'::uuid, 'S9kZFLE6KHw'::text, 'YouTube'::text, 'embed'::media_type),
    ('99f2fa62-8ca5-407d-8ec0-6f731f89c841'::uuid, 'm09i1BQJBmw'::text, 'YouTube'::text, 'embed'::media_type),
    ('6551d389-0a9f-4462-a724-7144adcde8fd'::uuid, 'usykygO2UIA'::text, 'YouTube'::text, 'embed'::media_type),
    ('d0161fd0-f453-4228-bf3c-5e63108c28d7'::uuid, 'j19IG0wIoMQ'::text, 'YouTube'::text, 'embed'::media_type),
    ('8bf8d855-931e-4427-8c71-bd153242f526'::uuid, 'ZsRfUpSSTfA'::text, 'YouTube'::text, 'embed'::media_type),
    ('d1f5517c-d503-41d6-b94d-c79d282ac545'::uuid, '1adbfK5Jybc'::text, 'YouTube'::text, 'embed'::media_type),
    ('8774e88e-8991-45ef-b103-b1c543bc150a'::uuid, 'BQ0mxQXmLsk'::text, 'YouTube'::text, 'embed'::media_type),
    ('f1fc0c7e-6ec2-4a1b-abda-4904fdf86ec8'::uuid, 'HcbV4RRK_no'::text, 'YouTube'::text, 'embed'::media_type),
    ('d9cc2351-cae7-419d-8c5a-d3077595aea4'::uuid, 'v3imkK-uQ3E'::text, 'YouTube'::text, 'embed'::media_type),
    ('eca934c7-ccee-4bfb-9bf1-1fc3c9bfb7f3'::uuid, 'e9uS_XNMEJk'::text, 'YouTube'::text, 'embed'::media_type),
    ('089fa693-79fd-4c9f-9190-604aff3fdd61'::uuid, '9EsKLveY3Rc'::text, 'YouTube'::text, 'embed'::media_type),
    ('9be8b61d-b5f5-4d25-acce-ffbd209a67fa'::uuid, 'dDi7N2lgkWI'::text, 'YouTube'::text, 'embed'::media_type),
    ('9e820b1e-3501-46ce-b25c-d505ef7d3ccd'::uuid, 'AyHrh7PrE0Y'::text, 'YouTube'::text, 'embed'::media_type),
    ('4a274363-fbbf-4498-8fc9-5ae5fe934a0e'::uuid, 'qJdOoplB1GQ'::text, 'YouTube'::text, 'embed'::media_type),
    ('769d37a4-3012-459d-b8e5-b2b08c8b854c'::uuid, 'lZ6uVGgPDDI'::text, 'YouTube'::text, 'embed'::media_type),
    ('0afab452-e50d-45c7-b277-974ae349bded'::uuid, 'ex6aLaJb9o8'::text, 'YouTube'::text, 'embed'::media_type),
    ('8f3227d3-6b83-4996-9ae1-1a841c236d2b'::uuid, 'RdGZAVN0pr4'::text, 'YouTube'::text, 'embed'::media_type),
    ('46e82e1c-3840-4e3e-b015-7f9f4b09c85a'::uuid, 'ealY4_1VNx4'::text, 'YouTube'::text, 'embed'::media_type),
    ('98281dde-941d-4d50-ada9-149e77332cf8'::uuid, 'mXZGJavQR6E'::text, 'YouTube'::text, 'embed'::media_type),
    ('df1b05cc-fe3c-4205-bcf1-7f88d82f134c'::uuid, 'SNb4OmaeEq0'::text, 'YouTube'::text, 'embed'::media_type),
    ('e2caa9a2-110d-4d50-9b84-1d961fba6632'::uuid, 'JnQu_5O4lh4'::text, 'youtube'::text, 'video'::media_type),
    ('947ceed7-d775-4962-a403-aba731d29dab'::uuid, 'OUf85QwSByA'::text, 'YouTube'::text, 'embed'::media_type),
    ('0ab829a3-d655-420f-9e1f-4958cd2e71d4'::uuid, 'OUf85QwSByA'::text, 'YouTube'::text, 'embed'::media_type),
    ('abd28de6-fde5-401b-9b75-b22063718f05'::uuid, 'CeFMhbE9u3E'::text, 'YouTube'::text, 'embed'::media_type),
    ('f4d681b7-e0d8-43ad-aee6-a08674ebd773'::uuid, 'f1a27fuOSRQ'::text, 'YouTube'::text, 'embed'::media_type),
    ('39f0b0a1-8c5d-41a9-8dae-11cddc44fd59'::uuid, 'RkzbXQBjhgQ'::text, 'YouTube'::text, 'embed'::media_type),
    ('76f0d6c2-682e-40c1-b84a-ae66f8323381'::uuid, 'y5iXdP6jXpY'::text, 'YouTube'::text, 'embed'::media_type),
    ('5ccfbc30-772c-4c5f-897a-be386e27d84a'::uuid, 'AvoPhSuciww'::text, 'YouTube'::text, 'embed'::media_type),
    ('04487804-766e-4968-84dd-0dfd2720f12b'::uuid, 'vzWNxVED6_I'::text, 'YouTube'::text, 'embed'::media_type),
    ('a07e5b53-9953-488c-a56e-5db13f8f0a99'::uuid, 'aSSbeCsEJF0'::text, 'YouTube'::text, 'embed'::media_type),
    ('e837c3e0-a235-41da-8d4b-3c062e16659b'::uuid, 'x9XoA84sffM'::text, 'YouTube'::text, 'embed'::media_type),
    ('2450a5c1-5d4d-4f4f-84d9-2d687e79c320'::uuid, 'hqX7S9PuGt0'::text, 'YouTube'::text, 'embed'::media_type),
    ('efe60fa9-2103-4d80-9d04-94e1d133801a'::uuid, 'tCSBgOIA63M'::text, 'YouTube'::text, 'embed'::media_type),
    ('92146ed3-03ac-4ff1-8545-bb56f0852424'::uuid, 'ByirCSSopew'::text, 'YouTube'::text, 'embed'::media_type),
    ('2555d1a1-7146-40ac-96e9-3bf05578e5e0'::uuid, '40fMNZINGbw'::text, 'YouTube'::text, 'embed'::media_type),
    ('17a127ea-65d0-4f15-92c7-9fd3e3c92764'::uuid, 'G40rsdi_Z0A'::text, 'YouTube'::text, 'embed'::media_type),
    ('e609cef3-f9d5-47f9-a02e-f88654a3c1ea'::uuid, 'nN0cldn73YY'::text, 'YouTube'::text, 'embed'::media_type),
    ('7e945b17-3c3d-42ab-9ffa-e5ae6e778667'::uuid, 'CGK7aYOMJUg'::text, 'YouTube'::text, 'embed'::media_type),
    ('a759a643-de4f-41b4-be68-1dcd491c532a'::uuid, 'ABW9KzQ1oYM'::text, 'YouTube'::text, 'embed'::media_type),
    ('4a8ff329-a3e4-4949-984b-b03fa58574d9'::uuid, 'AhreKIF8odU'::text, 'YouTube'::text, 'embed'::media_type),
    ('dc2d0fa9-e167-4c47-911e-49a1bb038e93'::uuid, 'TZKMfy8qewk'::text, 'YouTube'::text, 'embed'::media_type),
    ('b4e0ddec-a2c3-4963-9141-9539d2a886fc'::uuid, 'pvkfYaOk7Ns'::text, 'YouTube'::text, 'embed'::media_type),
    ('b6a65c9f-1332-4543-8e00-c9f0b0670dc6'::uuid, 'mTDKg9BeEW4'::text, 'YouTube'::text, 'embed'::media_type),
    ('1c36e668-f570-4079-a84f-915833179d7b'::uuid, 'F_C7qnUVwzU'::text, 'YouTube'::text, 'embed'::media_type),
    ('89f4bb21-e565-4220-a396-7d0891841e53'::uuid, 'YiiGSbKjhgA'::text, 'YouTube'::text, 'embed'::media_type),
    ('6371c1c9-f53f-4ea9-ae98-399afe902c02'::uuid, '30zrr8hzSJE'::text, 'YouTube'::text, 'embed'::media_type),
    ('57748193-4f5e-4b23-80d9-d7a0f08b3874'::uuid, '_-GwbFEU99E'::text, 'YouTube'::text, 'embed'::media_type)
  )
  update public.meme_contents c
     set thumbnail_url = 'https://i.ytimg.com/vi/' || t.content_id || '/hqdefault.jpg'
    from targets t, public.memes m
   where c.id = t.id
     and m.id = c.meme_id
     and c.content_id = t.content_id
     and c.platform = t.platform
     and c.type = t.content_type
     and c.thumbnail_url is null
     and c.availability = 'live'::availability_status
     and c.moderation_status = 'approved'::submission_status
     and m.moderation_status in ('approved'::moderation_status, 'limited'::moderation_status)
     and m.published_at is not null
     and m.origin_kind <> 'house_original';

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'youtube thumbnail update mismatch: expected %, updated %', v_expected, v_updated;
  end if;
end
$media_fill$;
commit;
