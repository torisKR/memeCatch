# 밈 콘텐츠 제작을 위한 검색 기반과 다음 단계

2026-10-04(Asia/Seoul) 기준 구현·운영 안내. 운영 읽기 조회에서 전체 밈 5,018건, 공개 `approved`/`limited` 4,378건을 확인했다. **이번 벡터 마이그레이션·운영 backfill·배포는 아직 대기(PENDING)** 상태다. 실제 실행 이후의 테스트 결과와 완료 여부는 작업 보고서에서 별도로 확인한다.

## 이번에 구현한 범위

기존 Supabase PostgreSQL에 `pgvector`를 사용하여 공개 밈의 **상황·의미 검색**, **관련 밈**, **Studio 제작 참고 검색**을 연결했다. 예를 들어 정확한 밈 이름을 모르더라도 “월요일 출근하기 싫은 상황”으로 제작 참고 자료를 찾는 것이 목표다. 기존 이름·별칭 검색과 태그·카테고리 추천은 계속 사용한다.

벡터 검색은 PostgreSQL 전체의 성능을 올리는 장치가 아니다. 의미가 비슷한 자료를 DB 안에서 찾아 필요한 후보만 반환하도록 돕는다. 일반 목록·통계 조회의 요청 감소는 기존 서버 캐시와 집계 RPC가 담당한다. 의미 검색을 추가하면 임베딩과 DB 연산이 늘어나므로 비용 절감을 보장하지 않는다.

| 구현 | 동작 |
| --- | --- |
| 공개 카탈로그 벡터 | `private.meme_semantic_embeddings`, 밈당 384차원 벡터 하나, 모델 프로필 고정 |
| 의미 후보 조회 | `match_meme_embeddings`, cosine 순위, 공개 `approved`/`limited`만, 최대 40건 |
| 관련 밈 | `related_meme_embeddings`, 저장된 벡터 재사용, 모델 서버 호출 없음 |
| 검색·Studio | 사용자가 참고 검색 버튼을 눌렀을 때만 의미 검색 요청, 이름·별칭 결과와 reciprocal rank fusion으로 결합 |
| 실패 시 처리 | 기능 꺼짐·모델 장애·미적용 RPC·빈 인덱스는 기존 이름·별칭 검색으로 복귀 |
| 변경 처리 | 원문 필드 또는 검수 상태 변경 시 벡터 제거; 유행 점수·`updated_at`만 바뀌면 유지 |
| 저장 보호 | 서버 원문 해시 재검증과 부모 행 잠금으로 오래된 생성 결과 저장 방지 |
| 작업 제한 | 서비스 전용 RPC, 배치 최대 100개·실행당 최대 100배치(총 10,000개), 기본 25개·1배치, 처리 후 종료 |

DB 테이블은 REST에 노출하지 않는 `private` 스키마에 있다. 익명·일반 사용자·운영자에게 공개 상태인 부모 밈의 벡터만 읽도록 RLS를 적용한다. 쓰기는 기존 `service_role`을 사용하는 인덱서만 가능하다. 공개 검색 결과에는 벡터와 원문 전체를 보내지 않는다. 외부 밈을 자체 제작으로 분류하거나 검색 결과를 재사용 허가로 취급하지 않는다.

## 모델과 문서 계약

로컬 인덱서 `scripts/meme_embeddings.py`와 Vercel CPU의 HTTPS 질의 임베딩은 `intfloat/multilingual-e5-small`의 다음 revision과 FP32를 고정한다.

```text
model_profile = multilingual-e5-small-v1
revision      = 614241f622f53c4eeff9890bdc4f31cfecc418b3
dimensions    = 384
dtype         = fp32
```

질의에는 `query: `, 카탈로그 문서에는 `passage: ` 접두어를 붙인다. attention mask를 적용한 평균 pooling과 L2 정규화를 사용하고 최대 512토큰에서 잘라낸다. 384차원이라는 이유만으로 다른 모델의 벡터를 함께 검색해서는 안 된다. 모델 revision·접두어·pooling·문서 구성 변경은 새 모델 프로필과 전체 재색인을 함께 기획해야 한다.

