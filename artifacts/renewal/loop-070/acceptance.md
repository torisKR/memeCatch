# Loop 070 acceptance

## User outcome

활성 Plus 사용자가 `/my#saved`에서 저장 폴더를 고르면, 다시 상세를 열어 수동으로 정리하지 않고
뜻·유래·사용 신호·주의·현재 번역·개인 메모·바로 쓸 문구가 담긴 비공개 Markdown 브리프를 내려받을 수 있다.

## Acceptance contract

- `/my#saved`는 Plus 사용자 본인의 저장 `collection` 값만 선택 목록으로 보여준다.
- POST `/api/plus/collection-brief`는 signed-out를 401, free account를 403으로 차단한다.
- 저장 데이터는 기존 `saved_memes` RLS owner scope를 사용하며 service-role이나 사용자 id 입력을 받지 않는다.
- 선택 컬렉션에서 `approved`·`limited` 밈만 최대 100개를 최신 저장 순으로 포함한다.
- requested SEO locale의 reviewed/current translation이 있으면 사용하고, 없거나 stale이면 명시적인 Korean source fallback을 사용한다.
- 파일에는 locale-safe detail URL, safety/lifecycle signal, existing Use Kit, private note가 포함된다.
- 응답은 `text/markdown`, `Content-Disposition: attachment`, `private, no-store`, `nosniff`를 사용한다.

## Safety boundary

- 새 DB schema, migration, write RPC, public content route, service-role path를 추가하지 않는다.
- 개인 메모는 private attachment에만 있고 public HTML·검색·sitemap·AI feed로 복제되지 않는다.
- 공개되지 않은 밈 또는 타인의 저장 데이터가 결과에 포함되지 않도록 nested public status와 RLS에 의존한다.

## External gates

- 인증된 Plus 세션과 실제 saved folder가 이 환경에 없어 성공 attachment의 브라우저 저장은 수동 관찰하지 못했다.
- Supabase production RLS 실행, production deploy, push/merge는 수행하지 않았다.
