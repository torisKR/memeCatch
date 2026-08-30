import { describe, expect, it } from "vitest";
import {
  canPublishHouseOriginal,
  houseOriginalCanonicalUrl,
  houseOriginalPublicLabel,
  houseOriginalPublishErrorMessage,
  isHouseOriginal,
  isHouseOriginalRightsSource,
  parseAdminOriginFilter,
  aboutSectionHeading,
  memeDetailMetadataDescription,
  originSectionHeading,
  originYearFieldLabel,
  adminMemeListEmptyState,
  adminLinkedContentsEmptyCopy,
  houseOriginalOperatorPath,
  houseOriginalPathNote,
  houseOriginalPathStepAriaCurrent,
  houseOriginalTransitionLabel,
  trustCopyKind,
} from "./house-original";

const ownedSource = {
  source_role: "original",
  rights_basis: "creator_permission",
  source_url: "https://catchmeme.com/memes/abcd1234-test",
};

describe("isHouseOriginal", () => {
  it("is true only for house_original", () => {
    expect(isHouseOriginal("house_original")).toBe(true);
    expect(isHouseOriginal("catalog")).toBe(false);
    expect(isHouseOriginal(null)).toBe(false);
    expect(isHouseOriginal(undefined)).toBe(false);
  });
});

describe("canPublishHouseOriginal", () => {
  it("is false when rights_basis is missing, unknown, or blocked", () => {
    expect(
      canPublishHouseOriginal({
        originKind: "house_original",
        houseRightsAttestedAt: "2026-08-30T00:00:00.000Z",
        sources: [{ source_role: "original", source_url: ownedSource.source_url }],
      }),
    ).toBe(false);
    expect(
      canPublishHouseOriginal({
        originKind: "house_original",
        houseRightsAttestedAt: "2026-08-30T00:00:00.000Z",
        sources: [{ ...ownedSource, rights_basis: "unknown" }],
      }),
    ).toBe(false);
    expect(
      canPublishHouseOriginal({
        originKind: "house_original",
        houseRightsAttestedAt: "2026-08-30T00:00:00.000Z",
        sources: [{ ...ownedSource, rights_basis: "blocked" }],
      }),
    ).toBe(false);
  });

  it("is false when source_role is not original", () => {
    expect(
      canPublishHouseOriginal({
        originKind: "house_original",
        houseRightsAttestedAt: "2026-08-30T00:00:00.000Z",
        sources: [{ ...ownedSource, source_role: "usage_example" }],
      }),
    ).toBe(false);
  });

  it("is true only with attestation, original role, and creator_permission URL", () => {
    expect(
      canPublishHouseOriginal({
        originKind: "house_original",
        houseRightsAttestedAt: "2026-08-30T00:00:00.000Z",
        sources: [ownedSource],
      }),
    ).toBe(true);
    expect(
      canPublishHouseOriginal({
        originKind: "house_original",
        houseRightsAttestedAt: null,
        sources: [ownedSource],
      }),
    ).toBe(false);
    expect(
      canPublishHouseOriginal({
        originKind: "catalog",
        houseRightsAttestedAt: "2026-08-30T00:00:00.000Z",
        sources: [ownedSource],
      }),
    ).toBe(false);
  });
});

describe("isHouseOriginalRightsSource", () => {
  it("rejects blank or non-http URLs", () => {
    expect(isHouseOriginalRightsSource({ ...ownedSource, source_url: "   " })).toBe(false);
    expect(isHouseOriginalRightsSource({ ...ownedSource, source_url: "ftp://x" })).toBe(false);
  });
});

describe("trustCopyKind", () => {
  it("splits house originals from catalog even with zero folk sources", () => {
    expect(trustCopyKind("house_original")).toBe("house_original");
    expect(trustCopyKind("catalog")).toBe("catalog");
    expect(trustCopyKind(undefined)).toBe("catalog");
  });
});

describe("house original copy helpers", () => {
  it("uses the public 자체 제작 label", () => {
    expect(houseOriginalPublicLabel()).toBe("밈캐치 자체 제작");
  });

  it("builds a CatchMeme canonical URL from short_id and slug", () => {
    expect(houseOriginalCanonicalUrl("abcd1234", "테스트")).toBe(
      "https://catchmeme.com/memes/abcd1234-%ED%85%8C%EC%8A%A4%ED%8A%B8",
    );
  });

  it("maps trigger messages to distinct Korean copy", () => {
    expect(houseOriginalPublishErrorMessage("house_rights_attestation_required")).toBe(
      "자체 제작 권리 확인에 동의해 주세요.",
    );
    expect(houseOriginalPublishErrorMessage("house_original_rights_required")).toContain(
      "권리 근거",
    );
    expect(
      houseOriginalPublishErrorMessage("invalid moderation transition: pending -> approved"),
    ).toBe("허용되지 않는 상태 전이예요. 현재 상태를 다시 확인해 주세요.");
  });
});

