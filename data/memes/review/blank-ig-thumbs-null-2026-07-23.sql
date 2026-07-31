-- 빈 Instagram 썸네일 정리 — 2026-07-23
--
-- 원인: scripts/backfill-social-thumbs.mjs 가 Instagram embed 페이지에서 썸네일을
-- 긁을 때, IG 로그인월/차단 응답에 섞인 100×100 회색 플레이스홀더(2~4.6KB)가
-- 옛 download() 하한(2000B)을 통과해 R2로 재호스팅됨. 유효한 200 JPEG라 카드
-- <img> 의 onError 폴백도 안 타서 빈 회색 박스로 보였다.
--
-- 조치: 재수집은 현재 IG가 embed·public 페이지 모두 로그아웃 이미지를 막아 불가
-- (검증: loginwall, og:image 제거). 따라서 확정된 빈 41건의 thumbnail_url 을
-- NULL 로 되돌려 제목 폴백 카드로 보낸다(상세 페이지 임베드는 브라우저 iframe이라
-- 영향 없음). 재발 방지는 backfill-social-thumbs.mjs download() 가드 강화로 처리.
-- NULL 이므로 이후 강화된 backfill 재실행 시 자동 재시도 대상이 된다.
--
-- 범위: meme_contents 41행 (host=catchmeme.com/.../instagram, R2 오브젝트 < 8KB=100×100)
-- 되돌리기: 파일 하단 주석 참조 (thumbnail_url 은 id 로 복원 가능).

begin;

update meme_contents
set thumbnail_url = null
where id in ('06349d7f-ab96-4265-9bc1-5d7d4445e2f9','071b4a47-1217-4903-a997-49004b4d4470','1f29c6ab-1149-447a-8ca5-d4471f1daee8','22aa03b8-5d25-418f-9709-03c87cac0142','22f46a46-6e53-4a9f-b8a5-e0f69b4b7023','27f0ada4-76b3-4bc2-bdb8-5ddf6e4b8755','2971104b-ecbc-44e6-9909-f9024823067c','38b79069-db3a-4d25-9a57-723773383cda','3c8e390d-c7ca-4c73-8683-74a867f4013e','47b0a9f7-036c-4999-bdac-14ac7a97008a','4ac4eb4b-c2ef-4581-ad05-f633dba3cd5b','5069064d-3360-494a-a2f4-d1dd0cefddce','50bc1fe9-9d92-4449-be80-d3c48599bf3f','520f56d9-9571-4b4c-8110-25d7e90ff313','5769bc05-d465-4df0-a29d-2b370c833881','58d881c0-2119-49ab-b7e4-dd9acfa6058e','6400443e-68d0-437b-ac15-8e3de1980101','6beb3faa-fba4-4802-ad18-9d1ec36e9600','71f7d85b-475f-4f5a-a5db-d588cd76ca3e','794bf02c-36c8-422c-8afa-713fd5bf1690','7bca0cd0-4aef-4951-8f94-934e2015f0ce','7fc32caf-f72c-4bd5-9441-ccf4ed5c0aed','83db0d0e-f071-4cba-a1c2-4efa36a9de84','8ae13ee8-f23c-485c-8256-870a377a48e6','8fddd4aa-67e7-4e26-9804-141f63eb5bf1','966aec6b-a800-4ff6-9738-ce9aee63c65a','9a7dfbfd-172b-42ca-a5ca-3dffbebdfd33','ae60cc06-bcb5-4b05-8eb8-8140cbede926','b2fbd332-bfef-4aab-a676-57215d0c8a96','b6188bf7-c050-4540-bf7d-96204d07020e','c5f27f81-21dc-467c-b88c-0c6a6f6ed7af','c639f339-c745-4dd3-9e9e-f1b6e994de14','c739da59-7f73-4ed6-807c-4812adecd23c','ca05b178-33b2-4e50-9872-880127feddcf','d5ff00fd-ed7d-4dc6-8e59-5a2ff551bc37','d6be19b3-de2e-473e-bd0e-14c13e19f47e','de13a46f-8887-4bb9-804d-41a830bb517b','e633f82a-b6ac-4b0a-ad76-27d68cb88fa9','ebd3578f-9cca-4021-872a-d8bd82de5ae0','fa3972ed-dfef-4e8b-86be-0d0e8a26fbab','ff0ba423-e848-4c2d-ac54-9e1740be58b4')
  and thumbnail_url like '%catchmeme.com/api/media/meme-thumbs/instagram%';

