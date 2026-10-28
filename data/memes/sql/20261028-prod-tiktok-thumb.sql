begin;
create temporary table tiktok_thumb_batch (content_row_id uuid primary key, meme_id uuid not null, content_id text not null, thumbnail_url text not null) on commit drop;
insert into tiktok_thumb_batch values
('2a20f431-afb5-4b51-bb4c-1e614e63fee3'::uuid, '59100517-b407-4002-abf7-2e90b3195fe6'::uuid, '7592543871268031764', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/2a20f431-afb5-4b51-bb4c-1e614e63fee3.jpg'),
('da397ab8-4c27-4563-b987-bfb2e2d4a668'::uuid, '24a88902-bd17-4fe1-b5b8-8e9747adfdc5'::uuid, '7500306573999344927', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/da397ab8-4c27-4563-b987-bfb2e2d4a668.jpg'),
('40532507-1076-4999-a65a-dd1d59a9174c'::uuid, '57e32555-e5dc-4704-a650-24615096a35d'::uuid, '7497500396286446856', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/40532507-1076-4999-a65a-dd1d59a9174c.jpg'),
('94348897-e69f-47d8-ae32-624e4d62be0b'::uuid, '57e32555-e5dc-4704-a650-24615096a35d'::uuid, '7361996774237654273', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/94348897-e69f-47d8-ae32-624e4d62be0b.jpg'),
('96d8e57b-59aa-450a-abf0-2bc5fdad542d'::uuid, '57e32555-e5dc-4704-a650-24615096a35d'::uuid, '7215972442940984577', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/96d8e57b-59aa-450a-abf0-2bc5fdad542d.jpg'),
('a12f9f21-f912-4aa9-b152-254b1567bbd1'::uuid, '57e32555-e5dc-4704-a650-24615096a35d'::uuid, '7141193983174167809', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/a12f9f21-f912-4aa9-b152-254b1567bbd1.jpg'),
('e25a374b-d64f-424e-a91a-25f9d753838a'::uuid, '57e32555-e5dc-4704-a650-24615096a35d'::uuid, '7637157606418697480', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/e25a374b-d64f-424e-a91a-25f9d753838a.jpg'),
('86a19fa1-cd05-44a9-a5cd-62c2c73d8c8d'::uuid, '9f1077d8-29ab-4246-b09c-9511c2838c6c'::uuid, '7273589853172878593', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/86a19fa1-cd05-44a9-a5cd-62c2c73d8c8d.jpg'),
('6e111ac2-f24d-47ea-afa3-a5f086b42960'::uuid, '73e26a79-97fa-441d-a275-90783434fac5'::uuid, '7526853435384286482', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/6e111ac2-f24d-47ea-afa3-a5f086b42960.jpg'),
('08b1aaba-b9d3-4608-971d-cdd09046364d'::uuid, 'b1fe4410-e180-412e-aba7-5cb30e7c592d'::uuid, '7196415867255540998', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/08b1aaba-b9d3-4608-971d-cdd09046364d.jpg'),
('939f4ed8-8425-4204-baac-7ffb3fa64d13'::uuid, '3206bb75-9623-4aed-bb8d-75cef59e4418'::uuid, '7489840054676851990', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/939f4ed8-8425-4204-baac-7ffb3fa64d13.jpg'),
('e4827b03-5232-4a02-ada6-27002954390a'::uuid, 'd2c725d0-b9c6-4d85-b4b2-95fc663e3617'::uuid, '7364775216582544673', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/e4827b03-5232-4a02-ada6-27002954390a.jpg'),
('834f6dda-b714-4fab-bd0c-6044da744f9e'::uuid, 'c9cfbd24-3660-4ab5-aa35-5609ab28c40a'::uuid, '7240229139507154178', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/834f6dda-b714-4fab-bd0c-6044da744f9e.jpg'),
('ca5216f8-f2a8-4b8e-9c1e-933d8a8ac17c'::uuid, 'f0f0bc65-46ed-4165-93cd-5b1c29660b8d'::uuid, '7344533212426734880', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/ca5216f8-f2a8-4b8e-9c1e-933d8a8ac17c.jpg'),
('d22f9663-4f07-4cee-8a8c-9a91103354f2'::uuid, '6a52ac23-0bd0-453e-924a-e6dd9b669c29'::uuid, '7384479197814656302', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/d22f9663-4f07-4cee-8a8c-9a91103354f2.jpg'),
('f3a5d312-21af-44a5-9e04-3f13a33d4e03'::uuid, '2149b6cd-4d25-4cdf-9b79-52dfa0cb61f9'::uuid, '7307692018677992706', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/f3a5d312-21af-44a5-9e04-3f13a33d4e03-r1.jpg'),
('89788d57-b0e3-416a-99b9-09b57ce8d671'::uuid, '173aff90-0eea-4dd7-a11a-cca0c9ecca53'::uuid, '7622789271631498504', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/89788d57-b0e3-416a-99b9-09b57ce8d671-r1.jpg'),
('d61efd9e-9306-4d05-ac3c-de1f4f617598'::uuid, 'f825f28e-41e5-43f6-92b4-7de623def9e5'::uuid, '6916288851161943301', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/d61efd9e-9306-4d05-ac3c-de1f4f617598-r1.jpg'),
('26f868cc-6aad-4761-8e0e-f193899e33ea'::uuid, '48d5dbc4-08bb-41f2-a65a-d0afeca83911'::uuid, '7430841833996979487', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/26f868cc-6aad-4761-8e0e-f193899e33ea-r1.jpg'),
('6abfc692-0877-4e7a-8da2-bce75ff71328'::uuid, '5d080ffb-9f9e-44cb-9248-061bb4c25af4'::uuid, '7097228885128957226', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/6abfc692-0877-4e7a-8da2-bce75ff71328-r1.jpg'),
('2757f011-739b-441c-b5fc-f9aa1bc71e4e'::uuid, '1aa02b46-ae84-479d-9ecc-da1cfd50fa9a'::uuid, '7473526211541536055', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/2757f011-739b-441c-b5fc-f9aa1bc71e4e-r1.jpg'),
('4372b199-5e94-4dd2-8c8f-4490f84e0569'::uuid, 'c28c0360-3824-4834-adee-428179df1eed'::uuid, '7427525373287583008', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/4372b199-5e94-4dd2-8c8f-4490f84e0569-r1.jpg'),
('a19c7dee-84ea-4f9a-bf78-e4811536beea'::uuid, '94bf8fcf-41da-48de-af30-e56df39a1b19'::uuid, '7287361201187589422', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/a19c7dee-84ea-4f9a-bf78-e4811536beea-r1.jpg'),
('de97bca6-e3f0-4c12-9927-e9bc7cf40752'::uuid, 'ae881d2f-3329-4a9e-9430-2490a4e85156'::uuid, '7170343782641061166', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/de97bca6-e3f0-4c12-9927-e9bc7cf40752-r1.jpg'),
('2a405a38-626d-42ee-88a6-0b521a0c23db'::uuid, 'f86f389c-6128-4c2c-a77b-5301b7468258'::uuid, '7451857983417453842', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/2a405a38-626d-42ee-88a6-0b521a0c23db-r1.jpg'),
('f48cb010-b041-4116-a239-5db5c8fd6a18'::uuid, '1e34ffef-f9ef-44dc-ae19-be30f4e47a41'::uuid, '7577951015492766983', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/f48cb010-b041-4116-a239-5db5c8fd6a18-r1.jpg'),
('4999424d-133a-49d1-a4ee-0bba360fc80b'::uuid, 'f77c2053-d80b-4e79-bb5b-7a1707b9f4d7'::uuid, '7561887580090830088', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/4999424d-133a-49d1-a4ee-0bba360fc80b-r1.jpg'),
('6c9005d1-3eac-49d5-8b8c-40d29f729aab'::uuid, '56bbf888-83ce-4016-88ab-9514e5e0848d'::uuid, '6951806935024930054', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/6c9005d1-3eac-49d5-8b8c-40d29f729aab-r1.jpg'),
('e7e25b60-48a7-49dd-b785-4a1242a1b974'::uuid, 'd6fdc6c3-0ac6-4508-8b01-f4e048c0aeca'::uuid, '7584647367173967135', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/e7e25b60-48a7-49dd-b785-4a1242a1b974-r1.jpg'),
('4565a33a-b9fb-4faa-b895-a037860cab91'::uuid, 'b1fcf90f-0835-4e00-abd4-198f4b9026d1'::uuid, '7252724668941995291', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/4565a33a-b9fb-4faa-b895-a037860cab91-r1.jpg'),
('7b8fdc60-44a4-46c6-ab49-0a072342dfd5'::uuid, '395f4238-fd7e-4224-852b-6752fa1f2988'::uuid, '7533394082165574934', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/7b8fdc60-44a4-46c6-ab49-0a072342dfd5-r1.jpg'),
('305d11aa-50b3-4792-8285-4e7a7cc6c1de'::uuid, '69337faa-1423-483b-8751-784edc97c7cb'::uuid, '7330788400548646187', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/305d11aa-50b3-4792-8285-4e7a7cc6c1de-r1.jpg'),
('aa08e479-6466-44bb-993c-eac50b69710a'::uuid, 'b3c0f808-9650-4ca4-9729-798177945648'::uuid, '7309682874385485099', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/aa08e479-6466-44bb-993c-eac50b69710a-r1.jpg'),
('17bd6d39-6ef1-41c3-81a8-cd10d22c31c7'::uuid, '8bc0ba15-b59b-4a89-81a7-192b1e328506'::uuid, '7266366798050774304', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/17bd6d39-6ef1-41c3-81a8-cd10d22c31c7-r1.jpg'),
('3caba93a-8352-4417-b6c3-f574fb6d5b68'::uuid, '6132dc1a-515d-47da-8769-caf728dc4273'::uuid, '7485467500306500886', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/3caba93a-8352-4417-b6c3-f574fb6d5b68-r1.jpg'),
('b5e3f220-807a-4d78-beee-8bc2abc7bf2c'::uuid, '6132dc1a-515d-47da-8769-caf728dc4273'::uuid, '7499059999272930582', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/b5e3f220-807a-4d78-beee-8bc2abc7bf2c-r1.jpg'),
('f2a10f37-7cee-4f90-b95b-26b30e8e9b64'::uuid, '6132dc1a-515d-47da-8769-caf728dc4273'::uuid, '7496792639908433174', 'https://catchmeme.com/api/media/meme-thumbs/tiktok/f2a10f37-7cee-4f90-b95b-26b30e8e9b64-r1.jpg');

do $$
declare n integer;
begin
  update public.meme_contents c set thumbnail_url = b.thumbnail_url
  from tiktok_thumb_batch b
  where c.id=b.content_row_id and c.meme_id=b.meme_id and c.content_id=b.content_id
    and c.platform='TikTok' and c.availability='live' and c.moderation_status='approved' and c.thumbnail_url is null;
  get diagnostics n = row_count;
  if n <> 37 then raise exception 'TikTok thumbnail batch expected 37, affected %', n; end if;
end $$;
commit;