문서는 제목 → 별칭 → 요약 → 설명 앞 3,000자 → 기원 앞 1,500자 → 활용 안내 앞 1,000자를 연결하고 공백을 정규화한다. **최종 문서 전체는 6,900자까지** 사용한다. 이 동일한 문서의 MD5를 변경 감지용 `source_hash`로 사용하며 보안용 해시나 미디어 중복 판정으로 사용하지 않는다. 실제 모델 입력은 512토큰까지만 처리하므로 긴 문서의 뒤쪽 내용은 검색에 반영되지 않을 수 있다. 향후 긴 대본·자막 검색에는 출처를 가진 별도 chunk 모델이 필요하다.

카탈로그 색인 대상은 공개 상태의 텍스트다. Python 인덱서의 첫 실행은 모델 파일 다운로드를 포함할 수 있고 파일은 Git에서 제외된 `.local/vector-models`에 저장한다. 스크립트가 패키지를 설치하거나 유료 임베딩 API를 호출하지 않는다. 기존 Python 환경에서 CPU 스레드 하나로 실행하므로 API 사용료를 추가하지 않지만 Mac의 메모리·CPU·다운로드 비용과 Supabase의 저장·검색 부하는 발생한다. 별도 `toris_studio` 작업과 동시에 대량 색인하지 않는다.

운영 질의용 ONNX 파일은 `scripts/prepare-meme-embedding-model.mjs`가 **빌드 전에** `.local/embedding-models/intfloat/multilingual-e5-small`에 준비한다. 고정 revision의 root `config.json`, `tokenizer.json`, `tokenizer_config.json`, `special_tokens_map.json`, `onnx/model.onnx`만 내려받고 파일 크기·공식 체크섬을 검사한다. root와 `onnx` 디렉터리의 tokenizer 파일은 동일한 체크섬이다. FP32 ONNX의 SHA-256은 `ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665`이다. 검증된 파일은 재사용하고 실패·취소 시 임시 파일을 정리한다. 전체 성공 후 `manifest.json`에 모델·revision·FP32·384차원과 파일별 SHA-256·크기를 원자적으로 기록한다.

Next.js의 파일 추적은 이 모델 자산을 `/v1/embeddings` 함수에만 포함한다. 런타임은 manifest를 확인하고 로컬 FP32 파일만 로드하며 원격 모델 다운로드를 차단한다. 동일 모델의 ONNX와 Python 결과도 실제 한국어 질의의 벡터·검색 순위 비교를 통과한 뒤 활성화한다. 양자화 모델이나 다른 revision으로 조용히 대체하지 않는다.

기존 MPE의 `mpe-text-embedding-v1` fingerprint는 별도 흐름이다. 그 벡터나 비공개 업로드 자료를 이번 공개 카탈로그 벡터에 섞지 않는다.

## exact 검색으로 시작하는 이유

약 5천 밈의 초기 규모에서는 cosine **exact 검색**을 사용한다. vector payload만 계산하면 밈 5,000개 × `(384 × 4 + 8)`바이트 ≈ **7.72MB**이며 실제 DB 사용량에는 행·키·메타데이터·인덱스·페이지 여유 공간이 더해진다. 전체 DB나 상주 메모리가 이 수치만큼만 늘어난다는 뜻은 아니다.

