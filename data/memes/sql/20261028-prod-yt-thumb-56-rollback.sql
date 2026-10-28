-- Roll back only the exact 56 thumbnail URLs applied by 20261028-prod-yt-thumb-56.sql.
begin;
do $media_fill_rollback$
declare
  v_expected constant integer := 56;
  v_matched integer;
  v_updated integer;
begin
  with targets(id, applied_thumbnail_url) as (
    values
    ('68024ab9-fac5-42ec-8321-9ec1c92ab0e8'::uuid, 'https://i.ytimg.com/vi/9qDCU96l5fU/hqdefault.jpg'::text),
    ('d1fc3cb3-fb24-45fa-a7a6-304d31cc42d1'::uuid, 'https://i.ytimg.com/vi/PifWnGxFxRg/hqdefault.jpg'::text),
    ('ec8cd835-eac7-4ba2-8fae-1cf3c336267d'::uuid, 'https://i.ytimg.com/vi/cGOfV2sl_6g/hqdefault.jpg'::text),
    ('b1016be1-4f55-440c-9605-db019f98f6d0'::uuid, 'https://i.ytimg.com/vi/LKOJzFryRhs/hqdefault.jpg'::text),
    ('687d0148-7589-4ee8-8ceb-712b0af5664d'::uuid, 'https://i.ytimg.com/vi/kgM-k1Jbm54/hqdefault.jpg'::text),
    ('d327c5ca-716f-48e4-8262-9c3d8d1d45e1'::uuid, 'https://i.ytimg.com/vi/CB05d2cxu2s/hqdefault.jpg'::text),
    ('228ef15c-e185-49e6-b3aa-37acac15d45f'::uuid, 'https://i.ytimg.com/vi/g3hVg98AMlI/hqdefault.jpg'::text),
    ('2e82bacd-7b32-411c-8813-83a303350258'::uuid, 'https://i.ytimg.com/vi/GdfznKAqmCE/hqdefault.jpg'::text),
    ('6e8814cb-05f5-4873-a664-ef5f5bd35676'::uuid, 'https://i.ytimg.com/vi/aiIp3a2zPZY/hqdefault.jpg'::text),
    ('454a668f-bdd0-405c-a9ff-14d04260851c'::uuid, 'https://i.ytimg.com/vi/S9kZFLE6KHw/hqdefault.jpg'::text),
    ('99f2fa62-8ca5-407d-8ec0-6f731f89c841'::uuid, 'https://i.ytimg.com/vi/m09i1BQJBmw/hqdefault.jpg'::text),
    ('6551d389-0a9f-4462-a724-7144adcde8fd'::uuid, 'https://i.ytimg.com/vi/usykygO2UIA/hqdefault.jpg'::text),
    ('d0161fd0-f453-4228-bf3c-5e63108c28d7'::uuid, 'https://i.ytimg.com/vi/j19IG0wIoMQ/hqdefault.jpg'::text),
    ('8bf8d855-931e-4427-8c71-bd153242f526'::uuid, 'https://i.ytimg.com/vi/ZsRfUpSSTfA/hqdefault.jpg'::text),
    ('d1f5517c-d503-41d6-b94d-c79d282ac545'::uuid, 'https://i.ytimg.com/vi/1adbfK5Jybc/hqdefault.jpg'::text),
    ('8774e88e-8991-45ef-b103-b1c543bc150a'::uuid, 'https://i.ytimg.com/vi/BQ0mxQXmLsk/hqdefault.jpg'::text),
    ('f1fc0c7e-6ec2-4a1b-abda-4904fdf86ec8'::uuid, 'https://i.ytimg.com/vi/HcbV4RRK_no/hqdefault.jpg'::text),
    ('d9cc2351-cae7-419d-8c5a-d3077595aea4'::uuid, 'https://i.ytimg.com/vi/v3imkK-uQ3E/hqdefault.jpg'::text),
    ('eca934c7-ccee-4bfb-9bf1-1fc3c9bfb7f3'::uuid, 'https://i.ytimg.com/vi/e9uS_XNMEJk/hqdefault.jpg'::text),
    ('089fa693-79fd-4c9f-9190-604aff3fdd61'::uuid, 'https://i.ytimg.com/vi/9EsKLveY3Rc/hqdefault.jpg'::text),
    ('9be8b61d-b5f5-4d25-acce-ffbd209a67fa'::uuid, 'https://i.ytimg.com/vi/dDi7N2lgkWI/hqdefault.jpg'::text),
    ('9e820b1e-3501-46ce-b25c-d505ef7d3ccd'::uuid, 'https://i.ytimg.com/vi/AyHrh7PrE0Y/hqdefault.jpg'::text),
    ('4a274363-fbbf-4498-8fc9-5ae5fe934a0e'::uuid, 'https://i.ytimg.com/vi/qJdOoplB1GQ/hqdefault.jpg'::text),
    ('769d37a4-3012-459d-b8e5-b2b08c8b854c'::uuid, 'https://i.ytimg.com/vi/lZ6uVGgPDDI/hqdefault.jpg'::text),
    ('0afab452-e50d-45c7-b277-974ae349bded'::uuid, 'https://i.ytimg.com/vi/ex6aLaJb9o8/hqdefault.jpg'::text),
    ('8f3227d3-6b83-4996-9ae1-1a841c236d2b'::uuid, 'https://i.ytimg.com/vi/RdGZAVN0pr4/hqdefault.jpg'::text),
    ('46e82e1c-3840-4e3e-b015-7f9f4b09c85a'::uuid, 'https://i.ytimg.com/vi/ealY4_1VNx4/hqdefault.jpg'::text),
    ('98281dde-941d-4d50-ada9-149e77332cf8'::uuid, 'https://i.ytimg.com/vi/mXZGJavQR6E/hqdefault.jpg'::text),
    ('df1b05cc-fe3c-4205-bcf1-7f88d82f134c'::uuid, 'https://i.ytimg.com/vi/SNb4OmaeEq0/hqdefault.jpg'::text),
    ('e2caa9a2-110d-4d50-9b84-1d961fba6632'::uuid, 'https://i.ytimg.com/vi/JnQu_5O4lh4/hqdefault.jpg'::text),
    ('947ceed7-d775-4962-a403-aba731d29dab'::uuid, 'https://i.ytimg.com/vi/OUf85QwSByA/hqdefault.jpg'::text),
    ('0ab829a3-d655-420f-9e1f-4958cd2e71d4'::uuid, 'https://i.ytimg.com/vi/OUf85QwSByA/hqdefault.jpg'::text),
    ('abd28de6-fde5-401b-9b75-b22063718f05'::uuid, 'https://i.ytimg.com/vi/CeFMhbE9u3E/hqdefault.jpg'::text),
    ('f4d681b7-e0d8-43ad-aee6-a08674ebd773'::uuid, 'https://i.ytimg.com/vi/f1a27fuOSRQ/hqdefault.jpg'::text),
    ('39f0b0a1-8c5d-41a9-8dae-11cddc44fd59'::uuid, 'https://i.ytimg.com/vi/RkzbXQBjhgQ/hqdefault.jpg'::text),
    ('76f0d6c2-682e-40c1-b84a-ae66f8323381'::uuid, 'https://i.ytimg.com/vi/y5iXdP6jXpY/hqdefault.jpg'::text),
    ('5ccfbc30-772c-4c5f-897a-be386e27d84a'::uuid, 'https://i.ytimg.com/vi/AvoPhSuciww/hqdefault.jpg'::text),
    ('04487804-766e-4968-84dd-0dfd2720f12b'::uuid, 'https://i.ytimg.com/vi/vzWNxVED6_I/hqdefault.jpg'::text),
    ('a07e5b53-9953-488c-a56e-5db13f8f0a99'::uuid, 'https://i.ytimg.com/vi/aSSbeCsEJF0/hqdefault.jpg'::text),
    ('e837c3e0-a235-41da-8d4b-3c062e16659b'::uuid, 'https://i.ytimg.com/vi/x9XoA84sffM/hqdefault.jpg'::text),
    ('2450a5c1-5d4d-4f4f-84d9-2d687e79c320'::uuid, 'https://i.ytimg.com/vi/hqX7S9PuGt0/hqdefault.jpg'::text),
    ('efe60fa9-2103-4d80-9d04-94e1d133801a'::uuid, 'https://i.ytimg.com/vi/tCSBgOIA63M/hqdefault.jpg'::text),
    ('92146ed3-03ac-4ff1-8545-bb56f0852424'::uuid, 'https://i.ytimg.com/vi/ByirCSSopew/hqdefault.jpg'::text),
    ('2555d1a1-7146-40ac-96e9-3bf05578e5e0'::uuid, 'https://i.ytimg.com/vi/40fMNZINGbw/hqdefault.jpg'::text),
    ('17a127ea-65d0-4f15-92c7-9fd3e3c92764'::uuid, 'https://i.ytimg.com/vi/G40rsdi_Z0A/hqdefault.jpg'::text),
    ('e609cef3-f9d5-47f9-a02e-f88654a3c1ea'::uuid, 'https://i.ytimg.com/vi/nN0cldn73YY/hqdefault.jpg'::text),
    ('7e945b17-3c3d-42ab-9ffa-e5ae6e778667'::uuid, 'https://i.ytimg.com/vi/CGK7aYOMJUg/hqdefault.jpg'::text),
    ('a759a643-de4f-41b4-be68-1dcd491c532a'::uuid, 'https://i.ytimg.com/vi/ABW9KzQ1oYM/hqdefault.jpg'::text),
    ('4a8ff329-a3e4-4949-984b-b03fa58574d9'::uuid, 'https://i.ytimg.com/vi/AhreKIF8odU/hqdefault.jpg'::text),
    ('dc2d0fa9-e167-4c47-911e-49a1bb038e93'::uuid, 'https://i.ytimg.com/vi/TZKMfy8qewk/hqdefault.jpg'::text),
    ('b4e0ddec-a2c3-4963-9141-9539d2a886fc'::uuid, 'https://i.ytimg.com/vi/pvkfYaOk7Ns/hqdefault.jpg'::text),
    ('b6a65c9f-1332-4543-8e00-c9f0b0670dc6'::uuid, 'https://i.ytimg.com/vi/mTDKg9BeEW4/hqdefault.jpg'::text),
    ('1c36e668-f570-4079-a84f-915833179d7b'::uuid, 'https://i.ytimg.com/vi/F_C7qnUVwzU/hqdefault.jpg'::text),
    ('89f4bb21-e565-4220-a396-7d0891841e53'::uuid, 'https://i.ytimg.com/vi/YiiGSbKjhgA/hqdefault.jpg'::text),
    ('6371c1c9-f53f-4ea9-ae98-399afe902c02'::uuid, 'https://i.ytimg.com/vi/30zrr8hzSJE/hqdefault.jpg'::text),
    ('57748193-4f5e-4b23-80d9-d7a0f08b3874'::uuid, 'https://i.ytimg.com/vi/_-GwbFEU99E/hqdefault.jpg'::text)
  )
  select count(*) into v_matched
  from public.meme_contents c
  join targets t on t.id = c.id
  where c.thumbnail_url = t.applied_thumbnail_url;

  if v_matched <> v_expected then
    raise exception 'youtube thumbnail rollback precondition mismatch: expected %, matched %', v_expected, v_matched;
  end if;

  with targets(id, applied_thumbnail_url) as (
    values
    ('68024ab9-fac5-42ec-8321-9ec1c92ab0e8'::uuid, 'https://i.ytimg.com/vi/9qDCU96l5fU/hqdefault.jpg'::text),
    ('d1fc3cb3-fb24-45fa-a7a6-304d31cc42d1'::uuid, 'https://i.ytimg.com/vi/PifWnGxFxRg/hqdefault.jpg'::text),
    ('ec8cd835-eac7-4ba2-8fae-1cf3c336267d'::uuid, 'https://i.ytimg.com/vi/cGOfV2sl_6g/hqdefault.jpg'::text),
    ('b1016be1-4f55-440c-9605-db019f98f6d0'::uuid, 'https://i.ytimg.com/vi/LKOJzFryRhs/hqdefault.jpg'::text),
    ('687d0148-7589-4ee8-8ceb-712b0af5664d'::uuid, 'https://i.ytimg.com/vi/kgM-k1Jbm54/hqdefault.jpg'::text),
    ('d327c5ca-716f-48e4-8262-9c3d8d1d45e1'::uuid, 'https://i.ytimg.com/vi/CB05d2cxu2s/hqdefault.jpg'::text),
    ('228ef15c-e185-49e6-b3aa-37acac15d45f'::uuid, 'https://i.ytimg.com/vi/g3hVg98AMlI/hqdefault.jpg'::text),
    ('2e82bacd-7b32-411c-8813-83a303350258'::uuid, 'https://i.ytimg.com/vi/GdfznKAqmCE/hqdefault.jpg'::text),
    ('6e8814cb-05f5-4873-a664-ef5f5bd35676'::uuid, 'https://i.ytimg.com/vi/aiIp3a2zPZY/hqdefault.jpg'::text),
    ('454a668f-bdd0-405c-a9ff-14d04260851c'::uuid, 'https://i.ytimg.com/vi/S9kZFLE6KHw/hqdefault.jpg'::text),
    ('99f2fa62-8ca5-407d-8ec0-6f731f89c841'::uuid, 'https://i.ytimg.com/vi/m09i1BQJBmw/hqdefault.jpg'::text),
    ('6551d389-0a9f-4462-a724-7144adcde8fd'::uuid, 'https://i.ytimg.com/vi/usykygO2UIA/hqdefault.jpg'::text),
    ('d0161fd0-f453-4228-bf3c-5e63108c28d7'::uuid, 'https://i.ytimg.com/vi/j19IG0wIoMQ/hqdefault.jpg'::text),
    ('8bf8d855-931e-4427-8c71-bd153242f526'::uuid, 'https://i.ytimg.com/vi/ZsRfUpSSTfA/hqdefault.jpg'::text),
    ('d1f5517c-d503-41d6-b94d-c79d282ac545'::uuid, 'https://i.ytimg.com/vi/1adbfK5Jybc/hqdefault.jpg'::text),
    ('8774e88e-8991-45ef-b103-b1c543bc150a'::uuid, 'https://i.ytimg.com/vi/BQ0mxQXmLsk/hqdefault.jpg'::text),
    ('f1fc0c7e-6ec2-4a1b-abda-4904fdf86ec8'::uuid, 'https://i.ytimg.com/vi/HcbV4RRK_no/hqdefault.jpg'::text),
    ('d9cc2351-cae7-419d-8c5a-d3077595aea4'::uuid, 'https://i.ytimg.com/vi/v3imkK-uQ3E/hqdefault.jpg'::text),
    ('eca934c7-ccee-4bfb-9bf1-1fc3c9bfb7f3'::uuid, 'https://i.ytimg.com/vi/e9uS_XNMEJk/hqdefault.jpg'::text),
    ('089fa693-79fd-4c9f-9190-604aff3fdd61'::uuid, 'https://i.ytimg.com/vi/9EsKLveY3Rc/hqdefault.jpg'::text),
    ('9be8b61d-b5f5-4d25-acce-ffbd209a67fa'::uuid, 'https://i.ytimg.com/vi/dDi7N2lgkWI/hqdefault.jpg'::text),
    ('9e820b1e-3501-46ce-b25c-d505ef7d3ccd'::uuid, 'https://i.ytimg.com/vi/AyHrh7PrE0Y/hqdefault.jpg'::text),
    ('4a274363-fbbf-4498-8fc9-5ae5fe934a0e'::uuid, 'https://i.ytimg.com/vi/qJdOoplB1GQ/hqdefault.jpg'::text),
    ('769d37a4-3012-459d-b8e5-b2b08c8b854c'::uuid, 'https://i.ytimg.com/vi/lZ6uVGgPDDI/hqdefault.jpg'::text),
    ('0afab452-e50d-45c7-b277-974ae349bded'::uuid, 'https://i.ytimg.com/vi/ex6aLaJb9o8/hqdefault.jpg'::text),
    ('8f3227d3-6b83-4996-9ae1-1a841c236d2b'::uuid, 'https://i.ytimg.com/vi/RdGZAVN0pr4/hqdefault.jpg'::text),
    ('46e82e1c-3840-4e3e-b015-7f9f4b09c85a'::uuid, 'https://i.ytimg.com/vi/ealY4_1VNx4/hqdefault.jpg'::text),
    ('98281dde-941d-4d50-ada9-149e77332cf8'::uuid, 'https://i.ytimg.com/vi/mXZGJavQR6E/hqdefault.jpg'::text),
    ('df1b05cc-fe3c-4205-bcf1-7f88d82f134c'::uuid, 'https://i.ytimg.com/vi/SNb4OmaeEq0/hqdefault.jpg'::text),
    ('e2caa9a2-110d-4d50-9b84-1d961fba6632'::uuid, 'https://i.ytimg.com/vi/JnQu_5O4lh4/hqdefault.jpg'::text),
    ('947ceed7-d775-4962-a403-aba731d29dab'::uuid, 'https://i.ytimg.com/vi/OUf85QwSByA/hqdefault.jpg'::text),
    ('0ab829a3-d655-420f-9e1f-4958cd2e71d4'::uuid, 'https://i.ytimg.com/vi/OUf85QwSByA/hqdefault.jpg'::text),
    ('abd28de6-fde5-401b-9b75-b22063718f05'::uuid, 'https://i.ytimg.com/vi/CeFMhbE9u3E/hqdefault.jpg'::text),
    ('f4d681b7-e0d8-43ad-aee6-a08674ebd773'::uuid, 'https://i.ytimg.com/vi/f1a27fuOSRQ/hqdefault.jpg'::text),
    ('39f0b0a1-8c5d-41a9-8dae-11cddc44fd59'::uuid, 'https://i.ytimg.com/vi/RkzbXQBjhgQ/hqdefault.jpg'::text),
    ('76f0d6c2-682e-40c1-b84a-ae66f8323381'::uuid, 'https://i.ytimg.com/vi/y5iXdP6jXpY/hqdefault.jpg'::text),
    ('5ccfbc30-772c-4c5f-897a-be386e27d84a'::uuid, 'https://i.ytimg.com/vi/AvoPhSuciww/hqdefault.jpg'::text),
    ('04487804-766e-4968-84dd-0dfd2720f12b'::uuid, 'https://i.ytimg.com/vi/vzWNxVED6_I/hqdefault.jpg'::text),
    ('a07e5b53-9953-488c-a56e-5db13f8f0a99'::uuid, 'https://i.ytimg.com/vi/aSSbeCsEJF0/hqdefault.jpg'::text),
    ('e837c3e0-a235-41da-8d4b-3c062e16659b'::uuid, 'https://i.ytimg.com/vi/x9XoA84sffM/hqdefault.jpg'::text),
    ('2450a5c1-5d4d-4f4f-84d9-2d687e79c320'::uuid, 'https://i.ytimg.com/vi/hqX7S9PuGt0/hqdefault.jpg'::text),
    ('efe60fa9-2103-4d80-9d04-94e1d133801a'::uuid, 'https://i.ytimg.com/vi/tCSBgOIA63M/hqdefault.jpg'::text),
    ('92146ed3-03ac-4ff1-8545-bb56f0852424'::uuid, 'https://i.ytimg.com/vi/ByirCSSopew/hqdefault.jpg'::text),
    ('2555d1a1-7146-40ac-96e9-3bf05578e5e0'::uuid, 'https://i.ytimg.com/vi/40fMNZINGbw/hqdefault.jpg'::text),
    ('17a127ea-65d0-4f15-92c7-9fd3e3c92764'::uuid, 'https://i.ytimg.com/vi/G40rsdi_Z0A/hqdefault.jpg'::text),
    ('e609cef3-f9d5-47f9-a02e-f88654a3c1ea'::uuid, 'https://i.ytimg.com/vi/nN0cldn73YY/hqdefault.jpg'::text),
    ('7e945b17-3c3d-42ab-9ffa-e5ae6e778667'::uuid, 'https://i.ytimg.com/vi/CGK7aYOMJUg/hqdefault.jpg'::text),
    ('a759a643-de4f-41b4-be68-1dcd491c532a'::uuid, 'https://i.ytimg.com/vi/ABW9KzQ1oYM/hqdefault.jpg'::text),
    ('4a8ff329-a3e4-4949-984b-b03fa58574d9'::uuid, 'https://i.ytimg.com/vi/AhreKIF8odU/hqdefault.jpg'::text),
    ('dc2d0fa9-e167-4c47-911e-49a1bb038e93'::uuid, 'https://i.ytimg.com/vi/TZKMfy8qewk/hqdefault.jpg'::text),
    ('b4e0ddec-a2c3-4963-9141-9539d2a886fc'::uuid, 'https://i.ytimg.com/vi/pvkfYaOk7Ns/hqdefault.jpg'::text),
    ('b6a65c9f-1332-4543-8e00-c9f0b0670dc6'::uuid, 'https://i.ytimg.com/vi/mTDKg9BeEW4/hqdefault.jpg'::text),
    ('1c36e668-f570-4079-a84f-915833179d7b'::uuid, 'https://i.ytimg.com/vi/F_C7qnUVwzU/hqdefault.jpg'::text),
    ('89f4bb21-e565-4220-a396-7d0891841e53'::uuid, 'https://i.ytimg.com/vi/YiiGSbKjhgA/hqdefault.jpg'::text),
    ('6371c1c9-f53f-4ea9-ae98-399afe902c02'::uuid, 'https://i.ytimg.com/vi/30zrr8hzSJE/hqdefault.jpg'::text),
    ('57748193-4f5e-4b23-80d9-d7a0f08b3874'::uuid, 'https://i.ytimg.com/vi/_-GwbFEU99E/hqdefault.jpg'::text)
  )
  update public.meme_contents c
     set thumbnail_url = null
    from targets t
   where c.id = t.id
     and c.thumbnail_url = t.applied_thumbnail_url;

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'youtube thumbnail rollback mismatch: expected %, updated %', v_expected, v_updated;
  end if;
end
$media_fill_rollback$;
commit;
