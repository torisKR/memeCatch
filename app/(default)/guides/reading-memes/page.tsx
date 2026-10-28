import type { Metadata } from "next";
import Link from "next/link";
import { memePathFrom } from "@/lib/labels";
import { absoluteSiteUrl } from "@/lib/i18n-routing";
import { SITE_URL } from "@/lib/site";

const GUIDE_TITLE = "밈의 원본과 사용 맥락을 확인하는 방법";
const GUIDE_PATH = "/guides/reading-memes";
// First production alias publication, verified against the release manifest and Vercel event.
const GUIDE_PUBLISHED = "2026-10-12T18:34:36+09:00";
const GUIDE_DESCRIPTION =
  "밈의 원본·재게시물·해설·자체 제작물을 구분하고, 실제 대화에서 상대·장소·반어·권리까지 확인하는 실용적인 읽기 가이드입니다.";

const SAEBBING_PATH = memePathFrom("89b37mrx", "새삥 챌린지 (지코)");
const VIDEO_SOURCE = "https://www.youtube.com/watch?v=JnQu_5O4lh4";
const CONTEXT_SOURCE = "https://cjnews.cj.net/?p=32515";

export const metadata: Metadata = {
  title: GUIDE_TITLE,
  description: GUIDE_DESCRIPTION,
  alternates: { canonical: GUIDE_PATH },
  openGraph: {
    type: "article",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: GUIDE_TITLE,
    description: GUIDE_DESCRIPTION,
    url: GUIDE_PATH,
  },
};

const SOURCE_TYPES = [
  {
    title: "원본 또는 최초 확인 자료",
    body: "창작자·방송사·공식 채널이 직접 공개한 영상이나 글입니다. 이것도 인터넷 전체에서 절대적인 ‘최초’임을 보장하지는 않으므로, 밈캐치는 확인한 범위와 게시 주체를 함께 봅니다.",
  },
  {
    title: "재게시물과 2차 사용",
    body: "원본을 다시 올리거나 편집·패러디한 게시물입니다. 밈이 어떻게 퍼지고 변했는지는 보여주지만, 최초 유래나 원저작자 확인 자료로 곧바로 바꾸어 쓰면 안 됩니다.",
  },
  {
    title: "설명 자료",
    body: "방송사 뉴스룸, 인터뷰, 보도자료처럼 배경을 설명하는 자료입니다. 사건의 맥락과 참여 주체를 확인하는 데 유용하지만, 영상 장면이나 표현의 모든 세부를 증명하지는 않습니다.",
  },
  {
    title: "밈캐치 자체 제작",
    body: "밈캐치 편집자가 직접 쓴 정의·사용 예시와 새로 그린 카드 도안입니다. 외부 원본을 복제한 자료가 아니며, 외부 밈을 밈캐치가 창작했다는 뜻도 아닙니다.",
  },
] as const;

const EXAMPLES = [
  {
    title: "예시 1 — 친구 단톡방에서 앞 대화를 이어 받을 때",
    body: "친한 친구가 새 운동화를 자랑한 직후, 모두가 공유한 챌린지 기억을 전제로 ‘완전 새삥인데?’라고 답하는 상황을 가정해 봅니다. 상대와 대화의 앞뒤가 분명하고 조롱이 아니라 축하라는 점이 보여 비교적 오해가 적습니다. 같은 문장도 처음 만난 사람에게 맥락 없이 보내면 곡·챌린지를 모르는 상대에게는 뜻이 전달되지 않을 수 있습니다.",
  },
  {
    title: "예시 2 — 회사 공개 채널에서 반어로 평가할 때",
    body: "동료가 낸 초안을 두고 ‘진짜 새삥이다’라고 쓰면서 실제로는 미완성이라는 반어를 숨긴 상황을 가정해 봅니다. 친구끼리 통하던 비꼼도 회사처럼 기록이 남고 청중이 넓은 장소에서는 인신 평가로 읽힐 수 있습니다. 밈을 빼고도 같은 피드백을 명확하게 말할 수 있는지 먼저 확인하는 편이 낫습니다.",
  },
  {
    title: "예시 3 — 브랜드 게시물에 챌린지 영상을 넣을 때",
    body: "브랜드 계정이 유행을 설명하려고 타인의 댄스 영상을 내려받아 광고에 다시 올리는 상황을 가정해 봅니다. 링크로 맥락을 소개하는 것과 영상 파일·음원·안무 장면을 상업 콘텐츠에 복제하는 것은 다른 문제입니다. 공식 페이지에 공개되어 있거나 임베드가 된다는 사실만으로 광고 재사용 권리가 생기지 않으므로, 권리자와 플랫폼 조건을 별도로 확인해야 합니다.",
  },
] as const;

