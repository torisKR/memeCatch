import { describe, expect, it } from "vitest";
import {
  canPublishHouseOriginal,
  houseOriginalCanonicalUrl,
  houseOriginalPublicLabel,
  houseOriginalPublishErrorMessage,
  isHouseOriginal,
  isHouseOriginalRightsSource,
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