HNSW는 이번 마이그레이션에 추가하지 않았다. 먼저 실제 공개 후보 수, p50/p95 지연, 피크 요청량, DB CPU·메모리·IO와 검색 품질을 측정한다. 의미 검색이 반복적으로 지연 목표를 넘거나 벡터 수가 커질 때 exact 기준 결과에 대한 recall@K와 메모리 증가를 비교하여 HNSW를 선택한다. HNSW를 도입하면 공개 상태 필터와 RLS 적용 후에도 충분한 후보를 반환하는지 다시 검증해야 한다. 인덱스 구축·쓰기 비용과 필터에 따른 결과 누락도 평가 대상이다. [pgvector 공식 문서](https://github.com/pgvector/pgvector#filtering)

캐시도 범위를 구분한다. 서버의 질의 벡터 캐시와 bundled 모델의 캐시는 성공 응답만 각각 최대 64개·5분간 보관하고 동일 요청을 합친다. bundled 런타임은 CPU 스레드 하나와 인스턴스당 추론 한 건으로 제한한다. 다른 질의를 처리 중이면 새 추론을 대기열에 쌓지 않고 실패 응답으로 돌려 기존 검색을 사용한다. 모델 초기화 실패 뒤에는 30초 동안 재초기화를 막으며 다음 요청에서 다시 시도한다. Python 개발용 서버도 최근 질의 64개를 메모리에 보관한다.

이 캐시와 limiter는 프로세스별이므로 Vercel의 서로 다른 인스턴스가 공유하지 않는다. 공개 검색 API는 분당 20회, 서명된 임베딩 경로는 IP 기준 분당 30회 제한이 있지만 전역 과금 한도는 아니다. Redis는 실제 반복 요청과 다중 인스턴스 부하를 측정한 뒤 공유 캐시·전역 제한이 필요할 때 추가한다.

## 로컬 실행 안내

다음 명령은 프로젝트 루트에서 실행한다. `python3`는 `torch`, `transformers`, `safetensors`가 이미 준비된 Python 환경의 실행 경로로 바꿀 수 있다. 모델 서버와 색인은 따로 실행하며 다른 프로젝트의 서버를 중단하지 않는다.

1. **먼저 로컬 DB에서 롤백 검증한다.** 기존 로컬 Supabase를 사용하고 데이터 초기화·운영 DB 연결을 하지 않는다. 아래 접속값은 로컬 기본값이며 프로젝트 설정에서 포트를 확인한다. 오류 시 `ON_ERROR_STOP`으로 연결이 종료되어 열린 트랜잭션이 롤백된다.

   ```sh
   psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
     -v ON_ERROR_STOP=1 \
     -c BEGIN \
     -f supabase/migrations/20261003123428_meme_catalog_vectors.sql \
     -f supabase/tests/meme_catalog_vectors.sql \
     -c ROLLBACK
   ```

   이 테스트는 신규 마이그레이션이 아직 적용되지 않은 로컬 DB를 대상으로 한다. 이미 적용된 DB에 같은 `CREATE TABLE` 마이그레이션을 다시 실행하지 않는다. 검증을 통과한 뒤 색인·브라우저 QA용 로컬 DB에만 해당 마이그레이션을 별도로 적용한다. 원격 migration history와 혼동하지 않는다.

   이번 QA에서는 해당 SQL만 로컬 DB에 적용하고 공개 17건을 색인했다. 기존 밈 22건과 공개 상태는 유지했으며 QA 앱·모델 서버는 종료했다. 로컬에서 중복 적용되지 않도록 신규 버전 한 건만 로컬 이력에 기록한다. 운영의 기존 이력을 repair하거나 재적용하지 않는다.

2. **로컬 카탈로그를 소량 색인한다.** `--local`은 Supabase CLI가 제공하는 기존 로컬 서비스 키를 프로세스 안에서 사용하며 출력하지 않는다.

   ```sh
   python3 scripts/meme_embeddings.py index --local --limit 25
   ```

   완료 출력의 `batch`, `batch_indexed`, `batch_stale`, 누적 `indexed`와 `stale`를 확인한다. 기본은 25개·1배치이며 `--batches`로 종료 지점을 명시할 수 있다. 모델은 처리할 문서가 있을 때만 한 번 초기화하고 최대 4개씩 순차 생성한다. 이후 배치는 직전 마지막 밈 ID를 keyset cursor로 사용한다. 빈 배치에서 즉시 종료하고 저장 오류 시 재시도 없이 중단한다. 이미 원자적으로 저장된 문서는 다음 실행에서 건너뛰므로 재개할 수 있다. `stale`는 같은 실행에서 재시도하지 않고 다음 새 실행에 남긴다. `stale`가 반복되거나 진행하지 않으면 수정·검수 상태 변경을 먼저 확인한다. 원격 쓰기는 기본 차단된다.

3. **별도 터미널에서 모델 서버를 실행한다.** 이 HTTP 서버는 개발용이며 loopback만 바인딩하고 브라우저 Origin과 외부 Host를 거부한다. 인터넷에 노출하지 않는다.

   ```sh
   python3 scripts/meme_embeddings.py serve --port 8766
   ```

   ```sh
   curl --fail http://127.0.0.1:8766/health
   ```

   정상 응답은 `model: multilingual-e5-small-v1`, `dimensions: 384`를 포함한다. 사용을 마치면 해당 터미널에서 Ctrl+C로 이 모델 서버만 종료한다.

4. **Next.js 서버의 로컬 환경을 설정하고 재시작한다.** 키를 클라이언트 환경변수에 넣지 않는다.

   ```dotenv
   MEME_EMBEDDING_RUNTIME=
   MEME_SEMANTIC_SEARCH_ENABLED=true
   MEME_EMBEDDING_URL=http://127.0.0.1:8766/v1/embeddings
   MEME_EMBEDDING_API_KEY=
   ```

   `/search`에서 상황 문장으로 검색한 뒤 “상황·의미로 찾기”를 눌러 결과를 확인한다. Studio의 “제작 참고 밈 찾기”와 상세 페이지 관련 밈도 확인한다. 입력만 변경하면 의미 검색을 자동 호출하지 않는다. 취소·빈 결과·장애·재시도를 확인하고 모델 서버를 끈 경우 이름·별칭 결과가 표시되는지도 확인한다. 브라우저 취소는 화면 요청을 중단하며 이미 시작된 공유 서버 연산의 즉시 종료까지 보장하지는 않는다. 이 외부 제공자·개발용 연결은 최대 6초, bundled HTTPS 연결은 cold start를 고려해 최대 30초를 기다린다.

5. **검증을 기록한다.** 테스트와 실제 모델 호출·브라우저 QA 결과는 각각 기록하고 운영 검증으로 부풀리지 않는다.

   ```sh
   pnpm exec vitest run components/meme-reference-search.test.tsx --maxWorkers=2
   pnpm exec tsc --noEmit
   ```

   서버 helper·검색 API·SQL의 회귀 테스트도 변경 범위에 맞춰 실행한다. 실제 모델 품질은 별도로 한국어 질의와 기대하는 밈을 지정한 평가표로 확인한다. “출근·퇴근”, “친구 놀리기”, “고양이”, “반어·풍자”처럼 이름을 직접 말하지 않는 상황을 포함하여 이름·별칭 기준 결과와 비교한다. 숨김 밈이 더 가까워도 공개 결과에 나오지 않아야 한다.

## Vercel HTTPS 경로와 운영 활성화 절차

Vercel에서 `127.0.0.1`은 사용자 Mac이 아니다. 운영에서는 같은 배포 안의 **bundled CPU `/v1/embeddings` HTTPS 경로**를 사용한다. Mac 개발용 모델 서버를 인터넷에 노출하지 않는다. 로컬 기본 설정은 runtime을 비우고 `MEME_SEMANTIC_SEARCH_ENABLED=false`로 두므로 모델 준비·의미 검색은 자동으로 켜지지 않는다.

운영 후보 환경의 설정은 다음과 같다. 먼저 의미 검색 flag를 `false`로 둔 배포에서 연결·성능·권한을 검증하고 마지막에 `true`로 변경한다.

```dotenv
MEME_EMBEDDING_RUNTIME=bundled
VERCEL_SUPPORT_LARGE_FUNCTIONS=1
MEME_SEMANTIC_SEARCH_ENABLED=false
```

bundled 모드에서는 Vercel이 제공하는 `VERCEL_URL`로 **자기 배포의 HTTPS 주소**를 구성하므로 `MEME_EMBEDDING_URL`이나 새 API 키가 필요하지 않다. 기존 서버 전용 `CRON_SECRET`로 질의·프로필·timestamp를 HMAC 서명하며 시각 허용오차는 30초다. `/v1/embeddings`는 이 서명을 확인하고 정규화된 `query: ` 입력 한 건·질의 2~120자만 허용한다. `passage: ` 색인 요청, 서명 없는 브라우저 요청, 잘못된 모델·서명은 거부한다. 서버 비밀값은 클라이언트 번들·로그·문서에 기록하지 않는다. 새로운 인증 토큰이나 관리자 권한을 만들지 않는다.

Deployment Protection이 적용된 배포에서는 **기존 자동화용** `VERCEL_AUTOMATION_BYPASS_SECRET`가 제공될 때만 `x-vercel-protection-bypass` 헤더를 자기 `VERCEL_URL` 요청에 보낸다. 임의 외부 제공자에는 보내지 않는다. 이 값이 없거나 보호를 통과하지 못하면 차단 상태를 보고하며 보호를 제거하거나 새 우회 키를 만들지 않는다.

1. **모델을 빌드에 준비하고 검증한다.** `build` 스크립트는 `node scripts/prepare-meme-embedding-model.mjs --if-enabled`를 먼저 실행한다. runtime이 `bundled`일 때만 준비하며, 이후 명령은 로컬 파일·manifest만 검사하고 다운로드하지 않는다.

   ```sh
   node scripts/prepare-meme-embedding-model.mjs --check
   ```

   배포 대상 소스 목록을 기준으로 별도 임시 폴더에 준비한다. 새 구현 파일은 배포 대상에 명시적으로 포함하고 개발용 `.local` 캐시·`.env`·DB 백업·개인 에이전트 폴더를 통째로 업로드하지 않는다. 모델은 해당 staging의 빌드 단계에서 준비하여 `/v1/embeddings` 함수에만 포함한다. 기존 Vercel 프로젝트·계정 연결을 유지하고 새 프로젝트나 유료 제공자를 생성하지 않는다.
2. **도메인을 전환하지 않은 보호된 production 배포에서 검증한다.** 기존 프로젝트에 CLI의 `--prod --skip-domain`으로 배포해 운영 환경의 자격증명·Protection·2 GB 함수 조건을 사용하되 `catchmeme.com` 도메인은 기존 배포에 유지한다. 의미 검색 flag도 `false`로 유지한다. 이 배포의 URL에서 정상 서명·실패 서명·미설정 secret·잘못된 입력·자기 HTTPS 연결을 검증한다. 실제 한국어 입력을 Python FP32와 비교하고 Vercel Linux 함수의 cold/warm 지연·최대 RSS·CPU를 기록한다. **로컬 Mac에서 관측한 약 1.66 GB RSS는 Vercel Linux의 2 GB 조건을 통과했다는 증거가 아니다.** 이 단계가 통과하기 전에는 운영 벡터 DB 쓰기를 진행하지 않는다.

   bundled 호출자는 최대 30초, 기존 외부 제공자 연결은 6초를 기다린다. 제한 시간이 끝나도 이미 시작된 native 추론이 즉시 취소된다고 보장하지 않는다. 초기화 실패 후 재시도는 30초 뒤의 새 요청에서 가능하다.
3. **검증된 경로가 확보된 뒤 신규 SQL만 적용한다.** 기존 Supabase 프로젝트의 vector 확장·schema·migration history와 이번 버전을 조회하고 아직 없는 이번 신규 마이그레이션만 적용한다. `private`를 REST exposed schemas에 추가하거나 기존 migration history를 repair하지 않는다. 기존 RLS·운영자 권한도 확대하지 않는다.
4. **승인된 공개 문서를 제한된 배치로 색인한다.** 기존 `NEXT_PUBLIC_SUPABASE_URL`, 서버 전용 `SUPABASE_SERVICE_ROLE_KEY`를 승인된 프로세스 환경에서 사용한다. 비밀값을 터미널 명령·문서·출력에 붙여 넣지 않는다. 아래 예시는 최대 100개 × 50배치이며 빈 배치에서 일찍 종료한다.

   ```sh
   python3 scripts/meme_embeddings.py index --allow-remote --limit 100 --batches 50
   ```

   모델 초기화는 작업이 있을 때 한 번만 수행한다. 배치별 누적 출력과 실제 공개 문서 커버리지를 확인하고 실패 시 종료된 실행을 다시 시작한다. 이 스크립트를 페이지 요청이나 Vercel 함수 안에서 실행하지 않는다. 운영 공개 문서 수는 실행 중 변경될 수 있으므로 4,378건을 영구 고정값으로 취급하지 않는다. 보호된 배포에서 실제 검색 순위·공개 필터와 전체 흐름을 확인한다.
5. **마지막에 feature flag와 도메인을 전환한다.** `MEME_SEMANTIC_SEARCH_ENABLED=true`인 운영 후보를 검증한 뒤 승인된 도메인을 해당 배포로 전환하고 검색·Studio 참고 검색·관련 밈과 장애 fallback을 확인한다. 이 flag는 의미 검색과 벡터 기반 관련 추천을 함께 제어한다. 문제가 생기면 flag를 `false`로 되돌리거나 기존 배포로 도메인을 복구하여 기존 이름·별칭 검색을 유지하고 원인을 조사한다. 임베딩 생성이나 flag 변경은 밈 공개 여부·권리 검수 상태를 변경하지 않는다.

Vercel Hobby는 CPU 추론이 포함된 **전체 앱 합산**으로 Active CPU 4시간·Provisioned Memory 360 GB시간을 공유한다. Hobby 함수는 2 GB·1 vCPU이며, 표준 Node 번들 250 MB를 넘는 FP32 모델은 Fluid compute·Active CPU가 켜진 Large Functions Beta(최대 5 GB)를 사용해야 한다. 기존 프로젝트는 `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`로 참여할 수 있지만 실제 플랫폼 적용과 배포 크기를 확인해야 한다. 기능을 추가해 비용이나 서버 부하가 줄었다고 보장하지 않는다. 캐시 적중을 제외한 질의당 실측 CPU가 `t`초라면 `14,400 / t`는 이 기능만 계산한 이론적 상한이며 기존 앱·cold start 사용량을 빼야 한다. [Vercel 함수 한도](https://vercel.com/docs/functions/limitations), [Hobby 사용량](https://vercel.com/docs/plans/hobby)

**재색인은 자동 백그라운드 작업이 아니다.** 제목·별칭·설명·기원·활용 문서나 검수 상태가 바뀌면 기존 벡터가 무효화되고, 운영자가 인덱서를 다시 실행할 때까지 해당 의미 후보·관련 추천이 빠질 수 있다. 관리자는 정기적으로 누락·stale 건수와 변경량을 확인하고 제한된 색인을 실행한다. 자동 큐·재시도·주기 작업은 후속 구현으로 남긴다. 현재 이 문서의 마이그레이션·backfill·배포 상태는 모두 대기이며 실제 수행 결과로 갱신해야 한다.

## 이후 제작 파이프라인 기획

다음은 이번 변경으로 완성된 기능이 아니라 후속 구현 계획이다. 우선 한 콘텐츠를 처음부터 끝까지 수동으로 검증한 뒤 단계별 자동화를 붙인다.

```mermaid
flowchart LR
  A[공개 밈 검색·근거 선택] --> B[내 소유 원본 자산]
  B --> C[대본·장면 계획]
  C --> D[렌더·미리보기]
  D --> E[권리·사실 검수]
  E --> F[명시적 YouTube 게시 승인]
  F --> G[플랫폼 ID·URL 저장]
  G --> H[사이트 임베드 검수·수동 공개]
  H --> I[성과 집계·다음 기획]
```

| 후속 단계 | 데이터와 완료 조건 |
| --- | --- |
| 제작 프로젝트 | 소유자, 목적, 참고 밈 ID, 대본 버전, 선택한 근거와 출처를 기록. 외부 밈과 자체 제작 결과의 관계를 명시 |
| 소유 자산 관리 | 원본 이미지·음성·영상은 비공개 owner 권한과 권리 증빙을 갖춤. 공개 밈 인덱스와 별도의 소유자별 인덱스 사용 |
| 대본·스토리보드 | 검색된 자료는 근거로만 사용. 생성 문구와 사실 주장을 구분하고 운영자가 확인할 수 있는 초안을 저장 |
| 렌더 작업 | 요청 ID로 중복 실행 방지, 시도 횟수·실패·취소·진행률 기록, 결과 미리보기. 페이지 요청과 긴 렌더 작업 분리 |
| 권리 검수 | 원본·음악·인물·참고 자료 사용 근거를 확인한 뒤 승인. 높은 벡터 유사도는 권리 허가나 사실 확인이 아님 |
| 플랫폼 게시 | 기존 계정 연결과 최소 권한이 확보된 후 별도 구현. 최종 영상·채널·제목·공개 범위를 보여주고 명시적 게시 확인. 예약·업로드·공개 단계를 구분 |
| 사이트 표시 | 플랫폼 video ID와 검증한 URL, 게시 상태, 미디어 가용성과 카탈로그 관계를 저장. 기존 임베드·출처 검수와 수동 공개를 사용 |
| 성과 피드백 | 조회·시청 지속·클릭 등의 출처별 집계, 수집 주기·마지막 성공·실패 표시. 작업 ID·기간별로 중복 반영 방지 |

영상 자체의 호스팅 트래픽은 플랫폼 임베드를 사용하고 사이트에는 카탈로그 정보와 연결만 보관하는 구성을 우선한다. 플랫폼 임베드 정책과 실제 권리는 별도 확인 대상이다. 이번 작업은 YouTube 업로드·예약 게시·새 OAuth 권한·자동 공개를 추가하지 않는다.

벡터의 다음 적용 순서는 **공개 밈 참고 검색 → 근거를 포함한 기획 자료 검색 → 내가 보유한 자산 검색 → 대본·자막 chunk 검색**이다. 게시 관리·소유권·권리 상태·렌더 진행률·매출·성과 집계는 관계형 테이블과 명시적인 상태 전이를 사용한다. 생성 AI를 도입할 때는 검색 결과의 밈 ID·원문 버전·출처를 초안에 함께 보관하여 나중에 수정·검수가 가능하도록 한다.

참고 문서: [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector), [pgvector](https://github.com/pgvector/pgvector), [multilingual-e5-small 모델 카드](https://huggingface.co/intfloat/multilingual-e5-small).
