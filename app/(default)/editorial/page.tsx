import type { Metadata } from "next";
import Link from "next/link";
import { SafetyBadge } from "@/components/safety-badge";
import { SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";
import { RIGHTS_BASIS_LABELS, SOURCE_ROLE_LABELS } from "@/lib/sources/review";
import { CONTACT_EMAIL } from "@/lib/site";

const EDITORIAL_DESCRIPTION =
  "밈캐치가 밈을 수록하는 기준, 사용 안전 신호를 매기는 근거, 사실확인·저작권 검수 절차와 오류 정정 요청 방법을 공개합니다.";

export const metadata: Metadata = {
  title: "편집 원칙",
  description: EDITORIAL_DESCRIPTION,
  alternates: { canonical: "/editorial" },
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "편집 원칙",
    description: EDITORIAL_DESCRIPTION,
    url: "/editorial",
  },
};

const EFFECTIVE = "2026년 7월 26일";

/**
 * 편집 원칙 — 수록·판정·검수 기준 공개 문서(E-E-A-T).
 * 서술은 실제 구현과 1:1로 대응해야 한다. 등급명·출처 역할·권리 근거는
 * lib/labels.ts, lib/sources/review.ts의 단일 소스를 그대로 렌더한다.
 */

/** 등급별 판정 근거 — components/safety-rationale.tsx의 LEVEL_MEANING과 같은 기준 */
const SAFETY_CRITERIA: Record<SafetyLevel, string> = {
  green:
    "커뮤니티 사용례에서 부정적 맥락 없이 널리 쓰이는 것이 확인된 경우입니다. 특정 집단을 겨냥한 용법이 관찰되지 않아야 합니다.",
  yellow:
    "맥락에 따라 오해나 불쾌감을 줄 수 있는 경우입니다. 뜻 자체는 중립이어도 상대·자리에 따라 결과가 달라지면 여기에 둡니다.",
  gray:
    "뜻이나 안전성의 문제가 아니라 유행이 지나 지금 쓰면 어색하게 들리는 경우입니다. 조회 추이로 판단합니다.",
  red: "비하·혐오 등 부정적 맥락과 결합해 쓰이는 것이 확인된 경우입니다. 기록은 남기되 추천 노출에서 제외합니다.",
};

const REVIEW_STEPS = [
  {
    title: "접수 (pending)",
    body: "제보 또는 자동 수집으로 후보가 등록됩니다. 이 단계의 항목은 공개되지 않습니다.",
  },
  {
    title: "사실 확인 (fact_checking)",
    body: "뜻·유래·최초 확인 시점을 서로 독립된 복수 출처로 교차 확인합니다. 한 곳에서만 확인되는 유래는 단정하지 않습니다.",
  },
  {
    title: "저작권 확인 (rights_checking)",
    body: "출처마다 권리 근거를 지정합니다. 근거가 확인되지 않으면 공개 임베드로 올리지 않습니다.",
  },
  {
    title: "공개 (approved) 또는 제한 공개 (limited)",
    body: "두 확인을 모두 통과하면 공개합니다. 뜻은 확인됐지만 원본·연도가 더 필요한 항목은 제한 공개로 두고 화면에 “출처 확인 중”을 함께 표시합니다.",
  },
] as const;

