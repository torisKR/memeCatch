import assert from "node:assert/strict";
import { buildTranslationDemandReport } from "./translation-demand-report.mjs";

const ids = {
  missing: "00000000-0000-4000-8000-000000000001",
  stale: "00000000-0000-4000-8000-000000000002",
  machine: "00000000-0000-4000-8000-000000000003",
  ready: "00000000-0000-4000-8000-000000000004",
  unknown: "00000000-0000-4000-8000-000000000005",
};

function intakeReport(overrides = {}) {
  const base = {
    ok: true,
    errors: [],
    canonical: {
      existingArtifactErrors: 0,
      existingArtifactOk: true,
      existingSafeRows: 4,
      existingUnsafeRows: 0,
      newRows: 4,
      duplicateRows: 0,
      duplicateExistingRows: 0,
      duplicateInputRows: 0,
      sourceMismatchRows: 0,
      outOfWorklistRows: 0,
      missingBefore: { en: 4, ja: 3, zh: 2, "zh-tw": 1 },
      missingAfter: { en: 3, ja: 2, zh: 2, "zh-tw": 0 },
      localeDelta: {
        en: { before: 4, after: 3, delta: 1 },
        ja: { before: 3, after: 2, delta: 1 },
        zh: { before: 2, after: 2, delta: 0 },
        "zh-tw": { before: 1, after: 0, delta: 1 },
      },
    },
  };
  const canonicalOverrides = overrides.canonical ?? {};
  const localeDelta = Object.fromEntries(
    Object.entries(base.canonical.localeDelta).map(([locale, value]) => [
      locale,
      { ...value, ...(canonicalOverrides.localeDelta?.[locale] ?? {}) },
    ]),
  );
  return {
    ...base,
    ...overrides,
    canonical: {
      ...base.canonical,
      ...canonicalOverrides,
      localeDelta,
    },
  };
}

function demandRow({ id, locale = "en", requestCount, translationStatus, sourceUpdatedAt = "2026-08-09T00:00:00.000Z", latestRequestedAt = "2026-08-09T01:00:00.000Z" }) {
  return {
    meme_id: id,
    locale,
    request_count: requestCount,
    latest_requested_at: latestRequestedAt,
    status: "requested",
    translation_status: translationStatus,
    meme_updated_at: "2026-08-09T00:00:00.000Z",
    source_updated_at: sourceUpdatedAt,
    user_id: "private-owner-id",
    private_note: "must not leak",
  };
}

const demand = [
  demandRow({ id: ids.ready, requestCount: 99, translationStatus: "reviewed" }),
  demandRow({ id: ids.machine, requestCount: 8, translationStatus: "machine" }),
  demandRow({ id: ids.stale, requestCount: 10, translationStatus: "reviewed", sourceUpdatedAt: "2026-08-08T00:00:00.000Z" }),
  demandRow({ id: ids.missing, requestCount: 2, translationStatus: null }),
  demandRow({ id: ids.unknown, requestCount: 1, translationStatus: "future_status" }),
];

const report = buildTranslationDemandReport({
  intakeReport: intakeReport(),
  demand,
  limit: 10,
});

assert.equal(report.ok, true);
assert.deepEqual(Object.keys(report.locales), ["en", "ja", "zh", "zh-tw"]);
assert.deepEqual(report.intake.gates, {
  existingArtifactErrors: 0,
  existingArtifactOk: true,
  existingSafeRows: 4,
  existingUnsafeRows: 0,
  newRows: 4,
  duplicateRows: 0,
  duplicateExistingRows: 0,
  duplicateInputRows: 0,
  sourceMismatchRows: 0,
  outOfWorklistRows: 0,
});
assert.deepEqual(report.locales.en, {
  missingBefore: 4,
  missingAfter: 3,
  missingDelta: 1,
  activeRequestCount: 120,
  activeMemeCount: 5,
  actionableRequestCount: 20,
});
assert.deepEqual(
  report.priorities.map(({ memeId, supplyState }) => [memeId, supplyState]),
  [
    [ids.missing, "missing"],
    [ids.stale, "stale"],
    [ids.machine, "review_needed"],
    [ids.unknown, "unknown"],
    [ids.ready, "ready"],
  ],
);
assert.equal(report.priorities[0].action, "translate");
assert.equal(report.priorities[1].action, "refresh");
assert.equal(report.priorities[2].action, "review");
assert.equal(report.priorities[3].action, "hold");
assert.equal(report.priorities[4].action, "recheck");
assert.equal(JSON.stringify(report).includes("private-owner-id"), false);
assert.equal(JSON.stringify(report).includes("private_note"), false);

const failedIntake = buildTranslationDemandReport({
  intakeReport: intakeReport({
    ok: false,
    errors: ["duplicate translation"],
    canonical: { existingArtifactOk: false, existingUnsafeRows: 1, duplicateRows: 1 },
  }),
  demand: [],
});
assert.equal(failedIntake.ok, false);
assert.equal(failedIntake.intake.ok, false);
assert.ok(failedIntake.intake.errors.includes("duplicate translation"));
assert.equal(failedIntake.intake.gates.existingUnsafeRows, 1);

const gateFailureWithPassingTopLevel = buildTranslationDemandReport({
  intakeReport: intakeReport({
    canonical: { existingArtifactOk: false, existingArtifactErrors: 1, existingUnsafeRows: 1 },
  }),
  demand: [],
});
assert.equal(gateFailureWithPassingTopLevel.ok, false);
assert.ok(gateFailureWithPassingTopLevel.intake.errors.includes("existing artifact gate is not passing"));

