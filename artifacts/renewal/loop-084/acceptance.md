# Loop 084 acceptance — Plus Creator Pack Outcome Receipt

## Objective

Creator Pack을 만들고 공유하거나 다운로드한 뒤, 사용자가 실제 활용을 마쳤을 때만 기존 Plus 활용 완료 원장에
기록한다. 현재 요청 콘텐츠 로케일과 다른 ready translation은 Action Inbox에 섞이지 않아야 한다.

## Acceptance criteria

- Pack 생성·공유·다운로드만으로 `POST /api/plus/action-inbox/complete`를 호출하지 않는다.
- export에 성공한 카드만 receipt에 표시하고, 사용자의 명시적 확인에서 기존 completion API를 성공 항목별로 호출한다.
- 부분 실패 시 성공 항목은 제거하고 실패 항목과 재시도 CTA를 유지한다.
- 기존 카드에서 개별 활용 완료를 한 항목은 receipt에서도 제거한다.
- ready translation은 `item.locale === request locale`일 때만 translation action으로 만든다.
- free/signed-out/Plus unavailable/API error/DB/migration/production 경계는 변경하지 않는다.

## Non-goals

- 새 table, RPC, migration, cron, 외부 SNS 게시, 자동 게시, 실제 Supabase 적용, production deploy.
- 번역 문구 생성이나 448/1,520 catalog 보충.
