# Meme card catalog, edition 1

The edition contains 1,000 free collectible cards, each referencing one existing public meme. Cards are not new meme submissions, NFTs, paid items, rewards, or limited copies. Collectors can save every available card; there are no rarity tiers or random draws.

`data/meme-cards/catalog-1000.json` freezes card assignments and art direction. IDs are `mc-0001` through `mc-1000`, numbers are 1–1,000, edition is integer `1`, and each card has one distinct existing meme UUID and one distinct positive signed 32-bit art seed. Once deployed, these assignments must not be reordered or silently reused for another meme.

## Selection and evidence

The source snapshot was a read-only query of project `onjipuldngbdptldkpoe` on 2026-10-07. It contained 3,423 records meeting all three conditions: `moderation_status = 'approved'`, `safety_level = 'green'`, and non-null `published_at`. The historical image, video, and verified social files contained 1,726 distinct references, but only 821 were currently eligible, with 818 distinct normalized titles. Additional existing public records were therefore necessary.

The final selection contains 1,000 cards from 1,305 reusable referenced candidate clusters. Independent curation review cleared the complete title/caption/alias baseline and all subsequent replacement and correction diffs. The reviewed manifest file SHA-256 is `4fd16c2718c11220d45a9c9dbd4b982a26f3a637f6706b279806fa21fbba955b`; its canonical data digest and the generated seed digest are recorded in the QA file. This review does not claim that every stored URL was revisited or that universal fame was measured.

Selection prefers recognizable reusable expressions, reaction formats, image memes, parodies and dance challenges supported by concrete public references. Plain athlete achievements, product listings, generic news events, ordinary animal breeds and songs without a reusable meme format were excluded. Current rejected or yellow records, including several familiar international classics, were not made eligible for this feature.

Identity is based on normalized titles and reviewed semantic equivalences, including Korean/English spellings. Raw stored aliases are not identity authority: review found that some name related songs, sketches or performers rather than the same meme. The manifest's `aliasKeys` records the curated title-equivalence family and does not republish those contaminated aliases. Known duplicates such as 세젤예/세젤귀, 혼밥/혼술, 소울리스좌/아마존 익스프레스, translated Rizz/Girl Dinner/Brat Summer forms and duplicate song challenges have one card assignment per reviewed family.

Concrete legacy video references also conservatively suppress another candidate using the same clip. That source correlation is separate from title equivalence and never creates a synonym claim in `aliasKeys`. Broad show, performer and game reference pages do not establish one shared meme identity. Editorial review excludes known mixed identities rather than repairing the existing database record.

Each card includes concrete HTTPS reference URLs and an evidence kind:

- `historical-media`: the existing ID also appears in a historical curated media file.
- `catalog-reference`: the existing catalog record already stores the reference.
- `curation-reference`: an editorial reference was added to this local manifest; existing meme source rows were not changed.

References document a concept or context. They do not establish a license to reproduce images, independently measured global fame, or current availability of every linked page. The catalog includes Korean internet slang and community formats alongside global memes; the evidence does not justify a claim that all 1,000 are universally famous. No origin dates, license conclusions or numerical popularity scores were invented. Compact counts, corrections and review limits are in `data/meme-cards/curation-qa.json`.

## Original art and public content

Art uses original procedural SVG compositions and generic symbols. The manifest specifies a semantic motif, meaningful symbol tokens, a composition and a deterministic art seed. For example, PPAP joins a pen with fruit, Doge uses a generic dog and speech elements, Hide the Pain Harold contrasts a smile with a teardrop, and the ice bucket challenge combines a bucket, water and hands. Source photographs, screenshots, performer likenesses and mascot artwork are not copied into the cards.

The cards share a symbol vocabulary and composition system. Different seeds create deterministic layout variations; this is not a claim of 1,000 individually drawn illustrations. The QA file reports the actual motif, symbol-set and composition counts.

`lib/meme-collectible-catalog.ts` is server-only. It exports `getMemeCardArtMotif`, `getMemeCardArtDirection` and `getMemeCardEditorialCaption`, each accepting a stable card ID and rejecting unknown IDs. It imports the full review manifest only on the server. The public API must establish the referenced meme's current eligibility before serializing a card, its local caption or its art metadata. Database titles remain live; the local editorial captions avoid known erroneous source descriptions. Removing publication eligibility removes the card from public results without changing historical card assignments.

## Validation and seed generation

Run the small standalone checks from the project root:

```sh
node --test scripts/build-meme-card-catalog.test.mjs
node scripts/build-meme-card-catalog.mjs --check
```

The checks enforce exactly 1,000 sequential stable IDs, distinct meme UUIDs, distinct normalized titles and concept keys, reviewed alias keys, distinct art seeds, valid motifs and compositions, nonempty symbol tokens and captions, canonical HTTPS references and absence of filler or unsubstantiated fields. Separate UI rendering tests exercise every catalog card and reject symbols the renderer does not implement. Structural uniqueness checks do not replace editorial review of whether two titles describe the same meme.

The catalog table migration must exist before applying the seed. Create the seed filename with the installed Supabase CLI, then render it into that existing empty file:

```sh
supabase migration new meme_collectible_catalog_seed
node scripts/build-meme-card-catalog.mjs --seed supabase/migrations/CLI_CREATED_TIMESTAMP_meme_collectible_catalog_seed.sql
```

The generated seed contains only collectible references. It does not insert or update memes, moderation, safety, rights, origins, existing source rows, user profiles or collection claims. It runs in one transaction and aborts unless all 1,000 referenced memes still exist and satisfy the eligibility rules. It rejects conflicting frozen card assignments, uses `ON CONFLICT (id) DO NOTHING` for safe retries, and verifies exactly 1,000 matching eligible cards before committing. The embedded SHA-256 identifies the manifest it was generated from.

Generation does not apply the migration. Production application requires the root deployment workflow to repeat the live 1,000-ID eligibility query and validate the migration against the schema before applying it. If eligibility changes, do not compensate by modifying a meme's moderation or safety status.