describe("admin origin filter and empty copy", () => {
  it("accepts only house_original as the origin query token", () => {
    expect(parseAdminOriginFilter("house_original")).toBe("house_original");
    expect(parseAdminOriginFilter("catalog")).toBeNull();
    expect(parseAdminOriginFilter(undefined)).toBeNull();
  });

  it("keeps the folk origin heading for catalog and the make heading for house originals", () => {
    expect(originSectionHeading("catalog")).toBe("어디서 시작됐어요?");
    expect(originSectionHeading("house_original")).toBe("어떻게 만들었나요?");
    expect(originSectionHeading(undefined)).toBe("어디서 시작됐어요?");
  });

  it("keeps folk 뜻과 유래 on catalog about/meta copy and uses 제작 for house originals", () => {
    expect(aboutSectionHeading("catalog")).toBe("뜻과 유래");
    expect(aboutSectionHeading("house_original")).toBe("뜻과 제작");
    expect(aboutSectionHeading(undefined)).toBe("뜻과 유래");
    expect(
      memeDetailMetadataDescription("대기표 밈", "줄 서는 농담", "house_original"),
    ).toBe(
      "대기표 밈 뜻과 제작 · 줄 서는 농담. 지금 써도 되는지 사용 안전 신호등까지 확인하세요.",
    );
    expect(
      memeDetailMetadataDescription("대기표 밈", "줄 서는 농담", "house_original"),
    ).not.toContain("뜻과 유래");
    expect(memeDetailMetadataDescription("딴딴", "한 줄 요약", "catalog")).toContain(
      "뜻과 유래",
    );
  });

  it("labels the year field as make-year for house originals and folk-year for catalog", () => {
    expect(originYearFieldLabel("house_original")).toBe("제작 연도");
    expect(originYearFieldLabel("catalog")).toBe("유행 시작 연도");
    expect(originYearFieldLabel(undefined)).toBe("유행 시작 연도");
  });

  it("gives the house-original admin empty list a create CTA like guest explore empty → submit", () => {
    const empty = adminMemeListEmptyState({ originFilter: "house_original", qualityQueue: false });
    expect(empty.actionHref).toBe("/admin/memes/new");
    expect(empty.actionLabel).toBe("자체 제작 등록");
    expect(adminMemeListEmptyState({ originFilter: null, qualityQueue: false }).actionHref).toBeUndefined();
  });

  it("does not tell operators to wait for oEmbed ranking on house-original SNS empty", () => {
    expect(adminLinkedContentsEmptyCopy("house_original")).not.toContain("검토 파이프라인");
    expect(adminLinkedContentsEmptyCopy("catalog")).toContain("검토 파이프라인에서 후보를 승격");
  });
});

describe("house original operator path", () => {
  it("keeps attested publish upcoming until approved or limited", () => {
    const pending = houseOriginalOperatorPath("pending");
    expect(pending.map((s) => s.id)).toEqual([
      "pending",
      "fact_checking",
      "rights_checking",
      "attested_publish",
    ]);
    expect(pending[0]?.state).toBe("current");
    expect(pending[3]?.state).toBe("upcoming");
    expect(pending[3]?.label).toBe("수동 게시");

    expect(houseOriginalOperatorPath("fact_checking")[1]?.state).toBe("current");
    expect(houseOriginalOperatorPath("rights_checking")[2]?.state).toBe("current");
    expect(houseOriginalOperatorPath("rights_checking")[3]?.state).toBe("upcoming");
    expect(houseOriginalOperatorPath("approved").every((s) => s.state === "done")).toBe(true);
    expect(houseOriginalOperatorPath("limited")[3]?.state).toBe("done");
  });

  it("does not auto-complete publish from create, and rejected blocks publish", () => {
    expect(houseOriginalPathNote()).toContain("자동 게시하지 않습니다");
    expect(houseOriginalOperatorPath("pending")[3]?.state).not.toBe("done");
    expect(houseOriginalOperatorPath("rejected")[3]?.state).toBe("blocked");
    expect(houseOriginalTransitionLabel("approved")).toBe("수동 게시");
    expect(houseOriginalTransitionLabel("rights_checking")).toBe("권리 확인으로");
    expect(houseOriginalTransitionLabel("fact_checking")).toBe("사실 확인으로");
    expect(houseOriginalPathStepAriaCurrent("current")).toBe("step");
    expect(houseOriginalPathStepAriaCurrent("done")).toBeUndefined();
    expect(houseOriginalPathStepAriaCurrent("upcoming")).toBeUndefined();
    expect(houseOriginalPathStepAriaCurrent("blocked")).toBeUndefined();
  });
});
