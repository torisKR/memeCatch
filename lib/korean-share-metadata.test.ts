import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { generateMetadata as generateAboutMetadata } from "@/app/(default)/about/page";
import { metadata as communityMetadata } from "@/app/(default)/community/page";
import { metadata as communityNewMetadata } from "@/app/(default)/community/new/page";
import { metadata as contactMetadata } from "@/app/(default)/contact/page";
import { metadata as editorialMetadata } from "@/app/(default)/editorial/page";
import { metadata as newsMetadata } from "@/app/(default)/news/page";
import { metadata as originalsMetadata } from "@/app/(default)/originals/page";
import { metadata as privacyMetadata } from "@/app/(default)/privacy/page";
import { metadata as searchMetadata } from "@/app/(default)/search/page";
import { metadata as supportMetadata } from "@/app/(default)/support/page";
import { metadata as termsMetadata } from "@/app/(default)/terms/page";
import { generateMetadata as generateKoreanMemeMetadata } from "@/app/(default)/memes/[key]/page";
import { generateMetadata as generateLocalizedMemeMetadata } from "@/app/[locale]/memes/[key]/page";
import { metadata as koreanLayoutMetadata } from "@/app/(default)/layout";
import { generateRankingsMetadata } from "@/app/rankings/page";
import { CURATED_CORE_MEMES } from "@/lib/curated-memes";
import { isGenericShareImageUrl, koreanMemeShareImage } from "@/lib/meme-share-image";
import type { Metadata } from "next";

const HOME_TITLE = "밈캐치 — 그 밈, 3초 안에 알려드려요";
const HOME_DESCRIPTION = "뜻·유래부터 지금 써도 되는지까지. 한국 밈을 3초 안에 따라잡아요.";

function expectOwnCard(
  metadata: Metadata,
  expected: { title: string; description: string; pathname: string },
) {
  expect(metadata.title).toBe(expected.title);
  expect(metadata.description).toBe(expected.description);
  expect(metadata.openGraph).toMatchObject({
    title: expected.title,
    description: expected.description,
    url: expected.pathname,
    images: [{ url: "/og/ko", width: 1200, height: 630 }],
  });
  expect(metadata.twitter).toMatchObject({
    card: "summary_large_image",
    title: expected.title,
    description: expected.description,
    images: [{ url: "/og/ko", width: 1200, height: 630 }],
  });
  expect(metadata.twitter).not.toMatchObject({ title: HOME_TITLE, description: HOME_DESCRIPTION });
  expect(metadata.openGraph).not.toMatchObject({ url: "/" });
}

