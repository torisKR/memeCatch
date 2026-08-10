# Loop 088 acceptance — Plus 번역 수요 → machine 초안 브리지

## 목표

Plus translation priority queue의 누락 locale 요청을 운영자 번역 desk로 연결하고, GPT 미리보기 뒤
사람이 편집한 결과를 기존 machine 검수 큐에 명시적으로 넘긴다.

## 수용 조건

- 번역 행이 없는 Plus 요청은 exact locale과 meme ID를 가진 `/admin/translations` focus 경로로 이동한다.
- GPT-5.6 Sol high 누락 번역 미리보기는 호출 전후에 DB insert/update/delete, audit, RPC, 공개 재검증을 하지 않는다.
- 운영자가 편집 가능한 title, summary, description, origin, usage note, caution, aliases를 확인하고
  `검수 대기 초안 저장`을 눌렀을 때만 단일 `meme_translations` machine row를 만든다.
- 저장 전 operator 권한, approved/limited 공개 원문, 기대 source revision, 기존 translation row 부재를 다시 확인한다.
- 저장 row는 source revision, 결정적 localized slug, `provider=openai`, `model=gpt-5.6-sol`,
  `prompt_version=1`, `status=machine`, null review fields를 가진다.
- source drift, private/non-public source, duplicate, non-operator는 mutation 없이 거절한다.
- machine row는 기존 인간 검수 큐에만 들어가며 reviewed/current 공개 gate 전까지 public detail, sitemap,
  hreflang, Plus ready 소비자에 노출되지 않는다.
- 기존 translation row가 있는 priority 요청의 claim/detail 경로와 자동 발행 경계는 유지한다.
