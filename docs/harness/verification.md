# MemeCatch 하네스 검증 기준

[CI](../../.github/workflows/ci.yml)의 `check`, `server`, `behaviour`와 같은 명령을 아래 경로에 적용한다. CI에서는 모든 job을 실행한다. 하네스의 자동 선택과 검사 순서는 [gates.mjs](../../scripts/harness/gates.mjs), Rust·Docker 명령은 [ci.sh](../../scripts/harness/ci.sh)가 정의한다.

| Gate | 변경 경로 | 통과 조건 |
| --- | --- | --- |
| `diff` | 모든 작업 | 기준 SHA 대비 `git diff --check`가 종료 코드 0 |
| `install` / `ts` | JS/TS와 패키지 설정, `scripts/`, `lib/`, `integrations/`, `server/ui/` | 동결 설치 후 `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`(Vitest), CI의 Node 테스트 4개 |
| `node` / `harness` | 변경된 `*.test.mjs` / `scripts/harness/` | 각각 해당 Node 테스트 / 매핑·요약 단위 테스트와 오프라인 red → green 실행 |
| `env` | 서버·스크립트·공유 코드·배포·워크플로 설정 | `node scripts/check-env-manifest.mjs`가 사용 변수의 선언을 확인 |
| `ui` | `server/ui/`, `server/assets/`, 정적 파일, 공유 코드·패키지 설정 | `node server/scripts/build-ui.mjs --check`가 포함된 번들·스타일의 최신 여부를 확인 |
| `rust` | Rust 소스·테스트·Cargo 설정·서버 리소스·DB 초기화/마이그레이션 | `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, 임시 DB의 `cargo test` |
| `behaviour` | 서버, 공개 파일, 공유 코드·패키지, MCP UI·DB | 릴리스 빌드를 만든 뒤 `server/behaviour/run.sh`가 실제 Axum, 표준 시드, OpenAI 스텁, 모바일·데스크톱 Chromium 시나리오를 통과 |
| `deploy` | 배포·Compose·Dockerfile·워크플로 설정 | `bash scripts/deploy-oci.test.sh`, `bash deploy/autodeploy/autodeploy.test.sh`가 스텁을 사용해 통과 |
| `server-image` / `worker-image` | 각각 서버·공개 리소스와 서버 Dockerfile / 워커·공유 코드와 워커 Dockerfile | 서버 이미지 빌드·릴리스 환경 확인 / 워커 이미지 빌드·import smoke |
| `postgres` / `backup-image` | 마이그레이션·Postgres 초기화 및 테스트 / 백업 이미지·스크립트 | 각각 CI의 Postgres 테스트 5개 / 이미지 빌드 및 임시 DB 복구 테스트 |

`ci.yml` 변경은 전체 검사를 선택한다. 여러 경로가 바뀌면 적용 게이트를 합친다. `ts`, `ui`, `behaviour`는 동결 설치를 먼저 실행한다. 실패하면 의존 게이트는 건너뛰고 나머지 검사를 실행한다. 문서만 바뀌면 공통 diff 검사를 실행한다.

마이그레이션은 명시적으로 승인된 작업에서만 새로 추가한다. 새 SQL 파일의 머리말에 롤백 SQL을 주석으로 포함하고, 이력을 덮어쓰지 않는다. 검토자는 순서·권한·데이터 보존을 점검하고 임시 DB에서 초기화와 기존 데이터 경로를 검증한다. 운영 마이그레이션 승인은 [OCI 절차](../oci-setup.md#continuous-deploy-github-actions-through-cloudflare-tunnel)를 따른다.

## 실행과 결과

```bash
node scripts/harness/run.mjs --task /path/to/spec.md --agent codex
node scripts/harness/run.mjs --task /path/to/spec.md --agent claude \
  --max-iterations 4 --worktree-dir /path/outside/repository
node --test scripts/harness/*.test.mjs
```

커스텀 에이전트는 실행 파일 경로를 `--agent`에 전달하고 필요하면 `--agent-arg=<값>`을 반복한다. 작업 명세, 규칙, 직전 실패 요약은 stdin에서 읽는다. `--gates node,deploy`처럼 명시하면 해당 목록으로 검사를 제한하고 자동 선택 대비 생략된 게이트를 보고한다. `green`은 그 실행의 범위에서 변경이 있고, 에이전트와 모든 실행 게이트가 성공했다는 뜻이다. 실제 적용 가능한 명시 검사 없이 종료한 경우나 실패한 사전 검사가 있으면 통과 처리하지 않는다. 자동 선택 결과도 CI job 성공을 대신할 수 없다.

기본 4회 생성·수정 예산을 사용한다. 각 에이전트 호출은 최대 15분, 게이트 명령은 최대 60분이다. 실패한 테스트 이름, 오류, 파일 위치를 로그 앞·뒤 구간에서 추려 다음 호출에 전달한다. 성공은 종료 코드 0, 예산 소진·`BLOCKED`·실행 오류는 1, 실행 전 인자·환경 오류는 2다. 검사가 불안정하면 최초 실패와 같은 조건의 재현 결과를 남긴다. 후속 성공으로 실패 이력을 지우거나 게이트를 꺼서 통과시키지 않는다.

보고에는 기준 SHA, 작업 브랜치, 변경 파일, 매 반복의 명령·종료 코드·소요 시간, 실패 요약, 로그 경로, 생략 사유와 최종 판정을 남긴다. `report.json`과 `report.md`는 실행 디렉터리에 있고, 각 명령의 원본 출력도 그곳에서 확인할 수 있다. 완료 판정에는 작업 명세의 수용 조건과 실제 diff 검토가 필요하다.
