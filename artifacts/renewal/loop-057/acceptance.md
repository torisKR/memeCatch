# SUB-003 acceptance criteria — Plus Saved Reuse Radar

1. An active Plus member sees an always-available personal radar on the Plus dashboard, assembled only from their own saved memes and the current public trend/safety fields.
2. The radar makes three deterministic, non-overlapping actions: **ready now** (green + rising/active), **check the context** (yellow + rising/active), and **archive/revisit later** (all other saved memes). It never turns a caution or unsafe signal into a recommendation.
3. Each bucket is bounded and ordered by current trend score, then saved recency. Empty buckets and an empty saved library have a localized, useful next state rather than a blank section.
4. The dashboard reads at most a bounded number of RLS-scoped `saved_memes` joined to public `memes`; it does not write saved rows, billing data, alerts, migrations, or production content.
5. Radar copy, headings, status labels, and CTAs work for every supported UI locale; existing price route semantics remain unchanged.
6. Unit and component regressions prove prioritization, safety boundaries, empty states, locale rendering, and the full quality gates pass.
