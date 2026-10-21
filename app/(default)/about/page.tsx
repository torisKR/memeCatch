import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";

const ABOUT_DESCRIPTION =
  "밈캐치는 한국 밈·유행어의 뜻·유래·사용 맥락을 기록하는 밈 사전입니다. 공개 범위와 편집 완성도의 차이, 출처·저작권 원칙과 운영 방침을 소개합니다.";

export const metadata: Metadata = {
  title: "소개",
  description: ABOUT_DESCRIPTION,
  alternates: { canonical: "/about" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "소개",
    description: ABOUT_DESCRIPTION,
    url: "/about",
  },
};

/** 소개 — 운영 주체·검수 프로세스·콘텐츠 원칙 (E-E-A-T 신뢰 문서) */
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight">밈캐치 소개</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          밈캐치는 한국 밈·유행어·챌린지의 <strong className="text-foreground">뜻·유래·지금 써도
          되는지</strong>를 한 번에 살펴볼 수 있게 정리하는 밈 사전입니다. 오래된
          표현부터 최근 챌린지까지 공개 카탈로그에 기록하되, 공개되어 있다는
          사실이 모든 항목의 유래·용례·권리 검토가 같은 깊이로 끝났다는 뜻은
          아닙니다. 근거가 부족한 부분은 단정하지 않고 보완 상태를 표시합니다.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-bold">왜 만들었나</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈의 뜻을 알려주는 곳은 이미 많습니다. 정작 아쉬웠던 건 뜻을 알고
            난 다음이었습니다. 뜻을 알아도 &ldquo;이걸 회사 단톡방에서 써도
            되나&rdquo;는 여전히 알 수 없었고, 유행이 지난 줄 모르고 썼다가
            분위기가 식는 일도 흔했습니다. 밈은 뜻보다 <strong>쓸 자리</strong>
            에서 사고가 납니다. 밈캐치는 그 지점에 답하려고 만든 사전입니다.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">다른 밈 위키와 무엇이 다른가요</h2>
          <p className="mt-3 text-base leading-relaxed">
            기존 밈 위키는 대체로 &ldquo;이 밈이 무엇인가&rdquo;를 설명하는 데서
            멈춥니다. 밈캐치는 거기에 <strong>지금 써도 되는지에 대한 판단</strong>
            을 근거와 함께 붙입니다.
          </p>
          <ul className="mt-4 space-y-3 text-base leading-relaxed">
            <li>
              <strong>사용 안전 신호</strong> — 사용 맥락과 주의점을 별도로
              안내합니다. 유행이 지났다는 사실과 사용 위험은 별개입니다.
              상황별 근거가 있는 항목은 상세의 &lsquo;사용할 때 참고하세요&rsquo;에서
              설명을 볼 수 있고, 확인되지 않은 상황을 안전하다고 단정하지 않습니다.
              어떤 기준으로 등급을 나누는지는{" "}
              <Link href="/editorial" className="text-accent-text underline underline-offset-2">
                편집 원칙
              </Link>
              에 공개해 두었습니다.
            </li>
            <li>
              <strong>밈의 흐름과 관찰 범위</strong> — 밈캐치 안의 조회·저장 반응,
              최근 등록, 외부 확산을 구분합니다. 외부 확산 근거가 확인된 항목은
              조사 범위와 마지막 확인 시각을 함께 표시합니다. 내부 인기도나
              오래된 누적 조회수만으로 지금 전체 SNS에서 유행한다고 말하지 않습니다.
            </li>
            <li>
              <strong>출처 중심</strong> — 원본 영상·이미지를 무단 저장하지 않고
              공식 임베드나 출처 링크를 우선합니다. 다만 출처 링크가 있다는
              사실만으로 재사용 허락이나 라이선스가 생기는 것은 아닙니다.
              게시자가 영상을 내리거나 주소를 바꾸면 임베드·수집 링크가 일시적으로
              보이지 않을 수 있으며, 확인된 문제는 정정 또는 비노출 처리합니다.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">콘텐츠는 이렇게 검수됩니다</h2>
          <ol className="instrument-grid mt-4 grid gap-3 rounded-2xl border border-border/60 p-4 sm:grid-cols-2 sm:p-5">
            <li className="rounded-xl border border-border bg-surface p-4 text-base leading-relaxed">
              <p aria-hidden className="stat-mono text-sm font-bold text-accent">01</p>
              <p className="mt-1.5">
                <strong>제보 접수</strong> — 누구나{" "}
                <Link href="/submit" rel="nofollow" className="text-accent-text underline underline-offset-2">
                  밈 제보
                </Link>
                로 새 밈을 알려줄 수 있습니다.
              </p>
            </li>
            <li className="rounded-xl border border-border bg-surface p-4 text-base leading-relaxed">
              <p aria-hidden className="stat-mono text-sm font-bold text-accent">02</p>
              <p className="mt-1.5">
                <strong>사실 확인</strong> — 뜻·유래·연도처럼 항목별로 확인 가능한
                범위를 구분합니다. 가능한 경우 서로 독립된 자료를 교차 확인하고,
                한 자료만 있거나 최초 발원지를 특정할 수 없으면 그 한계를 화면에
                남깁니다.
              </p>
            </li>
            <li className="rounded-xl border border-border bg-surface p-4 text-base leading-relaxed">
              <p aria-hidden className="stat-mono text-sm font-bold text-accent">03</p>
              <p className="mt-1.5">
                <strong>권리 확인</strong> — 공식 공개 임베드인지, 단순 참고 링크인지,
                밈캐치가 직접 만든 설명·도안인지 구분합니다. 링크의 존재를 사용
                허락으로 간주하지 않으며 원본 파일을 복제해 보관하지 않습니다.
              </p>
            </li>
            <li className="rounded-xl border border-border bg-surface p-4 text-base leading-relaxed">
              <p aria-hidden className="stat-mono text-sm font-bold text-accent">04</p>
              <p className="mt-1.5">
                <strong>공개 및 갱신</strong> — 공개 카탈로그와 편집 완료 상태를
                같은 뜻으로 다루지 않습니다. 보완이 필요한 항목은 제한 상태나
                확인 안내를 붙이고, 정정 제보와 새 근거를 검토해 내용을 갱신합니다.
              </p>
            </li>
          </ol>
          <p className="mt-4 text-base leading-relaxed">
            어떤 밈을 수록하고 무엇을 수록하지 않는지, 사용 안전 등급을 어떤
            근거로 매기는지, 출처의 권리를 어떻게 확인하는지는{" "}
            <Link href="/editorial" className="text-accent-text underline underline-offset-2">
              편집 원칙
            </Link>
            에 정리해 두었습니다.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            직접 출처를 살펴보려면{" "}
            <Link
              href="/guides/reading-memes"
              className="text-accent-text underline underline-offset-2"
            >
              밈의 원본과 사용 맥락을 확인하는 방법
            </Link>
            을 참고해 주세요. 사전 항목의 링크가 사라졌을 때 무엇을 확인해야
            하는지도 함께 설명합니다.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">누가 만드나요</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈캐치는 온라인 커뮤니티와 인터넷 방송 문화를 오래 지켜본 개인
            개발자(<strong>toris-dev</strong>)가 기획·개발·편집을 모두 맡아
            운영합니다. 편집을 맡는 팀이 따로 있지 않고, 수록 여부와 사용 안전
            등급 판정도 같은 사람이 직접 확인합니다. 회사가 아니라 1인이 만드는
            사전이라는 점을 먼저 밝히는 것이 맞다고 생각합니다. 코드는{" "}
            <a
              href="https://github.com/toris-dev/memeCatch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text underline underline-offset-2"
            >
              GitHub
            </a>
            에 공개되어 있습니다.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            운영비는 광고와 제휴 링크, 후원, 그리고 선택형 멤버십으로
            충당합니다. 광고주는 밈의 수록 여부나 안전 등급에 관여하지
            않습니다. 서비스가 도움이 됐다면{" "}
            <Link
              href="/pricing#fairy-support-title"
              className="text-accent-text underline underline-offset-2"
            >
              후원(Fairy)
            </Link>
            으로 응원할 수 있습니다.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold">문의·정정·삭제 요청</h2>
          <p className="mt-3 text-base leading-relaxed">
            틀린 내용이나 저작권 문제를 발견하셨다면 알려 주세요. 확인 후
            정정하거나 내립니다.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed">
            <li>
              <strong>이메일</strong>{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-accent-text underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              — 문의·제휴·저작권 삭제 요청. 로그인 없이 보낼 수 있습니다.
            </li>
            <li>
              <strong>
                <Link href="/support" className="text-accent-text underline underline-offset-2">
                  고객센터
                </Link>
              </strong>{" "}
              — 로그인 후 1:1 문의. 답변이 같은 화면에 기록돼 진행 상황을
              확인할 수 있습니다.
            </li>
            <li>
              <strong>
                <Link href="/submit" rel="nofollow" className="text-accent-text underline underline-offset-2">
                  밈 제보
                </Link>
              </strong>{" "}
              — 아직 없는 밈이나 빠진 정보 알려주기.
            </li>
          </ul>
          <p className="mt-4 text-base leading-relaxed">
            요청별 처리 방식은{" "}
            <Link href="/editorial" className="text-accent-text underline underline-offset-2">
              편집 원칙
            </Link>
            의 정정·삭제 항목에 정리해 두었습니다.
          </p>
        </section>
      </div>
    </main>
  );
}
