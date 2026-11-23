<!-- inventory.mjs가 만든 파일. 손으로 고치지 않는다. -->
# 인증 (better-auth)

## 파일

| 파일 | 줄 |
| --- | --- |
| `app/api/auth/[...all]/route.ts` | 15 |
| `app/auth/callback/route.ts` | 27 |
| `app/auth/tiktok/callback/route.ts` | 66 |
| `app/auth/tiktok/route.ts` | 44 |
| `components/auth-invite.tsx` | 113 |
| `components/auth-menu.tsx` | 220 |
| `lib/auth/internal.ts` | 13 |
| `lib/auth/magic-link.ts` | 76 |
| `lib/auth/passwords.ts` | 15 |
| `lib/auth/reserved-email.ts` | 16 |
| `lib/auth/server.ts` | 193 |
| `lib/auth/session-error.ts` | 9 |
| `lib/auth/signing-secret.ts` | 6 |
| `lib/auth/sync-user.ts` | 40 |
| `lib/db/client.ts` | 70 |

## 쓰는 기능 (`lib/auth/server.ts`)

| 기능 | 상태 |
| --- | --- |
| 이메일·비밀번호 (`emailAndPassword`) | 사용 |
| 가입 뒤 자동 로그인 끔 (`autoSignIn: false`) | 사용 |
| 이메일 인증 필수 (`requireEmailVerification`) | 사용 |
| 비밀번호 최소 길이 | 12 |
| 비밀번호 검증 함수 교체 (`password.verify`) | 사용 |
| 비밀번호 재설정 메일 (`sendResetPassword`) | 사용 |
| 가입 시 인증 메일 (`sendOnSignUp`) | 사용 |
| 메일 발송 웹훅 (`AUTH_EMAIL_WEBHOOK`) | 사용 |
| Google (`socialProviders.google`) | 사용 |
| Kakao (`genericOAuth`, providerId `kakao`) | 사용 |
| TikTok (자체 경로 `app/auth/tiktok` + 매직 링크) | 사용 |
| `nextCookies` 플러그인 | 사용 |
| UUID id (`advanced.database.generateId`) | 사용 |
| 운영에서 Secure 쿠키 (`useSecureCookies`) | 사용 |
| 가입 전후 훅 (`databaseHooks.user.create`) | 사용 |
| 스키마를 실행 중에 만든다 (`getMigrations`) | 사용 |

## 호출하는 엔드포인트와 서버 API

| 종류 | 이름 |
| --- | --- |
| 브라우저가 부르는 `/api/auth/*` | `/api/auth/get-session`, `/api/auth/sign-in/social` |
| 서버가 부르는 `auth.api.*` | `getSession`, `requestPasswordReset`, `resetPassword`, `signInEmail`, `signOut`, `signUpEmail` |
| 쿠키 이름이 나오는 곳 | better-auth 기본값만 사용 |
| 비밀번호 해시 형식 (`lib/auth/passwords.ts`) | `$2a$` bcrypt, `$2b$` bcrypt, `$2y$` bcrypt, 그 밖: better-auth scrypt (`salt:hash` 16진) |

## 테이블 (better-auth가 실행 중에 만든다)

| 테이블 | 열 |
| --- | --- |
| `account` | id uuid, accountId text, providerId text, userId uuid, accessToken text, refreshToken text, idToken text, accessTokenExpiresAt timestamp with time zone, refreshTokenExpiresAt timestamp with time zone, scope text, password text, createdAt timestamp with time zone, updatedAt timestamp with time zone |
| `session` | id uuid, expiresAt timestamp with time zone, token text, createdAt timestamp with time zone, updatedAt timestamp with time zone, ipAddress text, userAgent text, userId uuid |
| `user` | id uuid, name text, email text, emailVerified boolean, image text, createdAt timestamp with time zone, updatedAt timestamp with time zone |
| `verification` | id uuid, identifier text, value text, expiresAt timestamp with time zone, createdAt timestamp with time zone, updatedAt timestamp with time zone |
