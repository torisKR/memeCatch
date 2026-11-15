# 공개 밈 자료를 답변 근거로 쓰는 캐릭터 챗봇

우측 하단 캐릭터를 누르면 질문을 입력하고 관련 밈 설명·상세 링크·근거 출처를 확인한다. 관리자·인증 화면에서는 숨기며, 열기만으로 서버 요청을 보내지 않는다. 답변은 HTML을 실행하지 않는 일반 텍스트다.

## PostgreSQL RAG 구성

질문 → 기존 E5 질의 임베딩 → Supabase pgvector 하이브리드 검색 → 공개 문서 제한 조회 → 답변 생성·인용 ID 검증 → 밈 카드.

[pgDash 원문](https://pgdash.io/blog/rag-with-postgresql.html)의 검색 후 생성 구조를 현재 Next.js 서비스에 맞춰 적용한다. 별도 pgDash 가입·Go 서버·Ollama 설치·새 벡터 DB는 필요 없다. 기존 384차원 E5 모델, prefix, 색인, 변경분 재색인 흐름을 유지한다. [Supabase 하이브리드 검색](https://supabase.com/docs/guides/ai/hybrid-search), [RAG 권한](https://supabase.com/docs/guides/ai/rag-with-permissions).

- 기존 `searchMemeReferences(question, 4)`를 재사용한다. 질문 전체가 NFKC·문장부호·대소문자 정규화 후 실제 공개 원문 또는 유효 번역 제목과 정확히 일치하면 해당 자료만 선택한다. 빈 정규화 키나 정확 일치가 없는 상황 질문은 기존 후보를 유지한다.
- 첫 공개 조회 후 선택된 ID만 생성 후 재조회한다. TMI처럼 정확 일치 한 건이면 두 번째 조회의 응답도 한 건으로 줄고, 해당 문서가 비공개로 전환되면 다른 후보를 되살리지 않고 자료 없음으로 끝난다.
- 익명 공개 Supabase 클라이언트와 기존 RLS로 `approved`·`limited`만 조회한다. service-role로 검색하지 않는다.
- 설명·유래·사용 팁·주의·연도 정확도와 유효 출처만 제한된 컨텍스트로 전달한다.
- 검색 내용과 질문을 명령이 아닌 데이터로 취급한다. 제공된 사실 밖의 기원·연도·권리·검증 상태를 만들어내지 않도록 지시한다. 생성문 모든 문장의 사실성을 자동 인증하는 기능은 아니다.
- 실제 인용한 최신 문서의 날짜 정밀도가 exact가 아니고 기원·연도 정보가 있으면 서버가 5개 언어의 고정 불확실성 안내를 붙인다. 출처 유무와 독립적으로 적용하며 캐시 답변에도 동일하다. year 정밀도를 미상으로 분류하지 않고, 자료보다 세밀한 날짜를 확정하지 않도록 안내한다. 운영 초기 QA에서 모델의 단정적인 날짜 표현을 확인한 뒤 15개 회귀 테스트를 추가했다.
- LLM의 인용 ID가 조회한 문서의 부분집합인지 검증한다. 모델이 URL·HTML·Markdown 링크를 생성하면 응답을 채택하지 않는다.
- 링크는 서버가 기존 경로 함수와 `citableSources`로 조립한다. 현재 검수된 번역과 공개 상세 자격을 확인할 수 있는 경우에만 언어별 상세 경로를 사용하고, 나머지는 원문 상세 경로로 연결한다. 추가 관계 조회를 늘리지 않아 일부 유효 번역도 보수적으로 원문 링크를 사용할 수 있다. URL 존재만으로 사실성·권리·외부 검증을 보장하지 않는다.
- 생성 후 공개 여부와 내용이 바뀌었으면 다시 조회한 자료를 제공한다. 캐시도 현재 공개 자료의 fingerprint가 같을 때만 재사용한다.
- 자료 없음·설정 없음·무료 모델 장애에는 생성 답변을 가장하지 않고 `empty`·`retrieved` 결과를 표시한다.

## 운영 생성과 요청 제한

기존 운영 `OPENROUTER_API_KEY`를 서버에서 재사용한다. 기존 MPE 모델·예산·관리자 생성 흐름은 변경하지 않는다.

기본 `openrouter/free`는 무료 모델 라우터다. `require_parameters: true`와 `max_price: { prompt: 0, completion: 0, request: 0 }`를 설정해 유료 제공자로 전환하지 않는다. [무료 라우터](https://openrouter.ai/openrouter/free), [제공자 가격 제한](https://openrouter.ai/docs/guides/routing/provider-selection).

- 사용자 제출에만 동작, 질문 최대 120자, 검색 최대 4건, 컨텍스트 최대 6,000자, 출력 최대 800토큰.
- 생성 timeout 12초, 요청 전체 deadline 25초.
- IP당 10분 5회, 인스턴스 전체 분당 20회. 기존 메모리 limiter이므로 여러 인스턴스의 전역 한도는 보장하지 않는다.
- 생성 응답 캐시 60초·최대 32개, 같은 질문·언어·자료 fingerprint의 진행 중 요청 공유.
- 한 사용자의 취소가 다른 공유 요청을 중단하지 않는다. 마지막 대기자까지 취소하면 생성 호출을 중단한다.
- 기존 공유 임베딩 호출은 자체 timeout을 유지한다. 취소된 챗봇 요청의 대기는 즉시 끝나지만 이미 시작한 공유 임베딩 계산이 즉시 종료된다는 뜻은 아니다.
- `MEME_CHAT_GENERATION_ENABLED=false`로 생성 호출을 끄고 공개 자료 검색을 유지할 수 있다.

토큰 가격 제한은 Supabase·Vercel의 리소스나 OpenRouter의 무료 호출 한도를 없애지 않는다. 한도 초과·장애 시 검색 카드로 전환한다. 새 API 키·계정·토큰을 만들지 않는다.

## 로컬 opencodex

사용자가 지정한 `http://localhost:10100/`의 `/v1/models`는 Chat Completions·Responses API 지원을 반환했다. `gpt-6.1-sol`로 구조화 JSON 요청 1회를 실제 검증했고 HTTP 200·유효 JSON·finish_reason stop, 약 5.01초였다. 전체 RAG 연결 검증 결과는 아래에 별도로 기록한다.

격리 작업 사본의 무시되는 `.env.local`에 다음 설정을 사용한다.

```dotenv
MEME_CHAT_PROVIDER=opencodex
MEME_CHAT_BASE_URL=http://127.0.0.1:10100/v1
MEME_CHAT_MODEL=gpt-6.1-sol
```

로컬 loopback에만 허용한다. 기존 인증이 필요할 때만 이미 보유한 `MEME_CHAT_API_KEY`를 서버에 설정한다. OpenRouter 키를 이 주소로 전달하지 않는다.

배포된 Vercel의 localhost는 사용자 Mac이 아니다. 이 주소를 운영 설정에 복사하면 연결할 수 없다. 운영에서 opencodex를 쓰려면 인증된 외부 HTTPS 서비스, 접근 제한, 안정적인 운영과 가용성 검토가 추가로 필요하다. 이번 구현은 그 터널이나 공개 노출을 만들지 않는다.

## 데이터·개인정보 범위

질문과 공개 밈 자료를 생성 서비스로 전송한다는 안내를 제출 전에 표시한다. 밈캐치가 별도 대화 테이블을 만들거나 대화를 영구 저장하지 않는다. 화면 대화는 메모리에서만 최대 6개 보관한다. 생성 서비스 또는 opencodex 자체 로그 설정은 별도다. 질문·벡터·비밀값을 애플리케이션 오류 메시지나 로그에 출력하지 않는다. 생성 불채택 진단은 고정 provider·reason과 유효 HTTP status만 기록한다. 원문 오류·응답·헤더·모델 출력은 기록하지 않는다. 각 질문은 현재 입력만으로 자료를 검색하며 화면의 과거 대화를 생성 컨텍스트에 다시 보내지 않는다.

콘텐츠 출처 부족·잘못된 설명은 RAG만으로 해결되지 않는다. 기존 수동 사실·권리 검수가 필요하다. 출처 없는 자료의 기원과 연도를 검증된 사실로 제시하지 않는다.

## 검증 기록

실제 로컬 브라우저에서 Supabase 공개 TMI 문서를 검색하고 opencodex가 생성한 답변·TMI 상세 카드·나무위키 출처를 확인했다. 생성은 `generated`, 로컬 검색은 설정에 따라 `keyword`였다. 모바일·데스크톱, 열기만으로 요청 없음, Escape와 포커스 복귀, 대화 지우기, 영어 화면, 로그인 화면 숨김을 검증했다. 기존 브라우저 탭을 접근하지 않았으며 그 외 쓰기 요청은 테스트 브라우저에서 차단했다.

최종 전체 회귀는 386파일·3,176테스트 통과, `tsc --noEmit` 통과, 전체 ESLint 오류 0·기존 이미지 경고 6건이었다. 기본 lint 제외 대상 품질 스크립트도 별도로 검사했다. 로컬 production 빌드는 단일 worker로 정적 108페이지 생성까지 통과했고 홈의 60초 ISR을 유지했다. 기존 metadataBase 경고는 남아 있다.

320×568의 작은 화면과 다크 모드를 포함해 수평 넘침·페이지 오류 0이었다. 상위 모달의 Escape와 설치 배너는 실제 브라우저에서 DOM으로 시뮬레이션해 충돌 방지를 확인했다. 관리자 쓰기·모델 실패·취소·재등록은 단위 회귀 검증이며 실제 운영 콘텐츠를 게시하거나 삭제해서 시험하지 않았다.

[검증 요약](../artifacts/qa/20261007/browser-verification.json), [실제 모바일 답변](../artifacts/qa/20261007/13-chat-mobile-answer.png), [HTML 리포트](../artifacts/reports/memecatch-rag-20261007.html).

운영 소스 `a316602`는 Vercel 배포 `dpl_5kC5DDBLF19RzoNX2uoc9rvwnUz2`에서 READY를 확인했고 catchmeme.com의 연결과 기존 9개 cron 정의를 확인했다. 같은 소스의 첫 빌드는 외부 임베딩 모델 다운로드 HTTP 503으로 실패했으며, 동일 커밋 재배포 1회로 복구했다.

최종 실제 운영 브라우저 요청은 HTTP 200, `retrieved` / `hybrid`, TMI 근거 카드 1건이었다. 모바일·데스크톱·320×568·다크 화면, Escape·포커스 복귀, 로그인 화면 숨김을 통과했고 페이지 오류와 수평 넘침은 0이었다. 초기 운영 QA에서는 무료 모델의 `generated`도 확인했지만, 최신 요청에서 생성 성공이나 안정적인 무료 모델 가용성을 확인한 것은 아니다. Vercel 경고 로그 조회는 성공했으나 해당 생성 진단 행이 없어 마지막 생성 불채택 원인은 확정하지 않았다. 로컬 opencodex 생성 성공과 운영 무료 생성의 가용성을 구분한다.

[최종 운영 브라우저 기록](../artifacts/qa/20261007/production-browser-verification.json), [운영 모바일](../artifacts/qa/20261007/18-production-chat-mobile.png), [생성 진단 조회 결과](../artifacts/qa/20261007/generation-diagnostics.json). 이번 운영 검증에서 공개 데이터의 게시·삭제·마이그레이션·수동 재색인은 수행하지 않았다.
