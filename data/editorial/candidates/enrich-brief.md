You are rewriting thin Korean meme encyclopedia entries for catchmeme.com using real, independently verifiable web sources. Work only with WebSearch and WebFetch (direct curl/network from Bash is blocked). Do not touch git or any repository.

INPUT: {IN} — a JSON array of 20 memes (current stored text, existing sources).
OUTPUT: write {OUT} as JSON: {"memes": [...], "dropped": [...]}. Write it incrementally (rewrite the file after every few memes) so partial work survives.

For each meme, search (Korean queries first; English/Japanese if the meme is foreign) and OPEN at least 2 independent pages with WebFetch that actually discuss this meme/scene/song/challenge. Good: news articles (yna, osen, hankyung, chosun, joongang, donga, khan, hani, sbs/kbs/mbc news, insight, wikitree, dispatch, ize, cine21 ...), Wikipedia (ko/en/ja), official channels' pages, reputable blogs/newsletters (mark these weak in review_note). FORBIDDEN as sources: namu.wiki, catchmeme.com, merriam-webster.com, vop.co.kr, etnews.com, and bare social video links that you could not open. Existing TikTok/Instagram/YouTube links in the input do not count toward the 2.
- Only use a URL you actually fetched and saw the meme mentioned in. Record the page's real title (not a note like "제목 없음") and publisher name.
- If you cannot find 2 independent opened sources, or sources contradict on basic facts, DROP the meme with a concrete Korean reason. Do not pad. Dropping is fine and expected (earlier rounds dropped 25–60%).

For each kept meme output exactly:
{"short_id","slug","title" (copy from input unchanged),
 "description": Korean, 250–450 chars: what it means and where it comes from, written fresh in your own words (never copy article sentences),
 "origin": Korean, 100–250 chars: concrete origin facts (program/episode/year/person) only as the sources support; say what could not be confirmed,
 "usage_note": Korean ≥60 chars: when/how people use it,
 "caution": Korean ≥60 chars: real cautions (mocking real people, outdated, sensitive context, copyright of clips, etc.) specific to this meme,
 "usage_examples": [{"situation","text"}, {"situation","text"}] — 2 natural Korean chat/comment examples,
 "sources": [{"url","title","publisher"}] 2–4 items,
 "origin_year": ONLY include this key if sources clearly show the stored origin_year is wrong (integer 1980–2026, or null if wrong but no in-range answer),
 "review_note": Korean, optional: corrections to the stored text (claims you removed/changed because sources didn't support them), weak-source flags}
Dropped item: {"short_id","slug","title","reason"}.

Rules: Facts must come from the opened sources; when the stored text claims something no source supports, leave it out and say so in review_note. Total of description+origin+usage_note+caution+examples must exceed 300 chars. Polite neutral encyclopedia tone (~다 체). No placeholders (TODO, TBD, [출처]). No harmful, defamatory or sexual content; for memes mocking real private individuals, drop them.
Finish by replying with a 3-line summary: kept count, dropped count, output path.
