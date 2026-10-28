# 밈 상세 VideoObject 로컬 점검 — 2026-10-18

## 범위

- 스키마 전용 병렬 worktree: `/Users/toris/.codex/worktrees/meme-video-schema-local/memecatch`
- 현재 로컬 checkout의 밈 상세 페이지, 자체 제작 영상 공개 projection, JSON-LD를 비교
- 운영 배포, 운영 DB 변경, 영상 업로드, 외부 영상 상태 변경 없음

## 화면과 구조화 데이터 계약

자체 제작 영상은 다음 조건을 모두 만족할 때만 `VideoObject`를 출력한다.

1. 공개 projection에 포함된 승인 제작물이다.
2. YouTube 공개 상태가 `public`이다.
3. 최신 저장 증거의 `public_embed_verified`가 정확히 `true`다.
4. 최신 증거의 처리 상태가 `succeeded`, 공개 상태가 `public`, `embeddable`이 `true`다.
5. 실제 영상 ID, 제목, YouTube 썸네일 URL, 최초 공개 시각이 유효하다.
6. 해당 밈 상세가 색인 가능한 문서라 `structuredDataPath`를 전달한다.

화면 iframe과 JSON-LD `embedUrl`은 동일한 `youtube_video_id`로 만든
`https://www.youtube-nocookie.com/embed/...` URL을 사용한다. JSON-LD의 제목과 설명은
동일 영상 옆에 화면 텍스트로 표시한다. `unlisted`, `private`, 검증값 누락, 문자열
`"true"`, 잘못된 메타데이터, 색인 제외 상세는 `VideoObject`를 만들지 않는다.

## 발견 및 수정

실제 상세 페이지에서 호출되지 않는 이전 `MemeVideoJsonLd` export는 유효한 업로드 시각만
있으면 공개·임베드 검증 증거 없이 `VideoObject`를 만들 수 있었다. 미래의 잘못된 재사용을
막기 위해 이 미사용 helper와 해당 동작을 허용하던 테스트를 삭제했다. 생산 경로는 검증된
`MemeProducedVideoJsonLd` 하나만 남는다.

## 로컬 검증

- 5개 집중 Vitest 파일: 82개 통과
- 대상 파일 ESLint: 통과
- TypeScript `tsc --noEmit`: 통과
- 대상 diff check: 통과
- 실제 현재 로컬 데이터에는 영상이 연결된 밈 상세 fixture가 없어 브라우저 양성 화면 재생은
  재현하지 못했다. 로컬 컴포넌트 통합 테스트가 동일 DOM 안에서 iframe URL, 화면 제목·설명,
  `VideoObject` ID·`embedUrl` 일치를 검증한다.
- 현재 로컬 DB에서 이전 `devseed12` URL은 not-found 문서를 반환했으며 `iframe`과
  `VideoObject`는 모두 0개였다. 이를 영상 양성 검증으로 과장하지 않는다.

Google Search의 현재 공식 문서와도 계약이 일치한다. `VideoObject`는 사용자가 영상을 볼 수
있는 페이지에 있어야 하며, `name`, `thumbnailUrl`, `uploadDate`가 필요하고 실제 플레이어 URL을
`embedUrl`로 제공할 수 있다.

## 롤백

현재 checkout의 `components/json-ld.tsx`, `components/json-ld.test.tsx`에서 이번에 삭제한
레거시 helper와 테스트만 복원하면 된다. 데이터나 운영 상태 롤백은 없다.
