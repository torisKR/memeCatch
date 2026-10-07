# 밈캐치 챗봇 캐릭터 리뉴얼 인계

우측 하단 런처와 채팅 패널을 브랜드 오렌지의 커스텀 SVG 캐릭터로 교체했다. 대기 화면은 실제 처리 단계에 따라 책(질문 확인), 돋보기(검색), 체크(자료 발견), 말풍선(답변 준비)을 표시한다. 유효한 질문을 로컬에서 확인한 직후 `reading` 상태를 시작하므로 응답 헤더를 기다리는 동안에도 책이 보인다. 타이머나 가짜 완료율은 사용하지 않는다.

- 기존 `/api/memes/chat`에 `Accept: application/x-ndjson`으로 요청한다. 진행 이벤트와 최종 결과를 읽고 기존 JSON 응답도 지원한다.
- `found` 이벤트의 실제 개수만 표시한다. 1~4개는 자료 발견 표시를 유지하며 답변을 기다리고, 0개는 중립 캐릭터와 자료 없음 문구를 표시한다.
- Motion으로 열기 280ms, 닫기 170ms 전환을 적용했다. 닫는 즉시 `aria-hidden`, `inert`, 포인터 차단과 요청 취소를 적용하고 런처로 포커스를 돌린다. 닫기·대화 지우기·경로 변경·언마운트 이후 오래된 진행/결과는 무시한다. 모션 감소 설정에서는 이동과 전환 시간을 없앤다.
- 비모달 동작, 모바일 안전 영역, 상위 모달 Escape 처리, PWA 배너 충돌 방지, 최근 6턴, 초안·오류·출처·5개 언어를 유지한다.
- 자체 `useSyncExternalStore` hydration snapshot으로 서버와 첫 hydration에서는 경로의 기본 언어를 사용하고, 이후 사용자 언어를 적용한다. 명시적 언어 경로가 우선하며, 전역 언어 provider와 정적/ISR 렌더링 설정은 변경하지 않았다.

보안·인증·요청 제한·공개 자료 조회·답변 생성과 비용 범위는 유지했다. 진행 알림 때문에 모델이나 DB를 추가 호출하지 않으며 새 의존성도 추가하지 않았다.

## 검증 근거

| 검증 | 결과 |
| --- | --- |
| 전체 Vitest, worker 1개 | 387개 파일 / 3,263개 테스트 통과, 76.63초 |
| TypeScript 검사 | 종료 코드 0 |
| 챗봇 집중 테스트 | 52개 통과; 실제 SSR/hydration, 취소·오래된 응답, 실제 Motion 포함 |
| 전체 ESLint | 종료 코드 0; 기존 `no-img` 경고 6개 |
| Production build | `CIRCLE_NODE_TOTAL=1 npm run build` 종료 코드 0; Next 16.3.4 / webpack, worker 1개, 정적 페이지 108개 |

로컬 semantic 기능이 꺼져 있어 모델 준비 단계는 생략되었으며, 기존 `metadataBase` 경고는 남아 있다. 로컬 미디어 프록시는 운영 비밀 키를 복사하지 않아 검증 범위에서 제외했다.

첫 로컬 브라우저 검증에서는 162개 assertion을 확인한 뒤 개발 `/zh` token 오류로 중단했다. `/explore` 언어 hydration 오류도 후속 점검에서 발견해 수정했다. [최초 보고서](../artifacts/qa/20261007-chat-renewal/chat-renewal-qa.json)와 [언어 오류 보고서](../artifacts/qa/20261007-chat-renewal/chat-renewal-locale-followup.json)는 실패 근거로 보존했다. 수정 후 [후속 보고서](../artifacts/qa/20261007-chat-renewal/chat-renewal-resolved-followup.json)는 **50/50 통과**, 페이지 오류 0개, 네트워크 채팅 요청 0개를 기록한다.

진행 단계 브라우저 검증은 주입한 NDJSON/지연 fetch를 사용했다. [헤더 도착 전 질문 확인](../artifacts/qa/20261007-chat-renewal/23-resolved-mobile-reading-before-headers.png)과 [주입한 검색 상태](../artifacts/qa/20261007-chat-renewal/06-mobile-simulated-searching.png)는 실제 모델 응답 근거와 구분한다.

실제 TMI 질문 검증은 **1회 호출**에서 HTTP 200 NDJSON, `generated` 답변, `keyword` 검색, 참조 1개를 확인했다. [실제 모바일 답변](../artifacts/qa/20261007-chat-renewal/18-live-mobile-result.png)과 [데스크톱 패널](../artifacts/qa/20261007-chat-renewal/02-desktop-open.png)을 참고한다. 이후 언어·hydration·질문 확인 후속 검증에서는 모델을 추가 호출하지 않았다.

운영 반영은 Git에 연결된 `main` 배포로 진행한다. 정확한 커밋의 배포가 `READY`인지, `catchmeme.com` alias와 기존 cron 9개가 유지되는지, 채팅을 제출하지 않는 운영 UI smoke가 통과하는지 확인한다. 최종 배포 근거는 [QA artifact 디렉터리](../artifacts/qa/20261007-chat-renewal/)에 보관하고 실제 배포 결과는 별도로 보고한다. 이 문서는 배포 완료나 특정 커밋 식별자를 주장하지 않는다.
