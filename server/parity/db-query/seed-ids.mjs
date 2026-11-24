// The fixed ids of seed.sql, shared by plans.capture.ts (the fixture) and
// db-query.mjs (the run). Users come from better-auth at run time.
const meme = (n) => `d0000000-0000-4000-8000-00000000000${n}`;

const memes = {
  approved: meme(1),
  second: meme(2),
  pending: meme(3),
  limited: meme(4),
};

// The discovery index as explore pagination sends it: the seeded public
// memes among 2,000 ids that match nothing, about 80 kB of JSON.
const filler = Array.from({ length: 1996 }, (_, i) => `e0000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

export const SEED = {
  memes,
  post: "d1000000-0000-4000-8000-000000000001",
  quizShortId: "dbq00001",
  videoContent: "d2000000-0000-4000-8000-000000000001",
  videoOperation: "d3000000-0000-4000-8000-000000000001",
  indexableIds: [memes.approved, memes.second, memes.limited, memes.pending, ...filler],
};