-- 검증: 41 이어야 함
select count(*) as nulled
from meme_contents
where id in ('06349d7f-ab96-4265-9bc1-5d7d4445e2f9','071b4a47-1217-4903-a997-49004b4d4470','1f29c6ab-1149-447a-8ca5-d4471f1daee8','22aa03b8-5d25-418f-9709-03c87cac0142','22f46a46-6e53-4a9f-b8a5-e0f69b4b7023','27f0ada4-76b3-4bc2-bdb8-5ddf6e4b8755','2971104b-ecbc-44e6-9909-f9024823067c','38b79069-db3a-4d25-9a57-723773383cda','3c8e390d-c7ca-4c73-8683-74a867f4013e','47b0a9f7-036c-4999-bdac-14ac7a97008a','4ac4eb4b-c2ef-4581-ad05-f633dba3cd5b','5069064d-3360-494a-a2f4-d1dd0cefddce','50bc1fe9-9d92-4449-be80-d3c48599bf3f','520f56d9-9571-4b4c-8110-25d7e90ff313','5769bc05-d465-4df0-a29d-2b370c833881','58d881c0-2119-49ab-b7e4-dd9acfa6058e','6400443e-68d0-437b-ac15-8e3de1980101','6beb3faa-fba4-4802-ad18-9d1ec36e9600','71f7d85b-475f-4f5a-a5db-d588cd76ca3e','794bf02c-36c8-422c-8afa-713fd5bf1690','7bca0cd0-4aef-4951-8f94-934e2015f0ce','7fc32caf-f72c-4bd5-9441-ccf4ed5c0aed','83db0d0e-f071-4cba-a1c2-4efa36a9de84','8ae13ee8-f23c-485c-8256-870a377a48e6','8fddd4aa-67e7-4e26-9804-141f63eb5bf1','966aec6b-a800-4ff6-9738-ce9aee63c65a','9a7dfbfd-172b-42ca-a5ca-3dffbebdfd33','ae60cc06-bcb5-4b05-8eb8-8140cbede926','b2fbd332-bfef-4aab-a676-57215d0c8a96','b6188bf7-c050-4540-bf7d-96204d07020e','c5f27f81-21dc-467c-b88c-0c6a6f6ed7af','c639f339-c745-4dd3-9e9e-f1b6e994de14','c739da59-7f73-4ed6-807c-4812adecd23c','ca05b178-33b2-4e50-9872-880127feddcf','d5ff00fd-ed7d-4dc6-8e59-5a2ff551bc37','d6be19b3-de2e-473e-bd0e-14c13e19f47e','de13a46f-8887-4bb9-804d-41a830bb517b','e633f82a-b6ac-4b0a-ad76-27d68cb88fa9','ebd3578f-9cca-4021-872a-d8bd82de5ae0','fa3972ed-dfef-4e8b-86be-0d0e8a26fbab','ff0ba423-e848-4c2d-ac54-9e1740be58b4')
  and thumbnail_url is null;

commit;

-- ── 되돌리기(필요 시) ────────────────────────────────────────────────
-- update meme_contents
-- set thumbnail_url = 'https://catchmeme.com/api/media/meme-thumbs/instagram/' || id || '.jpg'
-- where id in ('06349d7f-ab96-4265-9bc1-5d7d4445e2f9','071b4a47-1217-4903-a997-49004b4d4470','1f29c6ab-1149-447a-8ca5-d4471f1daee8','22aa03b8-5d25-418f-9709-03c87cac0142','22f46a46-6e53-4a9f-b8a5-e0f69b4b7023','27f0ada4-76b3-4bc2-bdb8-5ddf6e4b8755','2971104b-ecbc-44e6-9909-f9024823067c','38b79069-db3a-4d25-9a57-723773383cda','3c8e390d-c7ca-4c73-8683-74a867f4013e','47b0a9f7-036c-4999-bdac-14ac7a97008a','4ac4eb4b-c2ef-4581-ad05-f633dba3cd5b','5069064d-3360-494a-a2f4-d1dd0cefddce','50bc1fe9-9d92-4449-be80-d3c48599bf3f','520f56d9-9571-4b4c-8110-25d7e90ff313','5769bc05-d465-4df0-a29d-2b370c833881','58d881c0-2119-49ab-b7e4-dd9acfa6058e','6400443e-68d0-437b-ac15-8e3de1980101','6beb3faa-fba4-4802-ad18-9d1ec36e9600','71f7d85b-475f-4f5a-a5db-d588cd76ca3e','794bf02c-36c8-422c-8afa-713fd5bf1690','7bca0cd0-4aef-4951-8f94-934e2015f0ce','7fc32caf-f72c-4bd5-9441-ccf4ed5c0aed','83db0d0e-f071-4cba-a1c2-4efa36a9de84','8ae13ee8-f23c-485c-8256-870a377a48e6','8fddd4aa-67e7-4e26-9804-141f63eb5bf1','966aec6b-a800-4ff6-9738-ce9aee63c65a','9a7dfbfd-172b-42ca-a5ca-3dffbebdfd33','ae60cc06-bcb5-4b05-8eb8-8140cbede926','b2fbd332-bfef-4aab-a676-57215d0c8a96','b6188bf7-c050-4540-bf7d-96204d07020e','c5f27f81-21dc-467c-b88c-0c6a6f6ed7af','c639f339-c745-4dd3-9e9e-f1b6e994de14','c739da59-7f73-4ed6-807c-4812adecd23c','ca05b178-33b2-4e50-9872-880127feddcf','d5ff00fd-ed7d-4dc6-8e59-5a2ff551bc37','d6be19b3-de2e-473e-bd0e-14c13e19f47e','de13a46f-8887-4bb9-804d-41a830bb517b','e633f82a-b6ac-4b0a-ad76-27d68cb88fa9','ebd3578f-9cca-4021-872a-d8bd82de5ae0','fa3972ed-dfef-4e8b-86be-0d0e8a26fbab','ff0ba423-e848-4c2d-ac54-9e1740be58b4');
