import { describe, expect, it } from "vitest";
import { fuseMemeRanks, isMemeVector, MEME_VECTOR_DIMENSIONS, MEME_VECTOR_PROFILE } from "./meme-vectors";

function vector(norm = 1) {
  const values = Array<number>(MEME_VECTOR_DIMENSIONS).fill(0);
  values[0] = norm;
  return values;
}

describe("meme vector contract", () => {
  it("pins the catalog profile and accepts normalized sparse and dense 384-dimensional vectors", () => {
    expect(MEME_VECTOR_PROFILE).toBe("multilingual-e5-small-v1");
    expect(MEME_VECTOR_DIMENSIONS).toBe(384);
    expect(isMemeVector(vector())).toBe(true);
    expect(isMemeVector(Array<number>(384).fill(1 / Math.sqrt(384)))).toBe(true);
    expect(isMemeVector(vector(-1))).toBe(true);
  });

  it.each([null, {}, new Float32Array(384), vector().slice(1), [...vector(), 0]])(
    "rejects a non-array or incorrect dimension (%#)", (value) => {
      expect(isMemeVector(value)).toBe(false);
    },
  );

  it.each([NaN, Infinity, -Infinity, "1", null, undefined])(
    "rejects a non-finite or non-number coordinate (%#)", (coordinate) => {
      const values: unknown[] = vector();
      values[3] = coordinate;
      expect(isMemeVector(values)).toBe(false);
    },
  );

  it("rejects zero, unnormalized and sparse arrays with holes", () => {
    expect(isMemeVector(vector(0))).toBe(false);
    expect(isMemeVector(vector(0.98))).toBe(false);
    expect(isMemeVector(vector(1.02))).toBe(false);
    expect(isMemeVector(vector(Number.MAX_VALUE))).toBe(false);
    expect(isMemeVector(Array(384))).toBe(false);
    expect(isMemeVector(vector(0.99))).toBe(true);
    expect(isMemeVector(vector(1.01))).toBe(true);
  });
});

describe("reciprocal rank fusion", () => {
  it("promotes agreement across rankings and returns only the requested number", () => {
    const keyword = [{ id: "keyword" }, { id: "shared" }, { id: "tail" }];
    const semantic = [{ id: "semantic" }, { id: "shared" }];
    expect(fuseMemeRanks(keyword, semantic, 2)).toEqual([{ id: "shared" }, { id: "keyword" }]);
    expect(keyword.map(({ id }) => id)).toEqual(["keyword", "shared", "tail"]);
    expect(semantic.map(({ id }) => id)).toEqual(["semantic", "shared"]);
  });

  it("does not count repeated IDs within one ranking and preserves the first item's metadata", () => {
    const first = { id: "a", title: "canonical" };
    const keyword = [first, { id: "a", title: "duplicate" }, { id: "b", title: "keyword b" }];
    const semantic = [{ id: "b", title: "semantic b" }];
    expect(fuseMemeRanks(keyword, semantic, 12)).toEqual([keyword[2], first]);
  });

  it("breaks equal scores deterministically with keyword ranking first", () => {
    expect(fuseMemeRanks([{ id: "a" }], [{ id: "b" }], 12)).toEqual([{ id: "a" }, { id: "b" }]);
    expect(fuseMemeRanks([], [{ id: "b" }, { id: "c" }], 12)).toEqual([{ id: "b" }, { id: "c" }]);
    expect(fuseMemeRanks([], [], 12)).toEqual([]);
    expect(fuseMemeRanks([{ id: "a" }], [], 0)).toEqual([]);
  });
});