for (const field of [
  "existingArtifactErrors",
  "existingUnsafeRows",
  "duplicateRows",
  "duplicateExistingRows",
  "duplicateInputRows",
  "sourceMismatchRows",
  "outOfWorklistRows",
]) {
  const gateFailure = buildTranslationDemandReport({
    intakeReport: intakeReport({ canonical: { [field]: 1 } }),
    demand: [],
  });
  assert.equal(gateFailure.ok, false, `${field} must fail the combined gate`);
}

const missingWithoutRevision = buildTranslationDemandReport({
  intakeReport: intakeReport(),
  demand: [demandRow({ id: ids.missing, requestCount: 1, translationStatus: null, sourceUpdatedAt: null })],
});
assert.equal(missingWithoutRevision.priorities[0].supplyState, "missing");

const tiedRows = [
  demandRow({ id: ids.stale, locale: "ja", requestCount: 1, translationStatus: null, sourceUpdatedAt: null }),
  demandRow({ id: ids.stale, locale: "en", requestCount: 1, translationStatus: null, sourceUpdatedAt: null }),
];
const tiedForward = buildTranslationDemandReport({ intakeReport: intakeReport(), demand: tiedRows });
const tiedReverse = buildTranslationDemandReport({ intakeReport: intakeReport(), demand: [...tiedRows].reverse() });
assert.deepEqual(tiedReverse.priorities, tiedForward.priorities);
assert.deepEqual(tiedForward.priorities.map(({ locale }) => locale), ["en", "ja"]);

const countTies = [
  demandRow({ id: ids.stale, requestCount: 1, translationStatus: null, sourceUpdatedAt: null }),
  demandRow({ id: ids.missing, requestCount: 2, translationStatus: null, sourceUpdatedAt: null }),
];
assert.deepEqual(
  buildTranslationDemandReport({ intakeReport: intakeReport(), demand: [...countTies].reverse() }).priorities.map(({ memeId }) => memeId),
  [ids.missing, ids.stale],
);

const timeTies = [
  demandRow({ id: ids.stale, requestCount: 1, translationStatus: null, sourceUpdatedAt: null, latestRequestedAt: "2026-08-09T01:00:00.000Z" }),
  demandRow({ id: ids.missing, requestCount: 1, translationStatus: null, sourceUpdatedAt: null, latestRequestedAt: "2026-08-09T02:00:00.000Z" }),
];
assert.deepEqual(
  buildTranslationDemandReport({ intakeReport: intakeReport(), demand: [...timeTies].reverse() }).priorities.map(({ memeId }) => memeId),
  [ids.missing, ids.stale],
);

const idTies = [
  demandRow({ id: ids.stale, requestCount: 1, translationStatus: null, sourceUpdatedAt: null }),
  demandRow({ id: ids.missing, requestCount: 1, translationStatus: null, sourceUpdatedAt: null }),
];
assert.deepEqual(
  buildTranslationDemandReport({ intakeReport: intakeReport(), demand: [...idTies].reverse() }).priorities.map(({ memeId }) => memeId),
  [ids.missing, ids.stale],
);

assert.throws(
  () => buildTranslationDemandReport({
    intakeReport: intakeReport(),
    demand: [demand[0], demand[0]],
  }),
  /duplicate demand row/,
);
assert.throws(
  () => buildTranslationDemandReport({
    intakeReport: intakeReport(),
    demand: [demandRow({ id: ids.missing, requestCount: 0, translationStatus: null })],
  }),
  /request_count must be a positive integer/,
);
assert.throws(
  () => buildTranslationDemandReport({
    intakeReport: intakeReport(),
    demand: [demandRow({ id: ids.missing, requestCount: 1, locale: "ko", translationStatus: null })],
  }),
  /locale is unsupported/,
);
assert.throws(
  () => buildTranslationDemandReport({
    intakeReport: intakeReport(),
    demand: [demandRow({ id: ids.missing, requestCount: 1, translationStatus: null, sourceUpdatedAt: null, latestRequestedAt: "August 9, 2026 01:00:00" })],
  }),
  /latest_requested_at must be an ISO timestamp/,
);
assert.throws(
  () => buildTranslationDemandReport({
    intakeReport: intakeReport(),
    demand: [demandRow({ id: ids.missing, requestCount: 1, translationStatus: null, sourceUpdatedAt: null, latestRequestedAt: "2026-02-30T01:00:00.000Z" })],
  }),
  /latest_requested_at must be an ISO timestamp/,
);
assert.throws(
  () => buildTranslationDemandReport({
    intakeReport: intakeReport(),
    demand: [demandRow({ id: ids.missing, requestCount: 1, translationStatus: "reviewed", sourceUpdatedAt: "August 9, 2026 00:00:00" })],
  }),
  /source_updated_at must be an ISO timestamp/,
);
const invalidMemeRevision = demandRow({ id: ids.missing, requestCount: 1, translationStatus: null, sourceUpdatedAt: null });
invalidMemeRevision.meme_updated_at = "2026-02-30T00:00:00.000Z";
assert.throws(
  () => buildTranslationDemandReport({
    intakeReport: intakeReport(),
    demand: [invalidMemeRevision],
  }),
  /meme_updated_at must be an ISO timestamp/,
);
assert.throws(
  () => buildTranslationDemandReport({
    intakeReport: intakeReport({
      canonical: { localeDelta: { en: { before: 4, after: 3, delta: 0 } } },
    }),
    demand: [],
  }),
  /localeDelta\.en must match/,
);

console.log("translation demand report safeguards OK");