export default function ReadingMemesGuidePage() {
  const url = absoluteSiteUrl(GUIDE_PATH);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: GUIDE_TITLE,
        description: GUIDE_DESCRIPTION,
        url,
        mainEntityOfPage: { "@id": url },
        inLanguage: "ko",
        datePublished: GUIDE_PUBLISHED,
        author: {
          "@type": "Organization",
          "@id": `${SITE_URL}#org`,
          name: "밈캐치",
          url: SITE_URL,
        },
        publisher: { "@id": `${SITE_URL}#org` },
        citation: [VIDEO_SOURCE, CONTEXT_SOURCE, absoluteSiteUrl(SAEBBING_PATH)],
      },
      {
        "@type": "WebPage",
        "@id": url,
        name: GUIDE_TITLE,
        description: GUIDE_DESCRIPTION,
        url,
        inLanguage: "ko",
        mainEntity: { "@id": `${url}#article` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "밈캐치", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: GUIDE_TITLE, item: url },
        ],
      },
    ],
  };
  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="이동 경로" className="mb-6 flex flex-wrap gap-x-2 text-sm text-muted">
        <Link href="/" className="underline-offset-4 hover:underline">밈캐치</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{GUIDE_TITLE}</span>
      </nav>
      <article className="max-w-3xl">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
          Meme literacy guide
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {GUIDE_TITLE}
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <p>글: <Link href="/about" className="underline underline-offset-4">밈캐치</Link> 편집</p>
          <p>
            최초 공개: <time dateTime={GUIDE_PUBLISHED}>2026년 10월 12일 18:34 (한국 시간)</time>
          </p>
        </div>
        <p className="mt-6 text-lg leading-relaxed text-muted">
          밈의 뜻만 맞혀도 대화는 어긋날 수 있습니다. 같은 표현이 친구 사이에서는
          장난이고, 공개 업무 채널에서는 조롱이 되기도 합니다. 출처를 찾는 일도
          &ldquo;검색 결과 맨 위 링크를 원본이라고 부르는 것&rdquo;보다 복잡합니다.
          이 글은 밈을 직접 확인할 때 무엇을 나누어 봐야 하는지 정리합니다.
        </p>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">1. 링크 네 종류를 먼저 구분하기</h2>
          <p className="mt-3 text-base leading-relaxed">
            한 항목에 여러 링크가 붙어 있어도 모두 같은 역할을 하지 않습니다.
            누가 게시했는지, 무엇을 확인할 수 있는지, 원본을 다시 사용할 권리까지
            주는지를 각각 따로 봐야 합니다.
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {SOURCE_TYPES.map((source) => (
              <div key={source.title} className="rounded-2xl border border-border bg-surface p-5">
                <dt className="font-bold">{source.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{source.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">2. ‘최초’보다 확인 범위를 기록하기</h2>
          <p className="mt-3 text-base leading-relaxed">
            삭제된 게시물, 비공개 커뮤니티, 다른 플랫폼의 선행 게시물 때문에 인터넷
            밈의 절대적인 시작점을 확정하기 어려운 경우가 많습니다. 이때는
            &ldquo;현재 확인한 공식 게시물&rdquo;, &ldquo;이 자료가 설명하는 범위&rdquo;,
            &ldquo;아직 모르는 부분&rdquo;을 나눠 적는 편이 정확합니다.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-relaxed">
            <li>게시 계정이 창작자·방송사·공식 채널인지 확인합니다.</li>
            <li>게시일과 제목을 보고 밈의 어느 단계에 해당하는지 기록합니다.</li>
            <li>기사나 해설은 원본을 직접 가리키는지, 배경만 설명하는지 구분합니다.</li>
            <li>삭제·비공개 링크는 사실을 추측해 채우지 않고 확인 불가로 남깁니다.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">3. 실제 사례: 새삥 챌린지 바로잡기</h2>
          <p className="mt-3 text-base leading-relaxed">
            밈캐치는 새삥 카드를 다른 곡·챌린지처럼 읽히던 설명에서 바로잡았습니다.
            2026년 10월 12일 다시 확인한 The CHOOM 공식 영상의 제목은 Mnet
            &lsquo;스트릿 맨 파이터&rsquo; 리더 계급 댄스 비디오이며, 안무 크레딧을
            위댐보이즈 바타로 표시합니다. CJ 뉴스룸의 2022년 9월 30일 설명도
            &lsquo;새삥&rsquo;을 리더 계급 미션에서 선보인 곡으로 소개하고, 공식 댄스
            비디오와 여러 참여자의 챌린지 확산을 함께 설명합니다.
          </p>
          <p className="mt-3 text-base leading-relaxed">
            두 자료로 확인할 수 있는 것은 <strong>미션곡과 공식 댄스 비디오를
            따라 한 챌린지라는 맥락</strong>입니다. 특정 팔 동작 하나가 밈의 전부라거나,
            이 영상이 인터넷 전체의 최초 게시물이라는 결론까지 내릴 수는 없습니다.
          </p>
          <ul className="mt-5 space-y-2 text-sm leading-relaxed">
            <li>
              <a
                href={VIDEO_SOURCE}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline underline-offset-2"
              >
                The CHOOM 공식 리더 계급 댄스 비디오
              </a>
            </li>
            <li>
              <a
                href={CONTEXT_SOURCE}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline underline-offset-2"
              >
                CJ 뉴스룸의 스트릿 맨 파이터 음원 설명
              </a>
            </li>
            <li>
              <Link href={SAEBBING_PATH} className="text-accent-text underline underline-offset-2">
                밈캐치의 교정된 새삥 챌린지 항목
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">4. 보내기 전에 네 가지 질문</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed">
            <li><strong>상대:</strong> 이 표현과 배경을 아는 사람인가?</li>
            <li><strong>장소:</strong> 친한 대화인가, 공개되거나 기록이 남는 공간인가?</li>
            <li><strong>말투:</strong> 칭찬인지 반어인지 문장만 읽어도 드러나는가?</li>
            <li><strong>권리:</strong> 링크 소개인지, 타인의 영상·이미지·음원을 복제하는 일인가?</li>
          </ul>
          <div className="mt-6 space-y-4">
            {EXAMPLES.map((example) => (
              <div key={example.title} className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="font-bold">{example.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted">{example.body}</p>
                <p className="mt-2 text-xs font-semibold text-muted">밈캐치 편집 예시(가상)</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-bold">틀린 설명이나 끊어진 링크를 발견했다면</h2>
          <p className="mt-2 text-base leading-relaxed text-muted">
            밈캐치는 확인한 근거보다 더 넓게 단정하지 않는 것을 원칙으로 합니다.
            수록·정정·권리 처리 기준은{" "}
            <Link href="/editorial" className="text-accent-text underline underline-offset-2">
              편집 원칙
            </Link>
            에서 확인할 수 있습니다.
          </p>
        </section>
      </article>
    </main>
  );
}