export default function EditorialPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <div className="max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
          Editorial
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">편집 원칙</h1>
        <p className="mt-2 text-sm text-muted">최종 개정: {EFFECTIVE}</p>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          밈캐치는 &ldquo;이 밈, 지금 써도 되나&rdquo;에 답하는 사전입니다. 그
          답이 신뢰를 얻으려면 무엇을 근거로 판단했는지가 함께 보여야 한다고
          생각합니다. 이 문서는 밈을 수록하는 기준, 사용 안전 신호를 매기는
          근거, 검수 절차, 그리고 저희가 틀렸을 때 고치는 방법을 정리한
          것입니다.
        </p>

        <section className="mt-12">
          <h2 className="text-xl font-bold">1. 무엇을 수록하나</h2>
          <p className="mt-3 text-base leading-relaxed">
            한국어권에서 실제로 통용된 밈·유행어·챌린지를 수록합니다. 유행
            여부와 무관하게, 다음 세 가지를 모두 쓸 수 있어야 항목이
            만들어집니다.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed">
            <li>
              <strong>한 문장으로 끝나는 정의</strong> — 다른 밈을 몰라도
              그 문장만 읽고 뜻이 통해야 합니다. 설명에 또 다른 밈 이름이
              필요하면 그 밈부터 먼저 수록합니다.
            </li>
            <li>
              <strong>특정 가능한 출처</strong> — 어디서 시작됐는지 가리킬 수
              있어야 합니다. 발원지를 특정할 수 없으면 뜻과 맥락만 남기고
              유래는 비워 둡니다.
            </li>
            <li>
              <strong>판정 가능한 사용 안전도</strong> — 실제 쓰임을 관찰할 수
              있어야 합니다. 용례가 너무 적어 판단이 서지 않으면 공개를
              보류합니다.
            </li>
          </ul>
          <p className="mt-4 text-base leading-relaxed">
            수록하지 않는 것도 분명히 해 둡니다. 특정 개인을 조롱하려고 만들어져
            공적 논의 가치가 없는 표현, 한 커뮤니티 안에서만 통하고 밖으로
            퍼진 적 없는 내부 은어, 확인되지 않은 신상·사건 주장을 전제로 하는
            밈은 수록하지 않습니다. 혐오·비하 소지가 있더라도 이미 널리 퍼져
            &ldquo;뜻을 몰라서 잘못 쓰는&rdquo; 위험이 실재하는 표현은 기록하되,
            뒤에 설명하는 &lsquo;쓰면 위험&rsquo; 신호를 달고 추천에서
            제외합니다. 설명하지 않는 것이 더 위험하다고 보기 때문입니다.
          </p>

          <h3 className="mt-6 font-bold">밈이 아닌 것: 사건 기록</h3>
          <p className="mt-2 text-base leading-relaxed">
            <strong>밈이란 모방·변형되며 퍼지는 표현 양식</strong>입니다. 아무리
            널리 알려지고 화제가 됐더라도, 사건·인물·작품·게임 용어 그
            자체는 밈이 아니라 <strong>&lsquo;사건 기록&rsquo;</strong>으로
            따로 분류합니다. 자체 검토에서 이런 경우가 세 갈래로 나뉘는 것을
            확인했습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed">
            <li>
              <strong>사건·인물 기록</strong> — 오디션 우승, 소비자 사건처럼
              &ldquo;무슨 일이 있었나&rdquo;를 담은 항목
            </li>
            <li>
              <strong>게임 고유명사</strong> — 특정 게임 안에서만 통하는 보스명·
              서버명 같은 용어
            </li>
            <li>
              <strong>곡·실존 인물</strong> — 발매곡 자체이거나 실존 인물을
              가리키는 이름
            </li>
          </ul>
          <p className="mt-3 text-base leading-relaxed">
            이런 항목은 수록을 취소하지 않습니다. 검색 유입과 URL은 그대로
            유지하되, 화면에{" "}
            <span className="inline-flex items-center gap-1 rounded-full bg-safety-gray-bg px-2 py-0.5 text-sm font-semibold text-safety-gray">
              밈이 아니라 인터넷 문화 사건 기록이에요
            </span>{" "}
            배지를 달아 밈 사전이 아니라는 사실을 먼저 밝힙니다.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">2. 사용 안전 신호는 이렇게 매깁니다</h2>
          <p className="mt-3 text-base leading-relaxed">
            사용 안전 신호는 밈의 재미나 품질에 대한 평가가 아닙니다.
            <strong> 지금 이 표현을 썼을 때 상대가 어떻게 받아들일지</strong>에
            대한 예측이며, 근거는 실제 커뮤니티 용례입니다. 등급은 네 단계이고
            판정 기준은 다음과 같습니다.
          </p>
          <dl className="mt-4 space-y-4">
            {(Object.keys(SAFETY_LEVELS) as SafetyLevel[]).map((level) => (
              <div
                key={level}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <dt>
                  <SafetyBadge level={level} />
                </dt>
                <dd className="mt-1.5 text-base leading-relaxed text-muted">
                  {SAFETY_CRITERIA[level]}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-base leading-relaxed">
            등급은 고정값이 아닙니다. 같은 말도 쓰는 사람과 자리가 바뀌면 결과가
            달라지기 때문에, 밈 상세의 <strong>&lsquo;이 판정의 근거&rsquo;</strong>
            에서 직장·친구·가족·SNS 상황별로 가능·주의를 따로 표시합니다. 등급을
            바꿀 만한 새 용례가 관찰되면 공개 후에도 조정하며, 판단이 갈리는
            항목에는 &lsquo;논쟁 중&rsquo; 표시를 함께 답니다.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            유행 상태(급상승·유행 중·식는 중·추억 밈)를 나타내는 밈 생명
            게이지는 안전 신호와 별개이며, 사이트 안의 조회 추이로 계산합니다.
            외부 검색량이나 언론 노출을 반영하지 않으므로 &ldquo;밈캐치
            이용자 기준&rdquo;으로 읽어 주세요.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">3. 검수 절차</h2>
          <p className="mt-3 text-base leading-relaxed">
            모든 항목은 아래 단계를 순서대로 거칩니다. 단계는 내부 관리
            상태로 기록되며, 앞 단계를 건너뛰고 공개되지 않습니다.
          </p>
          <ol className="mt-4 space-y-3">
            {REVIEW_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <p className="font-bold">
                  <span className="text-muted">{i + 1}.</span> {step.title}
                </p>
                <p className="mt-1.5 text-base leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-base leading-relaxed">
            확인에 실패한 항목은 반려하고 공개하지 않습니다.{" "}
            <Link href="/submit" rel="nofollow" className="text-accent-text underline underline-offset-2">
              제보
            </Link>
            해 주신 밈은 보통 24~48시간 안에 등록 여부를 회신하며, 유래 확인에
            추가 자료가 필요하면 사흘까지 걸릴 수 있습니다. 제보자가 보낸 설명을
            그대로 옮기지 않고, 저희가 다시 확인한 내용만 본문에 씁니다.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">4. 출처와 저작권</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈캐치는 <strong>제3자 원본 영상·이미지 파일을 저장하지 않습니다.</strong>{" "}
            원저작자가 올린 자리로 링크하거나, 플랫폼이 공식 제공하는 임베드로만
            보여 줍니다. 출처는 항목별로 원장에 기록하고, 저마다 어떤 역할인지와
            어떤 권리 근거로 노출하는지를 함께 남깁니다.
          </p>

          <h3 className="mt-6 font-bold">출처의 역할 구분</h3>
          <p className="mt-2 text-base leading-relaxed">
            링크 하나하나가 같은 무게를 갖지 않습니다. 원본과 나중에 퍼진
            영상을 섞지 않기 위해 역할을 나눠 기록합니다.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed">
            {Object.values(SOURCE_ROLE_LABELS).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>

          <h3 className="mt-6 font-bold">노출 권리 근거</h3>
          <p className="mt-2 text-base leading-relaxed">
            공식 임베드·창작자 허가·크리에이티브 커먼즈·공공 데이터 중 하나가
            확인된 출처만 화면에 임베드합니다. 권리를 확인하지 못한 출처는
            링크만 걸거나 아예 노출하지 않습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed">
            {Object.values(RIGHTS_BASIS_LABELS).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>

          <h3 className="mt-6 font-bold">자동 수집은 공개 승인이 아닙니다</h3>
          <p className="mt-2 text-base leading-relaxed">
            YouTube·TikTok·Instagram의 공개 API와 oEmbed로 출처 후보를 모으는
            자동 수집을 운영하지만, 수집 결과는 검수 대기열에만 들어갑니다.
            자동 점수가 아무리 높아도 그것만으로 공개되지 않으며, 사람이 확인한
            항목만 공개됩니다. 제보자가 자기 TikTok 계정의 공개 영상을 직접
            가져오는 경우도 마찬가지로 검수 대기 상태로만 추가됩니다.
          </p>

          <h3 className="mt-6 font-bold">공개 후 재확인</h3>
          <p className="mt-2 text-base leading-relaxed">
            공개된 출처도 그대로 두지 않습니다. 주기적으로 생존 여부와 임베드
            허용 상태를 다시 확인해, 원저작자가 삭제했거나 비공개로 돌린 영상,
            임베드를 막은 영상은 공개 화면에서 자동으로 내립니다. 원저작자의
            결정이 저희 페이지보다 우선한다는 뜻입니다.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">5. 연도와 유래를 표기하는 방식</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈은 &ldquo;처음&rdquo;을 특정하기 어려운 경우가 많습니다. 그래서
            연도는 확인된 정밀도만큼만 적습니다. 날짜까지 확인되면 정확한
            날짜로, 해까지만 확인되면 연도로, 그마저 애매하면 &ldquo;대략&rdquo;
            이나 연대(예: 2010년대)로 표기합니다. 확인되지 않은 유래는
            &ldquo;~로 알려짐&rdquo;처럼 전언임을 드러내 적고 단정하지 않습니다.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            시대 구분(PC통신·초기 웹·소셜미디어·숏폼)은 그 밈이 어떤 환경에서
            퍼졌는지를 보여주기 위한 분류이며, 연도를 기준으로 일관되게
            적용합니다. 특정 연도의 밈을 임의로 다른 시대에 넣지 않습니다.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">6. 광고·제휴와 편집의 분리</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈캐치는 광고와 제휴 링크, 후원으로 운영됩니다. 다만 광고주는 밈의
            수록 여부나 사용 안전 등급에 관여하지 않으며, 대가를 받고 특정 밈을
            올리거나 등급을 조정하지 않습니다. 제휴 링크가 있는 자리에는 광고
            표기를 함께 노출하고, 링크를 통한 구매로 수수료를 받을 수 있다는
            사실을 밝힙니다. 상품 가격과 재고는 판매처 기준이며 저희가 보장하지
            않습니다.
          </p>
        </section>

        {/* id는 Organization JSON-LD의 correctionsPolicy가 가리키는 앵커 */}
        <section id="corrections" className="mt-12 scroll-mt-20">
          <h2 className="text-xl font-bold">7. 정정과 삭제 요청</h2>
          <p className="mt-3 text-base leading-relaxed">
            틀린 내용을 발견하셨다면 알려 주세요. 사전은 고쳐지면서 정확해지는
            물건이라고 생각합니다. 다음 두 가지 경로를 씁니다.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed">
            <li>
              <Link href="/support" className="text-accent-text underline underline-offset-2">
                고객센터
              </Link>{" "}
              — 로그인 후 1:1 문의를 보내면 답변이 같은 화면에 기록됩니다.
              진행 상황을 직접 확인할 수 있어 정정 요청에 권장합니다.
            </li>
            <li>
              이메일{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-accent-text underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              — 로그인 없이 보낼 수 있습니다. 저작권자 본인의 삭제 요청도 이
              주소로 받습니다.
            </li>
          </ul>
          <p className="mt-4 text-base leading-relaxed">
            요청을 받으면 이렇게 처리합니다. <strong>사실 오류</strong>는 원래
            근거를 다시 확인해 정정하거나, 확인이 안 되면 해당 서술을 내립니다.
            <strong> 저작권자의 삭제 요청</strong>은 권리 확인 절차를 거칠 필요
            없이 먼저 해당 임베드·링크를 내린 뒤 확인합니다. 원저작자의 뜻이
            우선입니다. <strong>사용 안전 등급에 대한 이의</strong>는 근거로 든
            용례를 다시 살펴보고, 등급을 조정하거나 왜 유지하는지 답변합니다.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">8. 이 원칙의 한계</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈캐치는 1인이 운영하는 사전입니다. 학술 기관이나 언론사의 검증
            체계를 갖추고 있지 않고, 모든 항목을 같은 깊이로 확인하지도
            못합니다. 사용 안전 신호는 관찰된 용례에 기반한 판단이지 어떤
            공인된 기준도 아닙니다. 중요한 자리에서 쓸 표현이라면 이 사전을
            참고 자료 중 하나로만 삼아 주세요. 그 한계를 감추지 않는 것이 이
            문서를 공개하는 이유입니다.
          </p>
          <p className="mt-4 text-base leading-relaxed">
            운영 주체와 연락처는{" "}
            <Link href="/about" className="text-accent-text underline underline-offset-2">
              밈캐치 소개
            </Link>
            에, 개인정보 처리와 서비스 약관은{" "}
            <Link href="/privacy" className="text-accent-text underline underline-offset-2">
              개인정보처리방침
            </Link>
            ·
            <Link href="/terms" className="text-accent-text underline underline-offset-2">
              이용약관
            </Link>
            에 있습니다.
          </p>
        </section>
      </div>
    </main>
  );
}