describe("Korean pages keep their own X card and canonical og:url", () => {
  it("does not put the home title on the shared layout twitter block", () => {
    expect(koreanLayoutMetadata.twitter).toEqual({
      card: "summary_large_image",
      images: [{ url: "/og/ko", width: 1200, height: 630, alt: HOME_TITLE, type: "image/png" }],
    });
    expect(koreanLayoutMetadata.openGraph).toMatchObject({
      locale: "ko_KR",
      images: [{ url: "/og/ko", width: 1200, height: 630, alt: HOME_TITLE, type: "image/png" }],
    });
    expect(koreanLayoutMetadata.openGraph).not.toHaveProperty("url");
  });

  it("gives each static page its own title, description, and url", () => {
    expectOwnCard(communityMetadata, {
      title: "커뮤니티",
      description: "밈 추천·추억·토론 — 밈캐치 사람들과 자유롭게 이야기해요.",
      pathname: "/community",
    });
    expectOwnCard(contactMetadata, {
      title: "문의",
      description: "밈캐치 문의 이메일입니다. 콘텐츠 정정, 저작권, 제휴 문의를 받으며 보통 24~48시간 안에 답변드립니다.",
      pathname: "/contact",
    });
    expectOwnCard(editorialMetadata, {
      title: "편집 원칙",
      description: "밈캐치가 밈을 수록하는 기준, 사용 안전 신호를 매기는 근거, 사실확인·저작권 검수 절차와 오류 정정 요청 방법을 공개합니다.",
      pathname: "/editorial",
    });
    expectOwnCard(newsMetadata, {
      title: "세대별 밈 소식",
      description: "20대·30대·40대가 알아두면 좋은 밈과 디지털 생활 정보를 짧은 체크리스트로 정리합니다.",
      pathname: "/news",
    });
    expectOwnCard(searchMetadata, {
      title: "검색",
      description: "밈 이름, 초성, 별칭으로 무슨 밈인지 바로 찾아보세요.",
      pathname: "/search",
    });
    expectOwnCard(privacyMetadata, {
      title: "개인정보처리방침",
      description: "밈캐치 개인정보처리방침 — 수집 항목, 이용 목적, 보관 기간, 이용자 권리.",
      pathname: "/privacy",
    });
    expectOwnCard(termsMetadata, {
      title: "이용약관",
      description: "밈캐치 서비스 이용약관 — 서비스 내용, 회원의 의무, 콘텐츠 권리, 책임 제한.",
      pathname: "/terms",
    });
    expectOwnCard(originalsMetadata, {
      title: "오리지널 밈",
      description: "밈캐치가 직접 만든 일러스트와 이야기.",
      pathname: "/originals",
    });
    expectOwnCard(supportMetadata, {
      title: "고객센터",
      description: "밈캐치에 버그 신고, 콘텐츠 정정·삭제 요청, 건의사항을 보내 주세요.",
      pathname: "/support",
    });
    expectOwnCard(communityNewMetadata, {
      title: "커뮤니티 글쓰기",
      description: "밈 추천·추억·토론 — 커뮤니티에 새 글을 올려요.",
      pathname: "/community/new",
    });
  });

  it("gives the about page its own card", async () => {
    const metadata = await generateAboutMetadata();
    expectOwnCard(metadata, {
      title: "소개",
      description: String(metadata.description),
      pathname: "/about",
    });
    expect(metadata.description).not.toBe(HOME_DESCRIPTION);
  });

  it("gives rankings its own card when the board is unavailable", async () => {
    const metadata = await generateRankingsMetadata("ko");
    expect(metadata.openGraph).toMatchObject({ url: "/rankings" });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
    });
    expect(metadata.twitter).not.toMatchObject({ title: HOME_TITLE });
    expect(metadata.openGraph).not.toMatchObject({ url: "/" });
  });

  it("gives every curated Korean detail its own X title and meme card", async () => {
    expect(CURATED_CORE_MEMES.length).toBeGreaterThanOrEqual(8);
    for (const meme of CURATED_CORE_MEMES) {
      const metadata = await generateKoreanMemeMetadata({
        params: Promise.resolve({ key: `${meme.short_id}-${meme.slug}` }),
      });
      const title = `${meme.title} 뜻`;
      const image = koreanMemeShareImage(meme.short_id, meme.slug, meme.title);
      expect(metadata.title).toBe(title);
      expect(metadata.description).toBe(meme.summary);
      expect(metadata.openGraph).toMatchObject({
        title,
        description: meme.summary,
        url: `/memes/${meme.short_id}-${meme.slug}`,
        images: [image],
      });
      expect(metadata.twitter).toMatchObject({
        card: "summary_large_image",
        title,
        description: meme.summary,
        images: [image],
      });
      const urls = JSON.stringify(metadata);
      expect(urls).not.toContain("/og/ko");
      expect(isGenericShareImageUrl(image.url)).toBe(false);
    }
  });

  it("keeps an untranslated locale detail off the Korean curated card", async () => {
    for (const locale of ["en", "ja", "zh", "zh-tw"] as const) {
      const metadata = await generateLocalizedMemeMetadata({
        params: Promise.resolve({ locale, key: "bjk2021k-bun-jo-ka" }),
      });
      expect(metadata.title).toBe("밈을 잠시 불러오지 못했어요");
      expect(JSON.stringify(metadata)).not.toContain("분좋카");
      expect(JSON.stringify(metadata)).not.toContain("분위기 좋은 카페");
    }
  });

  it("returns not-found for an Arabic meme detail", async () => {
    await expect(generateLocalizedMemeMetadata({
      params: Promise.resolve({ locale: "ar", key: "bjk2021k-bun-jo-ka" }),
    })).rejects.toMatchObject({ digest: expect.stringMatching(/404$/) });
    await expect(generateLocalizedMemeMetadata({
      params: Promise.resolve({ locale: "ar", key: "not-a-real-slug" }),
    })).rejects.toMatchObject({ digest: expect.stringMatching(/404$/) });
  });
});
