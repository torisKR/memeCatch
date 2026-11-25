# MemeCatch 하네스 실행 환경

## 도구와 재현

| 구성 | 기준 |
| --- | --- |
| 호스트 | Git worktree와 Bash를 지원하는 macOS 또는 Linux. Docker 이미지·백업 복구까지 CI와 동일하게 돌리는 환경은 전용 Linux Docker daemon이 있는 Ubuntu 러너다. |
| Node / pnpm | CI는 Node 22와 pnpm 10을 사용한다. 새 worktree에서는 `pnpm install --frozen-lockfile`로 설치한다. `pnpm` 10이 PATH에 있어야 하며, pnpm 10 실행은 `npx pnpm@10`으로도 확인할 수 있다. |
| Rust | 별도 `rust-toolchain*` 파일 없이 CI가 1.96.0을 지정한다. `rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy`. 하네스는 `RUSTUP_TOOLCHAIN=1.96.0`, `CARGO_INCREMENTAL=0`을 사용한다. |
| 미디어 / 브라우저 | FFmpeg·ffprobe 5.1 이상과 lavfi, libx264, AAC, ASS 지원. CI는 해시가 고정된 static FFmpeg 7.1을 사용한다. Behaviour는 `pnpm exec playwright install --with-deps --only-shell chromium`(Ubuntu), OpenSSL, curl을 사용한다. |
| Postgres | `server/scripts/test-db.sh up`은 임시 비밀번호를 만들고, Docker의 pgvector PG16에 bootstrap과 `db/migrations/`를 적용한다. 테스트 프로세스 안에서만 `DATABASE_URL`을 받아 사용하고 출력하지 않는다. `down`으로 자기 컨테이너와 볼륨을 정리한다. |
| 디스크 | 작업 전과 각 명령 시작 전에 여유 공간 10 GiB를 확인한다. macOS에서 수동 점검은 `df -h /System/Volumes/Data`. Docker·Cargo 캐시가 다른 볼륨이라면 그 볼륨도 점검한다. 공용 Docker 캐시를 prune하지 않는다. |

## 주소와 설정

- Axum 기본 `3000`, Compose의 앱/Postgres/embedder 내부 포트는 각각 `3000`, `5432`, `8780`이다. 공유 Caddy 프로필의 앱 포트는 `127.0.0.1:12730`이다. 운영 구성은 [OCI 설정](../oci-setup.md)에 있다.
- 테스트 DB는 호스트 loopback 임의 포트에 매핑한다. Behaviour 단독 실행의 기본은 앱 `3001`, HTTPS OpenAI 스텁 `3444`다. 하네스는 실행별 `TEST_DB_CONTAINER`와 loopback 포트 두 개를 정해 전달한다. 백업 복구 CI 스크립트는 Docker 호스트 네트워크와 `55433`을 사용한다. 고정 이름을 사용하는 기존 Postgres·복구 테스트는 전용 daemon에서 한 번에 한 작업만 실행한다.
- 변수 정의의 원본은 [env-manifest.json](../../scripts/env-manifest.json)이다. DB·런타임에는 `DATABASE_URL`, `TEST_DB_CONTAINER`, `PORT`, `AXUM_URL`, `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_SECRET`, `CRON_SECRET`, `MEMECATCH_SIGNING_SECRET`이 있다. AI 경로에는 `MEME_SEMANTIC_SEARCH_ENABLED`, `MEME_EMBEDDER_URL`, `MEME_EMBEDDING_URL`, `MEME_EMBEDDING_RUNTIME`, `MEME_EMBEDDING_REINDEX_ENABLED`, `MEME_CHAT_GENERATION_ENABLED`, `MEME_CHAT_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_REVIEW_BASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_MPE_MODEL`, `BEDROCK_MEME_STUDIO_ENABLED`, `MCP_EVENT_STATE_KEY`, `MPE_FFMPEG_TIMEOUT_MS`, `MPE_FFPROBE_TIMEOUT_MS`가 있다. 필요한 변수만 테스트 안에서 스텁 값으로 설정한다.

## 실행 경계

- 하네스는 로컬 `origin/main`만 읽고 `fetch`하지 않는다. 코딩 에이전트와 검사 프로세스에는 PATH·홈·도구 캐시 등 필요한 환경 변수만 전달한다. Codex는 로컬 인증 프로필을 사용할 수 있다. 애플리케이션·운영 자격증명은 전달하지 않는다.
- Codex 명령 도구는 `workspace-write`, 승인 `never`, 네트워크 비활성화로 실행한다. Claude는 `--restricted`를 지원하는 CLI에서 비대화형 파일 도구만 사용하고 MCP를 비운다. 사용자 지정 실행 파일과 변경된 테스트 코드는 실제 호스트 권한으로 실행된다. 신뢰할 수 있는 실행 파일과 작업 명세를 사용하고, 전체 실행은 운영 자격증명이 없는 작업 환경에서 수행한다.
- 실제 에이전트는 모델 서비스 연결이 필요하다. 패키지·이미지를 받는 준비 단계 외에 검사 요청은 loopback·fixture를 사용한다. 스텁 테스트는 설치, Docker, 외부 요청 없이 실행한다.
- 작업 디렉터리, 보고서, 로그는 기본 `~/.cache/memecatch-harness/run-*/`에 보존된다. 운영 정보가 없는 로그만 공유한다. 검토가 끝나면 해당 worktree와 브랜치만 Git으로 정리한다.
