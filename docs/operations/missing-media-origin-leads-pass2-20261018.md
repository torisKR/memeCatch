# Missing-media origin leads, pass 2 — 2026-10-18

## Scope and query budget

This read-only pass addressed only `7rnbewq7` (**홍박사님을 아세요?**) and
`329w7u7p` (**재채기가 나온다 아 안 나온다**). It used exactly six new
focused public search queries and one direct official-page open:

1. `site:youtube.com/@metacomedy "홍박사님을 아세요"`
2. `site:youtube.com "조주봉(JOJUBONG)" "홍박사님을 아세요"`
3. `site:youtube.com "The 면상" "홍박사님을 아세요"`
4. `"재채기가 나온다 아 안 나온다" 스트리머`
5. `site:youtube.com "재채기가 나온다" "안 나온다"`
6. `site:sooplive.co.kr "재채기가 나온다" "안 나온다"`

One direct open of the discovered official YouTube URL was attempted and failed
with a fetch error. No YouTube Data API, oEmbed/transcript endpoint, login,
download, database operation, candidate intake, approval, upload or deployment
occurred.

Search metadata is discovery evidence only. It is not evidence of current public
status, embedding, target-region playback, rights, or the actual on-screen scene.

## `7rnbewq7` — 홍박사님을 아세요?

### Exact official origin URL found

- [`kWUsI7LCSmY`](https://www.youtube.com/watch?v=kWUsI7LCSmY) — search result
  title: **`조주봉(JOJUBONG) - '홍박사님을 아세요?' Official M/V`**.
  Search metadata attributes the upload to **더면상**, identifies the artist as
  조주봉, and provides production credits including THE MYEONSANG and META COMEDY.

This is the exact original-song/MV candidate requested for the parent: it is not
a remix, interview, generic performance, or unrelated use of the phrase.

### Direct evidence and remaining gates

The direct official page open failed (`Error fetching ...`), so this run did not
verify its current uploader-page rendering, public/embeddable setting,
target-region playback, frame content, or rights. Use the URL with Aside for
visual verification; then run the bounded raw-metadata check and existing
semantic/safety/rights operator review before pending intake. The primary source
is still not approved merely because search metadata calls it “Official M/V”.

### Rejected or non-replacement IDs

- `KVqxodtBhyE` — existing stored source; remains historical unlisted and
  unembeddable evidence, not revalidated or revived.
- `-KJ27kEOfAA` — drill remix result; not the original source and must not replace
  the parent.

## `329w7u7p` — 재채기가 나온다 아 안 나온다

### Result: no singular original creator/streamer source established

The focused search produced no official creator, Twitch, YouTube, SOOP, or
broadcaster page naming a specific originating streamer and video. The only
relevant discovery result was a non-primary community compendium describing the
phrase as a viewer donation prompt that induces a streamer to act as if a sneeze
is coming and then stops. It did not establish an original uploader, a canonical
stream, or a reusable official VOD.

That evidence supports treating this as a distributed interaction format rather
than assuming the old link belongs to a known original creator. It does **not**
prove there was no original source.

### Rejected or unavailable source

- `KCUB6dnVlTE` — existing historical source ID, stored public plus unembeddable;
  this pass did not recheck it and does not infer deletion, owner, content or
  rights from that stored state.
- No generic sneeze, medical, animation, or unrelated creator result was retained
  as a replacement candidate.

### Next action

Request a provenance hint from the operator: originating streamer, platform,
date/window, or an original VOD/post URL. With that constraint, search the named
creator/platform and visually validate the donation-prompt interaction. Until
then the correct state is source-free; do not force an arbitrary streamer clip
into the meme.

## Handoff targets for visual validation

- Original MV candidate: `https://www.youtube.com/watch?v=kWUsI7LCSmY`
- Existing unavailable Hong source: `https://www.youtube.com/watch?v=KVqxodtBhyE`
- Existing unavailable sneeze source: `https://www.youtube.com/watch?v=KCUB6dnVlTE`

The last two URLs are diagnostic references only, not instructions to revive or
republish them. No candidate was approved, ingested or made public by this pass.
